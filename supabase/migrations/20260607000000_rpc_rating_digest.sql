-- ============================================================
-- Migration: RPC functions for rating page and weekly digest
-- File: supabase/migrations/20260607000000_rpc_rating_digest.sql
-- ============================================================

-- ─── 1. get_store_rating ──────────────────────────────────────────────────
-- Используется в rating.tsx вместо загрузки всей price_history в Node.js.
-- Возвращает агрегаты GROUP BY store_id, category_id.
-- Раньше: SELECT price_history (миллионы строк) → Node.js → JS-агрегация
-- Теперь:  PostgreSQL возвращает только N_stores × N_categories строк.

CREATE OR REPLACE FUNCTION get_store_rating(days int DEFAULT 30)
RETURNS TABLE (
  store_id    uuid,
  category_id uuid,
  avg_price   numeric,
  cnt         bigint
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    ph.store_id,
    p.category_id,
    ROUND(AVG(ph.price)::numeric, 2) AS avg_price,
    COUNT(*)                          AS cnt
  FROM price_history ph
  JOIN products p ON p.id = ph.product_id
  WHERE ph.recorded_at >= NOW() - (days || ' days')::interval
  GROUP BY ph.store_id, p.category_id;
$$;

-- Индекс для ускорения фильтра по recorded_at (если ещё не существует)
CREATE INDEX IF NOT EXISTS price_history_recorded_at_idx
  ON price_history (recorded_at DESC);


-- ─── 2. get_weekly_deals ─────────────────────────────────────────────────
-- Используется в weekly-digest Edge Function.
-- Раньше: SELECT products WHERE best_price IS NOT NULL
--   → ошибка: колонка best_price не существует в схеме БД
-- Теперь: MIN(sp.price) вычисляется в SQL через JOIN store_products.

CREATE OR REPLACE FUNCTION get_weekly_deals(lim int DEFAULT 8)
RETURNS TABLE (
  id          uuid,
  slug        text,
  name        text,
  image_url   text,
  best_price  numeric,
  max_price   numeric
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    p.id,
    p.slug,
    p.name,
    p.image_url,
    MIN(sp.price)      AS best_price,
    MAX(sp.old_price)  AS max_price
  FROM products p
  JOIN store_products sp
    ON sp.product_id = p.id
   AND sp.is_promo = true
   AND sp.in_stock = true
  GROUP BY p.id, p.slug, p.name, p.image_url
  ORDER BY MIN(sp.price) ASC
  LIMIT lim;
$$;

-- Индекс для фильтра is_promo (если ещё не существует)
CREATE INDEX IF NOT EXISTS store_products_is_promo_idx
  ON store_products (is_promo)
  WHERE is_promo = true;
