import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, lazy, Suspense } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ExternalLink, Heart, BellRing, Check } from "lucide-react";
const ProductPriceChart = lazy(() => import("@/components/ProductPriceChart"));
import { SiteHeader } from "@/components/SiteHeader";
import { getProductBySlug } from "@/lib/products.functions";
import { formatRub, discountPercent } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export const Route = createFileRoute("/product/$slug")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(
      queryOptions({
        queryKey: ["product", params.slug],
        queryFn: () => getProductBySlug({ data: { slug: params.slug } }),
      }),
    );
    if (!data.product) throw notFound();
    return data;
  },
  head: ({ loaderData }) => ({
    meta: loaderData?.product
      ? [
          { title: `${loaderData.product.name} — цены в магазинах Москвы | Ценомер` },
          {
            name: "description",
            content: `Сравнение цен на ${loaderData.product.name} в Перекрёстке, Пятёрочке, Магните и Ленте.`,
          },
          { property: "og:title", content: loaderData.product.name },
          { property: "og:image", content: loaderData.product.image_url ?? "" },
        ]
      : [{ title: "Товар — Ценомер" }],
  }),
  component: ProductPage,
  errorComponent: ({ error }) => (
    <div className="p-8 text-center text-destructive">{error.message}</div>
  ),
  notFoundComponent: () => (
    <div className="grid min-h-screen place-items-center p-8 text-center">Товар не найден</div>
  ),
});

function ProductPage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(
    queryOptions({
      queryKey: ["product", slug],
      queryFn: () => getProductBySlug({ data: { slug } }),
    }),
  );
  const product = data.product!;
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [isFav, setIsFav] = useState(false);
  const [isTracked, setIsTracked] = useState(false);

  useEffect(() => {
    if (!user) {
      setIsFav(false);
      setIsTracked(false);
      return;
    }
    supabase
      .from("favorites")
      .select("product_id")
      .eq("user_id", user.id)
      .eq("product_id", product.id)
      .maybeSingle()
      .then(({ data }) => setIsFav(!!data));
    supabase
      .from("price_alerts")
      .select("id")
      .eq("user_id", user.id)
      .eq("product_id", product.id)
      .maybeSingle()
      .then(({ data }) => setIsTracked(!!data));
  }, [user, product.id]);

  async function toggleFav() {
    if (!user) {
      toast.info("Войдите, чтобы сохранять избранное");
      return;
    }
    if (isFav) {
      await supabase.from("favorites").delete().eq("user_id", user.id).eq("product_id", product.id);
      setIsFav(false);
      toast.success("Удалено из избранного");
    } else {
      await supabase.from("favorites").insert({ user_id: user.id, product_id: product.id });
      setIsFav(true);
      toast.success("Добавлено в избранное");
    }
    queryClient.invalidateQueries({ queryKey: ["favorites"] });
  }

  async function toggleTrack() {
    if (!user) {
      toast.info("Войдите, чтобы отслеживать цену");
      return;
    }
    if (isTracked) {
      await supabase
        .from("price_alerts")
        .delete()
        .eq("user_id", user.id)
        .eq("product_id", product.id);
      setIsTracked(false);
      toast.success("Отслеживание выключено");
    } else {
      await supabase.from("price_alerts").insert({
        user_id: user.id,
        product_id: product.id,
        target_price: product.best_price,
      });
      setIsTracked(true);
      toast.success("Цена отслеживается");
    }
  }

  const chartData = useMemo(() => {
    const map = new Map<string, { date: string; price: number; count: number }>();
    for (const h of data.history) {
      const d = new Date(h.recorded_at);
      const key = d.toISOString().slice(0, 10);
      const ex = map.get(key);
      if (ex) {
        ex.price += h.price;
        ex.count += 1;
      } else {
        map.set(key, { date: key, price: h.price, count: 1 });
      }
    }
    return Array.from(map.values())
      .map((d) => ({
        date: d.date.slice(5),
        price: Math.round(d.price / d.count),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [data.history]);

  const best = product.offers[0];
  const savings =
    product.max_price && product.best_price ? product.max_price - product.best_price : 0;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader compact />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
        <Link
          to="/"
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Назад
        </Link>

        <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
          {/* Фото */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="overflow-hidden rounded-3xl border border-border bg-card shadow-soft"
          >
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.name}
                className="aspect-square w-full object-cover"
              />
            ) : (
              <div className="aspect-square w-full bg-muted" />
            )}
          </motion.div>

          {/* Инфо */}
          <div>
            {product.category_name && (
              <Link
                to="/search"
                search={{ category: product.category_slug ?? undefined }}
                className="inline-block text-xs font-medium uppercase tracking-wider text-primary"
              >
                {product.category_name}
              </Link>
            )}
            <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              {product.name}
            </h1>
            {product.brand && (
              <p className="mt-1 text-sm text-muted-foreground">
                Бренд: <span className="font-medium text-foreground">{product.brand}</span>
                {product.volume && <span> · {product.volume}</span>}
              </p>
            )}

            <div className="mt-6 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary-soft to-card p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-primary">
                Самая низкая цена
              </p>
              <div className="mt-1 flex items-baseline gap-3">
                <span className="font-display text-5xl font-bold text-success price-glow">
                  {formatRub(product.best_price)}
                </span>
                {best?.old_price && (
                  <span className="text-lg text-muted-foreground line-through">
                    {formatRub(best.old_price)}
                  </span>
                )}
              </div>
              {best && (
                <p className="mt-2 text-sm">
                  в магазине <span className="font-semibold">{best.store_name}</span>
                  {savings > 0 && (
                    <span className="ml-2 text-success">· экономия до {formatRub(savings)}</span>
                  )}
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                {best?.store_product_url && (
                  <a
                    href={best.store_product_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft transition hover:opacity-90"
                  >
                    Купить в {best.store_name} <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
                <button
                  onClick={toggleFav}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-4 py-2.5 text-sm font-medium transition ${isFav ? "border-primary bg-primary-soft text-primary" : "border-border bg-card hover:bg-muted"}`}
                >
                  <Heart className={`h-4 w-4 ${isFav ? "fill-current" : ""}`} />
                  {isFav ? "В избранном" : "В избранное"}
                </button>
                <button
                  onClick={toggleTrack}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-4 py-2.5 text-sm font-medium transition ${isTracked ? "border-primary bg-primary-soft text-primary" : "border-border bg-card hover:bg-muted"}`}
                >
                  {isTracked ? <Check className="h-4 w-4" /> : <BellRing className="h-4 w-4" />}
                  {isTracked ? "Отслеживается" : "Отслеживать"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Сравнительная таблица */}
        <section className="mt-12">
          <h2 className="mb-4 font-display text-2xl font-bold tracking-tight">Цены по магазинам</h2>
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Магазин</th>
                  <th className="px-4 py-3 text-right">Цена</th>
                  <th className="px-4 py-3 text-right">Скидка</th>
                  <th className="px-4 py-3 text-right">Действие</th>
                </tr>
              </thead>
              <tbody>
                {product.offers.map((o, i) => {
                  const dp = discountPercent(o.old_price, o.price);
                  const isBest = i === 0;
                  return (
                    <tr
                      key={o.store_id}
                      className={`border-t border-border ${isBest ? "bg-primary-soft/40" : ""}`}
                    >
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex items-center gap-2 font-medium"
                          style={{ color: o.brand_color ?? undefined }}
                        >
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: o.brand_color ?? undefined }}
                          />
                          {o.store_name}
                          {isBest && (
                            <span className="rounded-full bg-success px-2 py-0.5 text-[10px] font-semibold text-success-foreground">
                              лучшая цена
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="font-display text-lg font-bold">{formatRub(o.price)}</div>
                        {o.old_price && (
                          <div className="text-xs text-muted-foreground line-through">
                            {formatRub(o.old_price)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {dp ? (
                          <span className="inline-block rounded-full bg-promo px-2 py-0.5 text-xs font-semibold text-promo-foreground">
                            −{Math.round(dp)}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {o.store_product_url ? (
                          <a
                            href={o.store_product_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                          >
                            Открыть <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* График */}
        {chartData.length > 1 && (
          <section className="mt-12">
            <h2 className="mb-4 font-display text-2xl font-bold tracking-tight">
              История цен за 30 дней
            </h2>
            <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
              <Suspense
                fallback={
                  <div className="h-64 flex items-center justify-center">Загрузка графика…</div>
                }
              >
                <ProductPriceChart data={chartData} />
              </Suspense>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
