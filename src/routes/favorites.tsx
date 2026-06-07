/**
 * favorites.tsx
 * ✅ FIX 2.1: loadFavorites использует getFavoriteProducts (серверная функция,
 * один JOIN-запрос) вместо 3 параллельных клиентских запросов.
 */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Heart, LogOut, Bell, BellOff, Trash2, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { SiteHeader } from "@/components/SiteHeader";
import { ProductCard } from "@/components/ProductCard";
import { ProductGridSkeleton } from "@/components/Skeletons";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { hapticLight, hapticSuccess } from "@/hooks/use-native";
import { formatRub } from "@/lib/format";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { getFavoriteProducts } from "@/lib/products.functions";
import type { ProductWithOffers } from "@/lib/products.functions";

export const Route = createFileRoute("/favorites")({
  head: () => ({ meta: [{ title: "Избранное — Ценомер" }] }),
  component: FavoritesPage,
});

type TrackedMap = Record<string, boolean>;

function FavoritesPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<ProductWithOffers[]>([]);
  const [tracked, setTracked] = useState<TrackedMap>({});
  const [loading, setLoading] = useState(true);
  const fetchFavorites = useServerFn(getFavoriteProducts);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate({ to: "/auth" });
      return;
    }
    loadFavorites();
  }, [user, authLoading]);

  // ✅ FIX 2.1: один серверный запрос вместо 3 параллельных клиентских
  async function loadFavorites() {
    setLoading(true);
    try {
      const { data: favs } = await supabase
        .from("favorites")
        .select("product_id")
        .eq("user_id", user!.id);
      const ids = (favs || []).map((f) => f.product_id);

      if (ids.length === 0) {
        setItems([]);
        setLoading(false);
        return;
      }

      // Один JOIN-запрос через серверную функцию
      const [{ products }, { data: alerts }] = await Promise.all([
        fetchFavorites({ data: { ids } }),
        supabase
          .from("price_alerts")
          .select("product_id")
          .eq("user_id", user!.id)
          .eq("is_active", true),
      ]);

      const trackedIds: TrackedMap = {};
      for (const a of alerts || []) trackedIds[a.product_id] = true;
      setItems(products);
      setTracked(trackedIds);
    } catch {
      toast.error("Не удалось загрузить избранное");
    } finally {
      setLoading(false);
    }
  }

  async function removeFavorite(productId: string) {
    hapticLight();
    setItems((prev) => prev.filter((p) => p.id !== productId));
    const { error } = await supabase
      .from("favorites")
      .delete()
      .eq("user_id", user!.id)
      .eq("product_id", productId);
    if (error) {
      toast.error("Не удалось удалить");
      loadFavorites();
    } else toast.success("Удалено из избранного");
  }

  async function toggleTrack(product: ProductWithOffers) {
    const isTracked = tracked[product.id];
    setTracked((prev) => ({ ...prev, [product.id]: !isTracked }));
    if (isTracked) {
      hapticLight();
      const { error } = await supabase
        .from("price_alerts")
        .delete()
        .eq("user_id", user!.id)
        .eq("product_id", product.id);
      if (error) {
        setTracked((prev) => ({ ...prev, [product.id]: true }));
        toast.error("Ошибка");
      } else toast.success("Отслеживание выключено");
    } else {
      hapticSuccess();
      const { error } = await supabase.from("price_alerts").upsert(
        {
          user_id: user!.id,
          product_id: product.id,
          target_price: product.best_price,
          is_active: true,
        },
        { onConflict: "user_id,product_id" },
      );
      if (error) {
        setTracked((prev) => ({ ...prev, [product.id]: false }));
        toast.error("Ошибка");
      } else toast.success(`Уведомим при снижении ниже ${formatRub(product.best_price)}`);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    toast.success("Вы вышли");
    navigate({ to: "/" });
  }

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

  const tracked_count = Object.values(tracked).filter(Boolean).length;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader compact />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 font-display text-3xl font-bold tracking-tight">
              <Heart className="h-7 w-7 text-primary" /> Избранное
            </h1>
            {user && <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>}
            {items.length > 0 && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {items.length} товаров · {tracked_count} отслеживается
              </p>
            )}
          </div>
          <button
            onClick={logout}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm hover:bg-muted"
          >
            <LogOut className="h-4 w-4" /> Выйти
          </button>
        </div>

        {loading ? (
          <ProductGridSkeleton count={8} />
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
            <Heart className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-lg font-semibold">Пока пусто</p>
            <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
              Добавляйте товары сердечком — уведомим когда цена упадёт.
            </p>
            <Link
              to="/"
              className="mt-5 inline-block rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft transition hover:opacity-90"
            >
              Найти товары
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            <AnimatePresence mode="popLayout">
              {items.map((p, i) => (
                <motion.div
                  key={p.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
                  className="relative"
                >
                  <ProductCard product={p} index={i} />
                  <div className="absolute right-2 top-2 flex flex-col gap-1">
                    <button
                      onClick={() => toggleTrack(p)}
                      title={tracked[p.id] ? "Выключить" : "Отслеживать цену"}
                      className={`grid h-7 w-7 place-items-center rounded-full shadow-soft transition ${tracked[p.id] ? "bg-primary text-primary-foreground" : "bg-card/90 text-muted-foreground backdrop-blur-sm hover:text-primary"}`}
                    >
                      {tracked[p.id] ? (
                        <Bell className="h-3.5 w-3.5" />
                      ) : (
                        <BellOff className="h-3.5 w-3.5" />
                      )}
                    </button>
                    <button
                      onClick={() => removeFavorite(p.id)}
                      title="Удалить"
                      className="grid h-7 w-7 place-items-center rounded-full bg-card/90 text-muted-foreground shadow-soft backdrop-blur-sm transition hover:bg-destructive hover:text-destructive-foreground"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>
    </div>
  );
}
