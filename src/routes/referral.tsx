import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Gift, Copy, Check, Users, Crown, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { SiteHeader } from "@/components/SiteHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { hapticSuccess, hapticLight, shareProduct } from "@/hooks/use-native";
import { toast } from "sonner";

export const Route = createFileRoute("/referral")({
  head: () => ({ meta: [{ title: "Пригласи друга — Ценомер" }] }),
  component: ReferralPage,
});

interface ReferralData {
  code: string;
  invited_count: number;
  plan: string;
  expires_at: string | null;
}

function ReferralPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [promoInput, setPromoInput] = useState("");
  const [activating, setActivating] = useState(false);

  // ✅ FIX 2.3: редирект незалогиненных вместо вечного спиннера
  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth" });
  }, [user, authLoading]);

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  async function loadData() {
    setLoading(true);
    const [{ data: ref }, { data: sub }, { data: rewards }] = await Promise.all([
      supabase.from("referrals").select("code").eq("user_id", user!.id).maybeSingle(),
      supabase
        .from("subscriptions")
        .select("plan, expires_at")
        .eq("user_id", user!.id)
        .maybeSingle(),
      supabase.from("referral_rewards").select("id").eq("referrer_id", user!.id),
    ]);
    setData({
      code: ref?.code ?? "------",
      invited_count: rewards?.length ?? 0,
      plan: sub?.plan ?? "free",
      expires_at: sub?.expires_at ?? null,
    });
    setLoading(false);
  }

  async function copyLink() {
    if (!data) return;
    const link = `${window.location.origin}/?ref=${data.code}`;
    await navigator.clipboard.writeText(link);
    hapticSuccess();
    setCopied(true);
    toast.success("Ссылка скопирована!");
    setTimeout(() => setCopied(false), 2000);
  }

  async function shareLink() {
    if (!data) return;
    const link = `${window.location.origin}/?ref=${data.code}`;
    await shareProduct("Ценомер — сравни цены на продукты", link);
  }

  async function activateCode() {
    if (!promoInput.trim()) return;
    setActivating(true);
    try {
      const { data: result, error } = await supabase.rpc("activate_referral", {
        referral_code: promoInput.trim().toUpperCase(),
      });
      if (error) throw error;
      const payload =
        result && typeof result === "object" && !Array.isArray(result)
          ? (result as { error?: string; message?: string })
          : null;
      if (payload?.error) {
        toast.error(payload.error);
      } else {
        hapticSuccess();
        toast.success(payload?.message ?? "Код активирован!");
        setPromoInput("");
        await loadData();
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Ошибка активации");
    } finally {
      setActivating(false);
    }
  }

  const isPremium = data?.plan === "premium";
  const referralLink = data ? `${window.location.origin}/?ref=${data.code}` : "";

  // Пока авторизация проверяется — показываем спиннер
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader compact />
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader compact />
      <main className="mx-auto max-w-2xl px-4 py-10">
        {/* Заголовок */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-primary/10">
            <Gift className="h-8 w-8 text-primary" />
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Пригласи друга</h1>
          <p className="mt-2 text-muted-foreground">
            За каждого приглашённого — месяц Premium. Другу — 7 дней бесплатно.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Статус подписки */}
            {isPremium && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 rounded-2xl border border-yellow-200 bg-yellow-50 px-4 py-3 dark:border-yellow-900/50 dark:bg-yellow-900/20"
              >
                <Crown className="h-5 w-5 text-yellow-500" />
                <div>
                  <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-300">
                    Premium активен
                  </p>
                  {data?.expires_at && (
                    <p className="text-xs text-yellow-600 dark:text-yellow-400">
                      До {new Date(data.expires_at).toLocaleDateString("ru-RU")}
                    </p>
                  )}
                </div>
              </motion.div>
            )}

            {/* Твой код и ссылка */}
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
              <div className="border-b border-border px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Твоя реферальная ссылка
                </p>
                <div className="mt-3 flex items-center gap-2 rounded-xl bg-muted px-4 py-3">
                  <code className="min-w-0 flex-1 truncate text-sm font-mono">{referralLink}</code>
                  <button
                    onClick={copyLink}
                    className="shrink-0 grid h-8 w-8 place-items-center rounded-lg bg-card text-muted-foreground transition hover:text-primary"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-success" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 divide-x divide-border">
                <button
                  onClick={copyLink}
                  className="flex items-center justify-center gap-2 py-3 text-sm font-medium transition hover:bg-muted"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-success" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  Скопировать
                </button>
                <button
                  onClick={shareLink}
                  className="flex items-center justify-center gap-2 py-3 text-sm font-medium transition hover:bg-muted"
                >
                  <Gift className="h-4 w-4" /> Поделиться
                </button>
              </div>
            </div>

            {/* Статистика */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-border bg-card px-4 py-5 text-center shadow-soft">
                <Users className="mx-auto mb-1 h-6 w-6 text-primary" />
                <p className="font-display text-3xl font-bold">{data?.invited_count ?? 0}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">Приглашено друзей</p>
              </div>
              <div className="rounded-2xl border border-border bg-card px-4 py-5 text-center shadow-soft">
                <Crown className="mx-auto mb-1 h-6 w-6 text-yellow-500" />
                <p className="font-display text-3xl font-bold">{data?.invited_count ?? 0}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">Месяцев Premium</p>
              </div>
            </div>

            {/* Активация чужого кода */}
            <div className="rounded-2xl border border-border bg-card px-5 py-4 shadow-soft">
              <p className="mb-3 text-sm font-semibold">Есть реферальный код?</p>
              <div className="flex gap-2">
                <input
                  value={promoInput}
                  onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                  placeholder="ABCD12"
                  maxLength={6}
                  className="flex-1 rounded-xl border border-border bg-background px-3 py-2.5 text-center font-mono text-lg font-bold uppercase tracking-widest outline-none focus:ring-2 focus:ring-primary/30"
                />
                <button
                  onClick={activateCode}
                  disabled={activating || promoInput.length < 6}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
                >
                  {activating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Активировать"}
                </button>
              </div>
            </div>

            {/* Правила */}
            <div className="rounded-2xl border border-border bg-muted/50 px-5 py-4 text-sm text-muted-foreground">
              <p className="mb-2 font-medium text-foreground">Как это работает</p>
              <ol className="list-decimal space-y-1.5 pl-4">
                <li>Поделись своей ссылкой с другом</li>
                <li>
                  Друг регистрируется по ссылке и получает <strong>7 дней Premium</strong>
                </li>
                <li>
                  Ты получаешь <strong>месяц Premium</strong> за каждого приглашённого
                </li>
                <li>Бонусы суммируются — пригласи 12 друзей, получи год Premium</li>
              </ol>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
