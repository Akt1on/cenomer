import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ShoppingBasket, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { getPlatform } from "@/hooks/use-native";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Вход — Ценомер" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState<"email" | "google" | "apple" | null>(null);
  const platform = getPlatform();
  const isIos = platform === "ios";

  useEffect(() => { if (user) navigate({ to: "/" }); }, [user]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading("email");
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("С возвращением!");
      } else {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Аккаунт создан — проверьте почту");
      }
      navigate({ to: "/" });
    } catch (err: any) {
      toast.error(err.message ?? "Что-то пошло не так");
    } finally { setLoading(null); }
  }

  async function onGoogle() {
    setLoading("google");
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) { toast.error("Не удалось войти через Google"); setLoading(null); return; }
    if (result.redirected) return;
    navigate({ to: "/" });
  }

  async function onApple() {
    setLoading("apple");
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "apple",
        options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
    } catch (err: any) {
      toast.error("Не удалось войти через Apple");
      setLoading(null);
    }
  }

  const isLoading = loading !== null;

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-soft">
            <ShoppingBasket className="h-5 w-5" />
          </div>
          <span className="font-display text-xl font-bold">Ценомер</span>
        </Link>

        <div className="rounded-3xl border border-border bg-card p-6 shadow-lift sm:p-8">
          <h1 className="font-display text-2xl font-bold tracking-tight">
            {mode === "login" ? "Вход" : "Регистрация"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "login" ? "Войдите, чтобы сохранять избранное и получать уведомления о ценах" : "Создайте аккаунт за минуту"}
          </p>

          {/* OAuth кнопки */}
          <div className="mt-5 space-y-2">
            <button onClick={onGoogle} disabled={isLoading}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium shadow-soft transition hover:bg-muted disabled:opacity-60">
              {loading === "google" ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                <svg className="h-5 w-5" viewBox="0 0 48 48">
                  <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8a12 12 0 1 1 0-24c3 0 5.8 1.1 7.9 3l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
                  <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
                  <path fill="#4CAF50" d="M24 44c5.4 0 10.3-2 14-5.4l-6.5-5.3c-2 1.4-4.6 2.3-7.5 2.3-5.3 0-9.7-3.4-11.3-8l-6.5 5C9.6 39.6 16.2 44 24 44z"/>
                  <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.7 2.2-2.1 4.1-3.8 5.4l6.5 5.3C42 35 44 30 44 24c0-1.3-.1-2.4-.4-3.5z"/>
                </svg>
              )}
              Войти через Google
            </button>

            {/* Apple Sign In — только на iOS (требование Apple) */}
            {isIos && (
              <button onClick={onApple} disabled={isLoading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-black px-4 py-2.5 text-sm font-medium text-white shadow-soft transition hover:bg-neutral-800 disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-neutral-200">
                {loading === "apple" ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                  </svg>
                )}
                Войти через Apple
              </button>
            )}
          </div>

          <div className="my-5 flex items-center gap-2 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> или <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={onSubmit} className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Email</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="you@example.com" autoComplete="email" inputMode="email" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Пароль</label>
              <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="••••••••" autoComplete={mode === "login" ? "current-password" : "new-password"} />
            </div>
            <button type="submit" disabled={isLoading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground shadow-soft transition hover:opacity-90 disabled:opacity-60">
              {loading === "email" && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading === "email" ? "Минутку…" : mode === "login" ? "Войти" : "Создать аккаунт"}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-muted-foreground">
            {mode === "login" ? "Нет аккаунта?" : "Уже есть аккаунт?"}{" "}
            <button type="button" onClick={() => setMode(mode === "login" ? "signup" : "login")}
              className="font-medium text-primary hover:underline">
              {mode === "login" ? "Зарегистрироваться" : "Войти"}
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
