-- Таблица для хранения FCM-токенов устройств
CREATE TABLE public.device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'unknown', -- 'ios' | 'android' | 'web'
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, token)
);

CREATE INDEX device_tokens_user_idx ON public.device_tokens(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.device_tokens TO authenticated;
GRANT ALL ON public.device_tokens TO service_role;

ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "device_tokens self all"
  ON public.device_tokens FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Добавляем best_price в products для быстрой проверки в Edge Function
-- (денормализованное поле, обновляется при refresh-prices)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS best_price NUMERIC(10,2);

CREATE INDEX IF NOT EXISTS products_best_price_idx ON public.products(best_price);
