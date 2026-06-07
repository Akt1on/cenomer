-- ── pg_cron задачи для автоматизации ─────────────────────────────────────
-- Требует: расширение pg_cron включено в Supabase Dashboard
-- Settings → Database → Extensions → pg_cron

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 1. Обновление цен каждые 6 часов (вызывает /api/public/hooks/refresh-prices)
-- Замени URL и CRON_SECRET на свои значения
SELECT cron.schedule(
  'refresh-prices',
  '0 */6 * * *',  -- каждые 6 часов
  $$
  SELECT net.http_post(
    url     := 'https://cenomer.vercel.app/api/public/hooks/refresh-prices',
    headers := '{"Content-Type": "application/json", "x-cron-secret": "REPLACE_WITH_YOUR_CRON_SECRET"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);

-- 2. Отправка push-уведомлений сразу после обновления цен (через 5 минут)
SELECT cron.schedule(
  'send-price-alerts',
  '5 */6 * * *',  -- через 5 минут после refresh-prices
  $$
  SELECT net.http_post(
    url     := current_setting('app.supabase_url') || '/functions/v1/send-price-alerts',
    headers := ('{"Content-Type": "application/json", "Authorization": "Bearer ' ||
                current_setting('app.service_role_key') || '"}')::jsonb,
    body    := '{}'::jsonb
  );
  $$
);

-- 3. Очистка старой истории цен (старше 90 дней) — каждую ночь в 3:00
SELECT cron.schedule(
  'cleanup-price-history',
  '0 3 * * *',
  $$
  DELETE FROM public.price_history
  WHERE recorded_at < now() - interval '90 days';
  $$
);

-- 4. Обновление денормализованного best_price в products после refresh
SELECT cron.schedule(
  'update-best-prices',
  '15 */6 * * *',  -- через 15 минут после refresh
  $$
  UPDATE public.products p
  SET best_price = (
    SELECT MIN(sp.price)
    FROM public.store_products sp
    WHERE sp.product_id = p.id AND sp.in_stock = true
  );
  $$
);

-- Просмотр всех задач:
-- SELECT * FROM cron.job;

-- Удаление задачи:
-- SELECT cron.unschedule('refresh-prices');

-- 5. Еженедельный email-дайджест (воскресенье 10:00 МСК)
SELECT cron.schedule(
  'weekly-digest',
  '0 7 * * 0',  -- 10:00 МСК = 07:00 UTC
  $$
  SELECT net.http_post(
    url     := current_setting('app.supabase_url') || '/functions/v1/weekly-digest',
    headers := ('{"Content-Type": "application/json", "Authorization": "Bearer ' ||
                current_setting('app.service_role_key') || '"}')::jsonb,
    body    := '{}'::jsonb
  );
  $$
);

-- 6. Деактивация истёкших Premium подписок — каждый день в 01:00
SELECT cron.schedule(
  'expire-subscriptions',
  '0 1 * * *',
  $$
  UPDATE public.subscriptions
  SET plan = 'free'
  WHERE expires_at < now() AND plan != 'free';
  $$
);
