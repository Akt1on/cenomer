/**
 * Серверные функции для работы с товарами и ценами.
 * Используют публичный supabase-клиент через RLS (всё доступно для чтения).
 */
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

function getServerSupabase() {
  const url = process.env.SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  return createClient<Database>(url!, key!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type StoreOffer = {
  store_id: string;
  store_slug: string;
  store_name: string;
  brand_color: string | null;
  price: number;
  old_price: number | null;
  is_promo: boolean;
  store_product_url: string | null;
};

export type ProductWithOffers = {
  id: string;
  slug: string;
  name: string;
  brand: string | null;
  volume: string | null;
  image_url: string | null;
  category_id: string | null;
  category_name: string | null;
  category_slug: string | null;
  offers: StoreOffer[];
  best_price: number | null;
  max_price: number | null;
};

async function attachOffers(
  productRows: Database["public"]["Tables"]["products"]["Row"][],
): Promise<ProductWithOffers[]> {
  if (productRows.length === 0) return [];
  const sb = getServerSupabase();
  const ids = productRows.map((p) => p.id);
  const [{ data: offers }, { data: stores }, { data: cats }] = await Promise.all([
    sb.from("store_products").select("*").in("product_id", ids),
    sb.from("stores").select("*"),
    sb.from("categories").select("*"),
  ]);
  const storeMap = new Map((stores || []).map((s) => [s.id, s]));
  const catMap = new Map((cats || []).map((c) => [c.id, c]));
  return productRows.map((p) => {
    const productOffers: StoreOffer[] = (offers || [])
      .filter((o) => o.product_id === p.id)
      .map((o) => {
        const s = storeMap.get(o.store_id)!;
        return {
          store_id: o.store_id,
          store_slug: s?.slug ?? "",
          store_name: s?.name ?? "",
          brand_color: s?.brand_color ?? null,
          price: Number(o.price),
          old_price: o.old_price != null ? Number(o.old_price) : null,
          is_promo: o.is_promo,
          store_product_url: o.store_product_url,
        };
      })
      .sort((a, b) => a.price - b.price);
    const prices = productOffers.map((o) => o.price);
    const cat = p.category_id ? catMap.get(p.category_id) : null;
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
      offers: productOffers,
      best_price: prices.length ? Math.min(...prices) : null,
      max_price: prices.length ? Math.max(...prices) : null,
    };
  });
}

export const searchProducts = createServerFn({ method: "GET" })
  .inputValidator(
    (input: {
      q?: string;
      category?: string;
      promoOnly?: boolean;
      sort?: "price" | "discount" | "popular";
    }) =>
      z
        .object({
          q: z.string().optional(),
          category: z.string().optional(),
          promoOnly: z.boolean().optional(),
          sort: z.enum(["price", "discount", "popular"]).optional(),
        })
        .parse(input),
  )
  .handler(async ({ data }) => {
    const sb = getServerSupabase();
    let query = sb.from("products").select("*").limit(60);
    if (data.q && data.q.trim()) {
      query = query.ilike("search_text", `%${data.q.trim().toLowerCase()}%`);
    }
    if (data.category) {
      const { data: cat } = await sb
        .from("categories")
        .select("id")
        .eq("slug", data.category)
        .maybeSingle();
      if (cat) query = query.eq("category_id", cat.id);
    }
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    let products = await attachOffers(rows || []);
    if (data.promoOnly) {
      products = products.filter((p) => p.offers.some((o) => o.is_promo));
    }
    const sort = data.sort ?? "price";
    products.sort((a, b) => {
      if (sort === "price") return (a.best_price ?? 1e9) - (b.best_price ?? 1e9);
      if (sort === "discount") {
        const ad = a.max_price && a.best_price ? a.max_price - a.best_price : 0;
        const bd = b.max_price && b.best_price ? b.max_price - b.best_price : 0;
        return bd - ad;
      }
      return a.name.localeCompare(b.name, "ru");
    });
    return { products };
  });

export const getProductBySlug = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => z.object({ slug: z.string() }).parse(input))
  .handler(async ({ data }) => {
    const sb = getServerSupabase();
    const { data: row, error } = await sb
      .from("products")
      .select("*")
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return { product: null, history: [] };
    const [products, history] = await Promise.all([
      attachOffers([row]),
      sb
        .from("price_history")
        .select("price, recorded_at, store_id")
        .eq("product_id", row.id)
        .gte("recorded_at", new Date(Date.now() - 30 * 24 * 3600_000).toISOString())
        .order("recorded_at", { ascending: true }),
    ]);
    return {
      product: products[0],
      history: (history.data || []).map((h) => ({
        price: Number(h.price),
        recorded_at: h.recorded_at,
        store_id: h.store_id,
      })),
    };
  });

export const getHomeData = createServerFn({ method: "GET" }).handler(async () => {
  const sb = getServerSupabase();
  const [{ data: categories }, { data: allProducts }] = await Promise.all([
    sb.from("categories").select("*").order("sort_order"),
    sb.from("products").select("*").limit(40),
  ]);
  const enriched = await attachOffers(allProducts || []);
  const deals = enriched
    .filter((p) => p.offers.some((o) => o.is_promo))
    .sort((a, b) => {
      const ad = a.max_price && a.best_price ? (a.max_price - a.best_price) / a.max_price : 0;
      const bd = b.max_price && b.best_price ? (b.max_price - b.best_price) / b.max_price : 0;
      return bd - ad;
    })
    .slice(0, 8);
  return { categories: categories || [], deals };
});

export const autocompleteProducts = createServerFn({ method: "GET" })
  .inputValidator((input: { q: string }) => z.object({ q: z.string() }).parse(input))
  .handler(async ({ data }) => {
    if (!data.q.trim()) return { items: [] };
    const sb = getServerSupabase();
    const { data: rows } = await sb
      .from("products")
      .select("id, slug, name, brand, volume, image_url")
      .ilike("search_text", `%${data.q.trim().toLowerCase()}%`)
      .limit(8);
    return { items: rows || [] };
  });
