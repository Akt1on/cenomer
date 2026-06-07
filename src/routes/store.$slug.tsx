import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { z } from "zod";
import { ExternalLink, Tag, Store } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { ProductCard } from "@/components/ProductCard";
import { ProductGridSkeleton } from "@/components/Skeletons";
import { createServerFn } from "@tanstack/react-start";
import { getServerSupabase } from "@/lib/supabase-server";
import type { Database } from "@/integrations/supabase/types";
import type { ProductWithOffers } from "@/lib/products.functions";

type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];
type StoreProductRow = Database["public"]["Tables"]["store_products"]["Row"];
type StoreRow = Database["public"]["Tables"]["stores"]["Row"];

type StoreProductWithStore = StoreProductRow & {
  stores: Pick<StoreRow, "slug" | "name" | "brand_color"> | null;
};

// ✅ FIX 2.6: один запрос к stores по slug, потом используем store.id для остальных
const getStoreData = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => z.object({ slug: z.string() }).parse(input))
  .handler(async ({ data }) => {
    const sb = getServerSupabase();

    // Один запрос — получаем store
    const { data: store } = await sb.from("stores").select("*").eq("slug", data.slug).maybeSingle();

    if (!store) return { store: null, promoProducts: [], recentProducts: [] };

    // Дальнейшие запросы используют store.id (нет второго запроса по slug)
    const [{ data: promoOffers }, { data: recentProds }, { data: allOffers }, { data: cats }] =
      await Promise.all([
        sb
          .from("store_products")
          .select("product_id")
          .eq("is_promo", true)
          .eq("store_id", store.id)
          .limit(24),
        sb
          .from("store_products")
          .select("product_id")
          .eq("store_id", store.id)
          .order("fetched_at", { ascending: false })
          .limit(12),
        sb.from("store_products").select("*, stores(*)").eq("store_id", store.id),
        sb.from("categories").select("*"),
      ]);

    const promoIds = (promoOffers || []).map((r) => r.product_id);
    const recentIds = [...new Set((recentProds || []).map((r) => r.product_id))];

    const [{ data: promoProds }, { data: recentProdRows }] = await Promise.all([
      promoIds.length > 0
        ? sb.from("products").select("*").in("id", promoIds)
        : Promise.resolve({ data: [] }),
      recentIds.length > 0
        ? sb.from("products").select("*").in("id", recentIds)
        : Promise.resolve({ data: [] }),
    ]);

    const catMap = new Map((cats || []).map((c) => [c.id, c]));

    function enrich(rows: ProductRow[]): ProductWithOffers[] {
      return rows.map((p) => {
        const offers = ((allOffers || []) as StoreProductWithStore[])
          .filter((o) => o.product_id === p.id)
          .map((o) => ({
            store_id: o.store_id,
            store_slug: o.stores?.slug ?? "",
            store_name: o.stores?.name ?? "",
            brand_color: o.stores?.brand_color ?? null,
            price: Number(o.price),
            old_price: o.old_price ? Number(o.old_price) : null,
            is_promo: o.is_promo,
            store_product_url: o.store_product_url,
          }));
        const prices = offers.map((o) => o.price);
        const cat: CategoryRow | null | undefined = p.category_id
          ? catMap.get(p.category_id)
          : null;
        return {
          id: p.id,
          slug: p.slug,
          name: p.name,
          brand: p.brand,
          volume: p.volume,
          image_url: p.image_url,
          category_id: p.category_id,
          category_name: cat?.name ?? null,
          category_slug: cat?.slug ?? null,
          offers,
          best_price: prices.length ? Math.min(...prices) : null,
          max_price: prices.length ? Math.max(...prices) : null,
        };
      });
    }

    return {
      store,
      promoProducts: enrich(promoProds || []),
      recentProducts: enrich(recentProdRows || []),
    };
  });

export const Route = createFileRoute("/store/$slug")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(
      queryOptions({
        queryKey: ["store", params.slug],
        queryFn: () => getStoreData({ data: { slug: params.slug } }),
      }),
    ),
  head: ({ params }) => ({ meta: [{ title: `${params.slug} — Ценомер` }] }),
  component: () => (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background">
          <SiteHeader compact />
          <div className="p-4">
            <ProductGridSkeleton />
          </div>
        </div>
      }
    >
      <StorePage />
    </Suspense>
  ),
});

function StorePage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(
    queryOptions({ queryKey: ["store", slug], queryFn: () => getStoreData({ data: { slug } }) }),
  );

  const { store, promoProducts, recentProducts } = data;

  if (!store) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader compact />
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
          <Store className="h-12 w-12 text-muted-foreground/30" />
          <p className="text-lg font-semibold">Магазин не найден</p>
          <Link to="/" className="text-sm text-primary hover:underline">
            ← На главную
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader compact />
      <main className="mx-auto max-w-7xl px-4 py-8">
        {/* Шапка магазина */}
        <div className="mb-8 overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
          <div className="h-2 w-full" style={{ backgroundColor: store.brand_color ?? "#888" }} />
          <div className="flex items-center gap-5 p-6">
            <div
              className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl text-2xl font-bold text-white shadow-soft"
              style={{ backgroundColor: store.brand_color ?? "#888" }}
            >
              {store.name[0]}
            </div>
            <div className="flex-1">
              <h1 className="font-display text-3xl font-bold tracking-tight">{store.name}</h1>
              {store.website && (
                <a
                  href={store.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  {store.website.replace(/^https?:\/\/(www\.)?/, "")}
                </a>
              )}
            </div>
            <Link
              to="/search"
              search={{ q: store.name }}
              className="hidden rounded-xl border border-border bg-background px-4 py-2 text-sm font-medium transition hover:bg-muted sm:inline-flex"
            >
              Все товары →
            </Link>
          </div>
        </div>

        {/* Акции */}
        {promoProducts.length > 0 && (
          <section className="mb-10">
            <div className="mb-4 flex items-center gap-2">
              <Tag className="h-5 w-5 text-promo" />
              <h2 className="font-display text-2xl font-bold tracking-tight">
                Акции в {store.name}
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
              {promoProducts.map((p, i) => (
                <ProductCard key={p.id} product={p} index={i} />
              ))}
            </div>
          </section>
        )}

        {/* Последние добавленные */}
        {recentProducts.length > 0 && (
          <section>
            <h2 className="mb-4 font-display text-2xl font-bold tracking-tight">
              Недавно обновлённые
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
              {recentProducts.map((p, i) => (
                <ProductCard key={p.id} product={p} index={i} />
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
