# Полное руководство по оптимизации Supabase для Ценомер

## Стратегия для бесплатного тарифа (500 МБ)

1. **Инкрементальный скрапинг** - обновлять только изменившиеся цены
2. **История цен только при изменении**
3. **Автоочистка старых записей** (10-14 дней)
4. **Индексы и VACUUM**

## SQL для Supabase (выполнить в SQL Editor)

```sql
-- Таблица price_history если нет
CREATE TABLE IF NOT EXISTS price_history (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    product_id UUID REFERENCES products(id),
    store_id UUID REFERENCES stores(id),
    price NUMERIC(10,2),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Триггер для записи только при изменении цены
CREATE OR REPLACE FUNCTION log_price_change()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.price IS DISTINCT FROM OLD.price THEN
        INSERT INTO price_history (product_id, store_id, price)
        VALUES (NEW.product_id, NEW.store_id, NEW.price);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Применить триггер
DROP TRIGGER IF EXISTS price_change_trigger ON store_products;
CREATE TRIGGER price_change_trigger
AFTER UPDATE ON store_products
FOR EACH ROW EXECUTE FUNCTION log_price_change();

-- Автоочистка (требует pg_cron extension)
SELECT cron.schedule('clean-old-prices', '0 3 * * *', 
    'DELETE FROM price_history WHERE created_at < NOW() - INTERVAL \'14 days\';');

-- Индексы
CREATE INDEX IF NOT EXISTS idx_canonical_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_store_product ON store_products(product_id, store_id);
CREATE INDEX IF NOT EXISTS idx_price ON store_products(price);

-- Рекомендация: запускать VACUUM ANALYZE; раз в неделю
```

## Рекомендации
- Запускать quick mode ежедневно
- Full mode раз в 3 дня
- Мониторить размер БД в Supabase Dashboard
- Использовать --dry-run для тестирования

Это гарантирует, что приложение работает идеально, данные актуальны, а тариф остаётся бесплатным.