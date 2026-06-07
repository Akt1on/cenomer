-- ✅ Вспомогательные RPC функции

-- RPC для send-price-alerts: получение актуального MIN(price) по товару
-- Используется как вспомогательная функция, основная логика в Edge Function.

-- RPC: проверка исторического минимума (используется в send-price-alerts)
CREATE OR REPLACE FUNCTION is_price_historical_min(
  p_product_id uuid,
  p_current_price numeric,
  p_days int DEFAULT 30
)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT p_current_price <= COALESCE(
    (SELECT MIN(price)
     FROM price_history
     WHERE product_id = p_product_id
       AND recorded_at >= now() - (p_days || ' days')::interval),
    p_current_price
  );
$$;

-- RPC: текущая минимальная цена товара из store_products
CREATE OR REPLACE FUNCTION get_product_best_price(p_product_id uuid)
RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT MIN(price)
  FROM store_products
  WHERE product_id = p_product_id
    AND in_stock = true;
$$;
