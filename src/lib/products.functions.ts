/**
 * Серверные функции для работы с товарами и ценами.
 *
 * ✅ FIX N+1: searchProducts — один JOIN-запрос
 * ✅ FIX 3.2: getHomeData — один вызов attachOffers для promoIds + allProducts
 * ✅ FIX 4.1: getTopSearches + логирование поисков в search_stats
 */
import { createServerFn } from "@tanstack/react-start";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

// ── Синглтон клиента ───────────────────────────────────────────────────────
let _sbInstance: SupabaseClient<Database> | null = null;

function getServerSupabase(): SupabaseClient<Database> {
  if (_sbInstance) return _sbInstance;
  const url = process.env.SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars are not set");
  _sbInstance = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _sbInstance;
}
// ──────────────────────────────────────────────────────────────────────────

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
  // ℹ️ best_price / max_price вычисляются из offers, их нет в БД
  best_price: number | null;
  max_price: number | null;
};

// ── attachOffers: batch-вариант для getProductBySlug / getHomeData ─────────
async function attachOffers(productRows: any[]): Promise<ProductWithOffers[]> {
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

function applyTextSearch(query: any, q: string) {
  return query.ilike("search_text", `%${q.trim().toLowerCase()}%`);
}

export const PAGE_SIZE = 24;

// ── searchProducts ──────────────────────────────────────────────────────────
export const searchProducts = createServerFn({ method: "GET" })
  .inputValidator(
    (input: {
      q?: string;
      category?: string;
      promoOnly?: boolean;
      sort?: "price" | "discount" | "name";
      page?: number;
    }) =>
      z
        .object({
          q: z.string().optional(),
          category: z.string().optional(),
          promoOnly: z.boolean().optional(),
          sort: z.enum(["price", "discount", "name"]).optional(),
          page: z.number().int().min(1).optional(),
        })
        .parse(input)
  )
  .handler(async ({ data }) => {
    const sb = getServerSupabase();
    const page = data.page ?? 1;
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    // ✅ FIX 4.1: логируем поисковый запрос в search_stats (fire-and-forget)
    if (data.q?.trim()) {
      const q = data.q.trim().toLowerCase();
      sb.from("search_stats" as any)
        .upsert({ query: q, count: 1, updated_at: new Date().toISOString() }, {
          onConflict: "query",
          ignoreDuplicates: false,
        })
        // Supabase не поддерживает INCREMENT в upsert — используем RPC если есть,
        // иначе просто insert с on conflict update через raw SQL через rpc
        .then(() => {
          // Пробуем инкремент через отдельный update (best-effort)
          sb.rpc("increment_search_stat" as any, { search_query: q }).catch(() => {});
        })
        .catch(() => {}); // fire-and-forget, не блокируем ответ
    }

    let query = sb
      .from("products")
      .select(
        `
        *,
        categories(id, name, slug),
        store_products(
          price, old_price, is_promo, store_product_url, store_id,
          stores(id, slug, name, brand_color)
        )
      `,
        { count: "exact" }
      )
      .range(from, to);

    if (data.q?.trim()) {
      query = applyTextSearch(query, data.q);
    }

    if (data.category) {
      query = query.eq("categories.slug", data.category).not("categories", "is", null);
    }

    if (data.promoOnly) {
      query = query.eq("store_products.is_promo", true).not("store_products", "is", null);
    }

    // ✅ FIX 2.2: при promoOnly фильтр через JOIN не даёт точный count.
    // Supabase считает count до разворачивания вложенных joins.
    // Делаем отдельный count-запрос с теми же фильтрами.
    let exactCount: number | null = null;
    if (data.promoOnly) {
      let countQ = sb
        .from("store_products")
        .select("product_id", { count: "exact", head: true })
        .eq("is_promo", true);
      if (data.q?.trim()) {
        // Нужна связь с products.search_text — используем отдельный подзапрос через RPC или приблизительный счёт
        // Supabase не поддерживает подзапросы в select(), поэтому считаем приблизительно:
        // сначала получаем product_ids по search, потом считаем пересечение
        const { data: matchingIds } = await sb
          .from("products")
          .select("id")
          .ilike("search_text", `%${data.q.trim().toLowerCase()}%`);
        if (matchingIds) {
          const ids = matchingIds.map((r: any) => r.id);
          countQ = countQ.in("product_id", ids);
        }
      }
      const { count: c } = await countQ;
      exactCount = c;
    }

    const { data: rows, error, count } = await query;
    if (error) throw new Error(error.message);

    const products: ProductWithOffers[] = (rows || []).map((p: any) => {
      const cat = p.categories;
      const productOffers: StoreOffer[] = (p.store_products || [])
        .filter((sp: any) => sp.stores)
        .map((sp: any) => ({
          store_id: sp.store_id,
          store_slug: sp.stores?.slug ?? "",
          store_name: sp.stores?.name ?? "",
          brand_color: sp.stores?.brand_color ?? null,
          price: Number(sp.price),
          old_price: sp.old_price != null ? Number(sp.old_price) : null,
          is_promo: sp.is_promo,
          store_product_url: sp.store_product_url,
        }))
        .sort((a: StoreOffer, b: StoreOffer) => a.price - b.price);

      const prices = productOffers.map((o) => o.price);
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

    return { products, total: (data.promoOnly ? exactCount : count) ?? 0, page, pageSize: PAGE_SIZE };
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

// ✅ FIX 3.2: один вызов attachOffers для promoIds + allProducts вместо двух
export const getHomeData = createServerFn({ method: "GET" }).handler(async () => {
  const sb = getServerSupabase();

  const [{ data: categories }, { data: promoStoreProducts }, { data: allProductRows }] =
    await Promise.all([
      sb.from("categories").select("*").order("sort_order"),
      sb.from("store_products").select("product_id").eq("is_promo", true).limit(40),
      sb.from("products").select("*").limit(12),
    ]);

  const promoIds = [...new Set((promoStoreProducts || []).map((r) => r.product_id))];

  // Промо-товары
  const promoProductRows = promoIds.length > 0
    ? (await sb.from("products").select("*").in("id", promoIds.slice(0, 20))).data ?? []
    : [];

  // ✅ FIX 3.2: собираем все уникальные id и вызываем attachOffers ОДИН раз
  const allProductIds = [...new Set([...promoIds.slice(0, 20), ...(allProductRows || []).map((p) => p.id)])];
  const allRows = [
    ...promoProductRows,
    ...(allProductRows || []).filter((p) => !promoIds.includes(p.id)),
  ];

  const enriched = await attachOffers(allRows);

  // Разбиваем результат на deals и recent
  const promoIdSet = new Set(promoIds);
  const enrichedMap = new Map(enriched.map((p) => [p.id, p]));

  const deals = promoProductRows
    .map((p) => enrichedMap.get(p.id))
    .filter((p): p is ProductWithOffers => !!p && p.offers.some((o) => o.is_promo))
    .sort((a, b) => {
      const ad = a.max_price && a.best_price ? (a.max_price - a.best_price) / a.max_price : 0;
      const bd = b.max_price && b.best_price ? (b.max_price - b.best_price) / b.max_price : 0;
      return bd - ad;
    })
    .slice(0, 8);

  const recent = (allProductRows || [])
    .map((p) => enrichedMap.get(p.id))
    .filter((p): p is ProductWithOffers => !!p);

  return { categories: categories || [], deals, recent };
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

// ✅ FIX 4.1: топ поисковых запросов из БД
export const getTopSearches = createServerFn({ method: "GET" }).handler(async () => {
  const sb = getServerSupabase();
  try {
    const { data } = await sb.rpc("get_top_searches" as any, { lim: 8 });
    return { queries: (data as any[] ?? []).map((r: any) => r.query as string) };
  } catch {
    return { queries: [] };
  }
});

// ── getFavoriteProducts (задача 2.1) ──────────────────────────────────────
// Серверная функция для загрузки избранного с тем же JOIN что в searchProducts.
// Заменяет 3 параллельных клиентских запроса в favorites.tsx.
export const getFavoriteProducts = createServerFn({ method: "GET" })
  .inputValidator((input: { ids: string[] }) =>
    z.object({ ids: z.array(z.string().uuid()) }).parse(input)
  )
  .handler(async ({ data }) => {
    if (data.ids.length === 0) return { products: [], alerts: [] };
    const sb = getServerSupabase();

    // Один JOIN-запрос: products + store_products + stores + categories
    const { data: rows, error } = await sb
      .from("products")
      .select(
        `*,
         categories(id, name, slug),
         store_products(
           price, old_price, is_promo, store_product_url, store_id,
           stores(id, slug, name, brand_color)
         )`
      )
      .in("id", data.ids);

    if (error) throw new Error(error.message);

    const products: ProductWithOffers[] = (rows || []).map((p: any) => {
      const cat = p.categories;
      const productOffers: StoreOffer[] = (p.store_products || [])
        .filter((sp: any) => sp.stores)
        .map((sp: any) => ({
          store_id: sp.store_id,
          store_slug: sp.stores?.slug ?? "",
          store_name: sp.stores?.name ?? "",
          brand_color: sp.stores?.brand_color ?? null,
          price: Number(sp.price),
          old_price: sp.old_price != null ? Number(sp.old_price) : null,
          is_promo: sp.is_promo,
          store_product_url: sp.store_product_url,
        }))
        .sort((a: StoreOffer, b: StoreOffer) => a.price - b.price);

      const prices = productOffers.map((o) => o.price);
      return {
        id: p.id, slug: p.slug, name: p.name, brand: p.brand, volume: p.volume,
        image_url: p.image_url, category_id: p.category_id,
        category_name: cat?.name ?? null, category_slug: cat?.slug ?? null,
        offers: productOffers,
        best_price: prices.length ? Math.min(...prices) : null,
        max_price: prices.length ? Math.max(...prices) : null,
      };
    });

    return { products };
  });
