import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { queryOptions, useQueries } from "@tanstack/react-query";
import { Suspense, useMemo } from "react";
import { X, TrendingDown, ArrowLeft, BarChart3 } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { ProductPageSkeleton } from "@/components/Skeletons";
import { getProductBySlug } from "@/lib/products.functions";
import { formatRub, discountPercent } from "@/lib/format";
import { useShoppingList } from "@/lib/shopping-list";
import { hapticSuccess } from "@/hooks/use-native";
import { toast } from "sonner";
import type { ProductWithOffers } from "@/lib/products.functions";

const compareSchema = z.object({
  slugs: z.string(), // comma-separated slugs
});

export const Route = createFileRoute("/compare")({
  validateSearch: compareSchema,
  head: () => ({ meta: [{ title: "Сравнение товаров — Ценомер" }] }),
  component: () => (
    <Suspense fallback={<ProductPageSkeleton />}>
      <ComparePage />
    </Suspense>
  ),
});

function useProductsBySlug(slugs: string[]) {
  // ✅ FIX: useQueries вместо хуков в цикле (нарушение Rules of Hooks)
  const results = useQueries({
    queries: slugs.map((slug) =>
      queryOptions({
        queryKey: ["product", slug],
        queryFn: () => getProductBySlug({ data: { slug } }),
        staleTime: 5 * 60_000,
      }),
    ),
  });
  return results;
}

function ComparePage() {
  const { slugs: slugsParam } = Route.useSearch();
  const navigate = useNavigate();
  const { addItem } = useShoppingList();
  const slugs = slugsParam.split(",").filter(Boolean).slice(0, 4);
  const results = useProductsBySlug(slugs);
  // ✅ FIX 5.6: отслеживаем какие slugs вернули null (товар не найден)
  const products = results.map((r) => r.data?.product).filter(Boolean) as ProductWithOffers[];

  // Все уникальные магазины из всех товаров
  const allStores = useMemo(() => {
    const map = new Map<string, { id: string; name: string; color: string | null }>();
    for (const p of products) {
      for (const o of p.offers) {
        if (!map.has(o.store_id))
          map.set(o.store_id, { id: o.store_id, name: o.store_name, color: o.brand_color });
      }
    }
    return Array.from(map.values());
  }, [products]);

  function removeProduct(slug: string) {
    const newSlugs = slugs.filter((s) => s !== slug).join(",");
    if (!newSlugs) navigate({ to: "/search" });
    else navigate({ to: "/compare", search: { slugs: newSlugs } });
  }

  function getPrice(product: ProductWithOffers, storeId: string) {
    return product.offers.find((o) => o.store_id === storeId);
  }

  function getBestStoreForProduct(product: ProductWithOffers) {
    return product.offers[0]; // уже отсортированы по цене
  }

  // ✅ IMPROVEMENT: показываем скелетон пока хотя бы один запрос грузится
  const isLoading = results.some((r) => r.isLoading);
  if (isLoading) return <ProductPageSkeleton />;
  const notFoundSlugs = slugs.filter(
    (slug, i) => !results[i].isLoading && !results[i].data?.product,
  );

  if (products.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader compact />
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
          <BarChart3 className="h-12 w-12 text-muted-foreground/30" />
          <p className="text-lg font-semibold">Нечего сравнивать</p>
          <Link to="/search" className="text-sm text-primary hover:underline">
            ← Вернуться к поиску
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader compact />
      <main className="mx-auto max-w-6xl px-4 py-8">
        {/* Заголовок */}
        <div className="mb-6 flex items-center gap-3">
          <Link
            to="/search"
            className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-card text-muted-foreground hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">Сравнение товаров</h1>
            <p className="text-sm text-muted-foreground">
              {products.length} товара · {allStores.length} магазинов
            </p>
          </div>
        </div>

        {/* ✅ FIX 5.6: Placeholder-карточки для ненайденных товаров */}
        {notFoundSlugs.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {notFoundSlugs.map((slug) => (
              <div
                key={slug}
                className="flex items-center gap-2 rounded-xl border border-dashed border-border bg-card px-4 py-3 text-sm text-muted-foreground"
              >
                <span>
                  Товар не найден: <code className="font-mono text-xs">{slug}</code>
                </span>
                <button
                  onClick={() => removeProduct(slug)}
                  className="ml-2 rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Таблица сравнения — горизонтальный скролл на мобильном */}
        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-soft">
          <table className="min-w-full">
            {/* Шапка — товары */}
            <thead>
              <tr className="border-b border-border">
                <th className="w-32 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Магазин
                </th>
                {products.map((p) => (
                  <th key={p.id} className="min-w-[180px] px-4 py-3 text-left">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        {p.image_url && (
                          <img
                            src={p.image_url}
                            alt={p.name}
                            className="mb-2 h-16 w-16 rounded-xl object-cover"
                          />
                        )}
                        <Link
                          to="/product/$slug"
                          params={{ slug: p.slug }}
                          className="line-clamp-2 text-sm font-semibold hover:text-primary"
                        >
                          {p.name}
                        </Link>
                        {p.volume && (
                          <p className="mt-0.5 text-xs text-muted-foreground">{p.volume}</p>
                        )}
                        {/* ✅ FIX: best_price вычисляется в JS (его нет в БД), берём из offers[0] */}
                        {p.offers[0] && (
                          <p className="mt-1 font-display text-lg font-bold text-success">
                            от {formatRub(p.offers[0].price)}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => removeProduct(p.slug)}
                        className="shrink-0 rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <button
                      onClick={() => {
                        addItem(p);
                        hapticSuccess();
                        toast.success(`${p.name} добавлен в список`);
                      }}
                      className="mt-2 w-full rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition hover:bg-primary/20"
                    >
                      + В список покупок
                    </button>
                  </th>
                ))}
              </tr>
            </thead>

            {/* Строки — магазины */}
            <tbody className="divide-y divide-border">
              {allStores.map((store) => {
                const prices = products.map((p) => getPrice(p, store.id));
                const hasAny = prices.some(Boolean);
                if (!hasAny) return null;

                const minPrice = Math.min(...prices.filter(Boolean).map((o) => o!.price));

                return (
                  <tr key={store.id} className="transition hover:bg-muted/40">
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold"
                        style={{
                          backgroundColor: `${store.color}15`,
                          color: store.color ?? undefined,
                        }}
                      >
                        {store.name}
                      </span>
                    </td>
                    {products.map((p) => {
                      const offer = getPrice(p, store.id);
                      const isBest = offer && offer.price === minPrice;
                      // ✅ FIX: сравниваем с offers[0].price, а не p.best_price (нет в БД)
                      const isLowest = offer && offer.price === p.offers[0]?.price;
                      return (
                        <td key={p.id} className="px-4 py-3">
                          {offer ? (
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`font-display text-base font-bold ${isLowest ? "text-success" : ""}`}
                                >
                                  {formatRub(offer.price)}
                                </span>
                                {isBest && prices.filter(Boolean).length > 1 && (
                                  <TrendingDown className="h-3.5 w-3.5 text-success" />
                                )}
                              </div>
                              {offer.old_price && (
                                <div className="flex items-center gap-1">
                                  <span className="text-xs text-muted-foreground line-through">
                                    {formatRub(offer.old_price)}
                                  </span>
                                  <span className="text-xs font-medium text-promo">
                                    −
                                    {Math.round(discountPercent(offer.old_price, offer.price) ?? 0)}
                                    %
                                  </span>
                                </div>
                              )}
                              {offer.store_product_url && (
                                <a
                                  href={offer.store_product_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="mt-0.5 inline-block text-[11px] text-muted-foreground hover:text-primary hover:underline"
                                >
                                  Перейти →
                                </a>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}

              {/* Итоговая строка — экономия */}
              <tr className="border-t-2 border-border bg-muted/30">
                <td className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Лучший магазин
                </td>
                {products.map((p) => {
                  const best = getBestStoreForProduct(p);
                  const worst = p.offers[p.offers.length - 1];
                  const diff = worst && best ? worst.price - best.price : 0;
                  return (
                    <td key={p.id} className="px-4 py-3">
                      <div>
                        <span
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold"
                          style={{
                            backgroundColor: `${best?.brand_color}15`,
                            color: best?.brand_color ?? undefined,
                          }}
                        >
                          {best?.store_name}
                        </span>
                        {diff > 0 && (
                          <p className="mt-1 text-xs text-success">Экономия {formatRub(diff)}</p>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-center text-xs text-muted-foreground">
          Можно сравнить до 4 товаров · Добавьте товар через поиск
        </p>
      </main>
    </div>
  );
}
