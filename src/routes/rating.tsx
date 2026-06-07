/**
 * /rating — Ценовой рейтинг магазинов за последние 30 дней.
 *
 * ✅ FIX: Больше не грузим все строки price_history в Node.js.
 * Вместо этого вызываем RPC-функцию get_store_rating(), которая делает
 * GROUP BY прямо в PostgreSQL и возвращает только агрегаты.
 *
 * SQL для миграции (добавить в supabase/migrations/):
 * ─────────────────────────────────────────────────────────────────────────
 * CREATE OR REPLACE FUNCTION get_store_rating(days int DEFAULT 30)
 * RETURNS TABLE (
 *   store_id   uuid,
 *   category_id uuid,
 *   avg_price  numeric,
 *   cnt        bigint
 * )
 * LANGUAGE sql STABLE SECURITY DEFINER AS $$
 *   SELECT
 *     ph.store_id,
 *     p.category_id,
 *     ROUND(AVG(ph.price)::numeric, 2) AS avg_price,
 *     COUNT(*)                         AS cnt
 *   FROM price_history ph
 *   JOIN products p ON p.id = ph.product_id
 *   WHERE ph.recorded_at >= NOW() - (days || ' days')::interval
 *   GROUP BY ph.store_id, p.category_id;
 * $$;
 * ─────────────────────────────────────────────────────────────────────────
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { Trophy, TrendingDown, Share2, BarChart3, Medal } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { getServerSupabase } from "@/lib/supabase-server";
import { formatRub } from "@/lib/format";
import { shareProduct, hapticLight } from "@/hooks/use-native";
import type { Database } from "@/integrations/supabase/types";

type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];

const getRatingData = createServerFn({ method: "GET" }).handler(async () => {
  const sb = getServerSupabase();

  // ✅ FIX: три лёгких запроса вместо одного огромного SELECT price_history.
  // Вся агрегация (GROUP BY store_id, category_id) выполняется в PostgreSQL.
  const [{ data: stores }, { data: categories }, { data: rows, error }] = await Promise.all([
    sb.from("stores").select("*"),
    sb.from("categories").select("*").order("sort_order"),
    // RPC возвращает строки вида { store_id, category_id, avg_price, cnt }
    // Сигнатура: get_store_rating(days int) → см. SQL выше
    sb.rpc("get_store_rating", { days: 30 }),
  ]);

  if (error) {
    console.error("get_store_rating RPC error:", error);
    return { stores: [], categories: [], matrix: {}, overall: [] };
  }

  if (!stores || !rows) return { stores: [], categories: [], matrix: {}, overall: [] };

  // Строим матрицу categoryId → storeId → avg_price из агрегатов БД
  const matrix: Record<string, Record<string, number>> = {};
  // Для общего рейтинга: взвешенное среднее (сумма средних по категориям / кол-во категорий)
  const storeScores: Record<string, { sum: number; count: number }> = {};

  for (const row of rows ?? []) {
    const catId = row.category_id ?? "other";
    if (!matrix[catId]) matrix[catId] = {};
    matrix[catId][row.store_id] = Number(row.avg_price);

    if (!storeScores[row.store_id]) storeScores[row.store_id] = { sum: 0, count: 0 };
    storeScores[row.store_id].sum += Number(row.avg_price);
    storeScores[row.store_id].count += 1;
  }

  const overall = stores
    .map((s) => ({
      ...s,
      avg: storeScores[s.id] ? Math.round(storeScores[s.id].sum / storeScores[s.id].count) : null,
    }))
    .filter((s) => s.avg !== null)
    .sort((a, b) => (a.avg ?? 0) - (b.avg ?? 0));

  return { stores, categories: categories ?? [], matrix, overall };
});

export const Route = createFileRoute("/rating")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(
      queryOptions({ queryKey: ["rating"], queryFn: () => getRatingData(), staleTime: 3600_000 }),
    ),
  head: () => ({ meta: [{ title: "Рейтинг магазинов — Ценомер" }] }),
  component: () => (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background">
          <SiteHeader compact />
        </div>
      }
    >
      <RatingPage />
    </Suspense>
  ),
});

const MEDALS = ["🥇", "🥈", "🥉"];

function RatingPage() {
  const { data } = useSuspenseQuery(
    queryOptions({ queryKey: ["rating"], queryFn: () => getRatingData(), staleTime: 3600_000 }),
  );

  const { stores, categories, matrix, overall } = data;
  // ✅ FIX 5.1: storeMap удалён — объявлялся но не использовался

  async function shareRating() {
    hapticLight();
    const text = overall
      .map((s, i) => `${MEDALS[i] ?? `${i + 1}.`} ${s.name}: ~${formatRub(s.avg)}/товар`)
      .join("\n");
    await shareProduct(
      `Рейтинг московских магазинов по ценам:\n${text}\n\nПроверь сам →`,
      `${window.location.origin}/rating`,
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader compact />
      <main className="mx-auto max-w-4xl px-4 py-8">
        {/* Заголовок */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <BarChart3 className="h-3.5 w-3.5" /> По данным за 30 дней
            </div>
            <h1 className="font-display text-3xl font-bold tracking-tight">Рейтинг магазинов</h1>
            <p className="mt-1 text-muted-foreground">
              Где в Москве выгоднее всего покупать продукты
            </p>
          </div>
          <button
            onClick={shareRating}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium transition hover:bg-muted"
          >
            <Share2 className="h-4 w-4" /> Поделиться
          </button>
        </div>

        {/* Общий рейтинг */}
        {overall.length > 0 && (
          <div className="mb-8 overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
            <div className="flex items-center gap-2 border-b border-border px-5 py-4">
              <Trophy className="h-5 w-5 text-yellow-500" />
              <h2 className="font-semibold">Общий рейтинг</h2>
              <span className="ml-auto text-xs text-muted-foreground">Средняя цена на товар</span>
            </div>
            <div className="divide-y divide-border">
              {overall.map((store, i) => {
                const isBest = i === 0;
                const worst = overall[overall.length - 1];
                const savingVsWorst = worst.avg && store.avg ? worst.avg - store.avg : 0;
                return (
                  <Link
                    key={store.id}
                    to="/store/$slug"
                    params={{ slug: store.slug }}
                    className="flex items-center gap-4 px-5 py-4 transition hover:bg-muted/50"
                  >
                    <span className="text-xl">
                      {MEDALS[i] ?? (
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-sm font-bold">
                          {i + 1}
                        </span>
                      )}
                    </span>
                    <div
                      className="flex h-9 w-9 items-center justify-center rounded-xl font-bold text-white text-sm"
                      style={{ backgroundColor: store.brand_color ?? "#888" }}
                    >
                      {store.name[0]}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold">{store.name}</p>
                      {savingVsWorst > 0 && (
                        <p className="flex items-center gap-1 text-xs text-success">
                          <TrendingDown className="h-3 w-3" />
                          Дешевле на {formatRub(savingVsWorst)} чем в {worst.name}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p
                        className={`font-display text-xl font-bold ${isBest ? "text-success" : ""}`}
                      >
                        {formatRub(store.avg)}
                      </p>
                      {isBest && (
                        <span className="text-[10px] font-semibold text-success">ЛУЧШИЙ</span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Матрица по категориям */}
        {categories.length > 0 && Object.keys(matrix).length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
            <div className="flex items-center gap-2 border-b border-border px-5 py-4">
              <Medal className="h-5 w-5 text-primary" />
              <h2 className="font-semibold">По категориям</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Категория
                    </th>
                    {overall.map((s) => (
                      <th key={s.id} className="px-4 py-3 text-center text-xs font-medium">
                        <span
                          className="inline-block rounded-md px-2 py-0.5 text-[11px] font-semibold"
                          style={{
                            backgroundColor: `${s.brand_color}20`,
                            color: s.brand_color ?? undefined,
                          }}
                        >
                          {s.name}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {categories
                    .filter((c: CategoryRow) => matrix[c.id])
                    .map((cat: CategoryRow) => {
                      const row = matrix[cat.id] ?? {};
                      const prices = overall.map((s) => row[s.id]).filter(Boolean);
                      const minPrice = prices.length ? Math.min(...prices) : null;
                      return (
                        <tr key={cat.id} className="hover:bg-muted/30 transition">
                          <td className="px-5 py-3 text-sm">
                            <span className="mr-1.5">{cat.icon}</span>
                            {cat.name}
                          </td>
                          {overall.map((s) => {
                            const price = row[s.id];
                            const isBest = price && price === minPrice;
                            return (
                              <td key={s.id} className="px-4 py-3 text-center">
                                {price ? (
                                  <span
                                    className={`text-sm font-semibold ${isBest ? "text-success" : ""}`}
                                  >
                                    {isBest && "🏆 "}
                                    {formatRub(price)}
                                  </span>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
            <p className="px-5 py-3 text-xs text-muted-foreground">
              🏆 — лучшая цена в категории · данные обновляются каждые 6 часов
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
