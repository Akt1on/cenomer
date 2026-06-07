-- ✅ FIX 4.1: таблица статистики поисковых запросов
-- Используется SearchBar для отображения реальных топ-запросов вместо захардкоженных.

CREATE TABLE IF NOT EXISTS search_stats (
  query       text        PRIMARY KEY,
  count       int         NOT NULL DEFAULT 1,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- RLS: только сервер пишет, все читают
ALTER TABLE search_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "search_stats_read" ON search_stats
  FOR SELECT USING (true);

CREATE POLICY "search_stats_service_write" ON search_stats
  FOR ALL USING (auth.role() = 'service_role');

-- Индекс для быстрой сортировки по count
CREATE INDEX IF NOT EXISTS search_stats_count_idx ON search_stats (count DESC);

-- RPC: инкремент счётчика (atomic upsert)
CREATE OR REPLACE FUNCTION increment_search_stat(search_query text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  INSERT INTO search_stats (query, count, updated_at)
  VALUES (lower(trim(search_query)), 1, now())
  ON CONFLICT (query)
  DO UPDATE SET
    count      = search_stats.count + 1,
    updated_at = now();
$$;

-- RPC: топ запросов
CREATE OR REPLACE FUNCTION get_top_searches(lim int DEFAULT 8)
RETURNS TABLE (query text, count int)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT query, count
  FROM search_stats
  WHERE updated_at > now() - interval '30 days'
  ORDER BY count DESC
  LIMIT lim;
$$;
