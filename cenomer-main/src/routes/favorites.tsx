import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Heart, LogOut } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { ProductCard } from "@/components/ProductCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useServerFn } from "@tanstack/react-start";
import { searchProducts } from "@/lib/products.functions";
import type { ProductWithOffers } from "@/lib/products.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/favorites")({
  head: () => ({ meta: [{ title: "Избранное — Ценомер" }] }),
  component: FavoritesPage,
});

function FavoritesPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<ProductWithOffers[]>([]);
  const [loading, setLoading] = useState(true);
  const fetchAll = useServerFn(searchProducts);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate({ to: "/auth" });
      return;
    }
    (async () => {
      const { data: favs } = await supabase
        .from("favorites")
        .select("product_id")
        .eq("user_id", user.id);
      const ids = new Set((favs || []).map((f) => f.product_id));
      if (ids.size === 0) {
        setItems([]);
        setLoading(false);
        return;
      }
      const { products } = await fetchAll({ data: {} });
      setItems(products.filter((p) => ids.has(p.id)));
      setLoading(false);
    })();
  }, [user, authLoading, navigate, fetchAll]);

  async function logout() {
    await supabase.auth.signOut();
    toast.success("Вы вышли");
    navigate({ to: "/" });
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader compact />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h1 className="flex items-center gap-2 font-display text-3xl font-bold tracking-tight">
              <Heart className="h-7 w-7 text-primary" /> Избранное
            </h1>
            {user && <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>}
          </div>
          <button
            onClick={logout}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm hover:bg-muted"
          >
            <LogOut className="h-4 w-4" /> Выйти
          </button>
        </div>

        {loading ? (
          <p className="text-muted-foreground">Загружаем…</p>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <p className="text-lg font-semibold">Пока пусто</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Добавляйте товары сердечком, чтобы быстро возвращаться к ним и следить за ценой.
            </p>
            <Link
              to="/"
              className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
            >
              Найти товары →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {items.map((p, i) => (
              <ProductCard key={p.id} product={p} index={i} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
