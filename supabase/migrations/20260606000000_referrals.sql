-- ── Реферальная программа ────────────────────────────────────────────────

-- Таблица реферальных кодов
CREATE TABLE public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,           -- уникальный код пользователя (6 символов)
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,  -- кто пригласил
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX referrals_user_idx ON public.referrals(user_id);
CREATE INDEX referrals_code_idx ON public.referrals(code);

-- Таблица начисленных бонусов
CREATE TABLE public.referral_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,  -- кто получил бонус
  referred_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,  -- кто зарегистрировался
  reward_type TEXT NOT NULL DEFAULT 'premium_month',  -- тип награды
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  UNIQUE (referrer_id, referred_id)
);

-- Подписки пользователей (Premium)
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'free',           -- 'free' | 'premium'
  source TEXT DEFAULT 'manual',                -- 'referral' | 'payment' | 'manual'
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,                      -- NULL = бессрочно
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX subscriptions_user_idx ON public.subscriptions(user_id);
CREATE INDEX subscriptions_expires_idx ON public.subscriptions(expires_at);

-- RLS
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "referrals self read" ON public.referrals FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "referrals self insert" ON public.referrals FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "subscriptions self read" ON public.subscriptions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "referral_rewards self read" ON public.referral_rewards FOR SELECT TO authenticated USING (auth.uid() = referrer_id);

GRANT SELECT, INSERT ON public.referrals TO authenticated;
GRANT SELECT ON public.referral_rewards TO authenticated;
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.referrals, public.referral_rewards, public.subscriptions TO service_role;

-- Функция: генерация уникального кода при регистрации пользователя
CREATE OR REPLACE FUNCTION public.create_referral_code()
RETURNS TRIGGER AS $$
DECLARE
  new_code TEXT;
  attempts INT := 0;
BEGIN
  LOOP
    -- 6-символьный код из букв и цифр
    new_code := upper(substring(md5(random()::text || NEW.id::text) FROM 1 FOR 6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.referrals WHERE code = new_code);
    attempts := attempts + 1;
    EXIT WHEN attempts > 10;
  END LOOP;

  INSERT INTO public.referrals (user_id, code)
  VALUES (NEW.id, new_code)
  ON CONFLICT (user_id) DO NOTHING;

  -- Создаём базовую подписку free
  INSERT INTO public.subscriptions (user_id, plan)
  VALUES (NEW.id, 'free')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_referral_code();

-- Функция: активация реферального кода
CREATE OR REPLACE FUNCTION public.activate_referral(referral_code TEXT)
RETURNS JSONB AS $$
DECLARE
  referrer_id UUID;
  current_user_id UUID := auth.uid();
BEGIN
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  -- Ищем владельца кода
  SELECT user_id INTO referrer_id FROM public.referrals WHERE code = upper(referral_code);

  IF referrer_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Код не найден');
  END IF;

  IF referrer_id = current_user_id THEN
    RETURN jsonb_build_object('error', 'Нельзя использовать свой код');
  END IF;

  -- Проверяем что ещё не использовал реферальный код
  IF EXISTS (SELECT 1 FROM public.referrals WHERE user_id = current_user_id AND invited_by IS NOT NULL) THEN
    RETURN jsonb_build_object('error', 'Реферальный код уже был активирован');
  END IF;

  -- Обновляем referred пользователя
  UPDATE public.referrals SET invited_by = referrer_id WHERE user_id = current_user_id;

  -- Даём Premium на месяц рефереру
  INSERT INTO public.referral_rewards (referrer_id, referred_id, reward_type, expires_at)
  VALUES (referrer_id, current_user_id, 'premium_month', now() + interval '30 days')
  ON CONFLICT (referrer_id, referred_id) DO NOTHING;

  UPDATE public.subscriptions
  SET plan = 'premium',
      source = 'referral',
      expires_at = GREATEST(expires_at, now()) + interval '30 days'
  WHERE user_id = referrer_id;

  -- Новому пользователю тоже 7 дней Premium
  UPDATE public.subscriptions
  SET plan = 'premium',
      source = 'referral',
      expires_at = now() + interval '7 days'
  WHERE user_id = current_user_id;

  RETURN jsonb_build_object('ok', true, 'message', 'Реферальный код активирован! Вы получили 7 дней Premium.');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
