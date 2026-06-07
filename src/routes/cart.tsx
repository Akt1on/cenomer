import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingCart, Trash2, Plus, Minus, Share2, ArrowRight } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { useShoppingList } from "@/lib/shopping-list";
import { formatRub } from "@/lib/format";
import { hapticLight, hapticSuccess, shareProduct } from "@/hooks/use-native";
import { toast } from "sonner";

export const Route = createFileRoute("/cart")({
  head: () => ({ meta: [{ title: "Список покупок — Ценомер" }] }),
  component: CartPage,
});

function CartPage() {
  const { items, removeItem, updateQty, clearAll, totals } = useShoppingList();
  const storeTotals = totals();
  const cheapest = storeTotals[0];
  const mostExpensive = storeTotals[storeTotals.length - 1];
  const saving = mostExpensive && cheapest ? mostExpensive.total - cheapest.total : 0;

  // ✅ FIX 1.2: передаём fullText в shareProduct, а не пустую строку
  // ✅ FIX 4.3: fallback на clipboard если Web Share API недоступен
  async function shareList() {
    const lines = items.map(
      (i) => `• ${i.product.name} × ${i.qty} — от ${formatRub(i.product.best_price)}`,
    );
    const totalLine = cheapest
      ? `\nИтого в ${cheapest.store_name}: ${formatRub(cheapest.total)}${saving > 0 ? ` (экономия ${formatRub(saving)} vs дорогой магазин)` : ""}`
      : "";
    const fullText = `Мой список покупок:\n${lines.join("\n")}${totalLine}\nЦеномер: ${window.location.origin}`;

    try {
      await shareProduct(fullText, window.location.href);
      hapticSuccess();
    } catch {
      // Web Share недоступен — копируем в clipboard
      try {
        await navigator.clipboard.writeText(fullText);
        hapticSuccess();
        toast.success("Скопировано!");
      } catch {
        toast.error("Не удалось поделиться");
      }
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader compact />
      <main className="mx-auto max-w-3xl px-4 py-8">
        {/* Заголовок */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="flex items-center gap-2 font-display text-3xl font-bold tracking-tight">
              <ShoppingCart className="h-7 w-7 text-primary" /> Список покупок
            </h1>
            {items.length > 0 && (
              <p className="mt-1 text-sm text-muted-foreground">
                {items.length} позиций · {items.reduce((s, i) => s + i.qty, 0)} шт.
              </p>
            )}
          </div>
          {items.length > 0 && (
            <div className="flex gap-2">
              <button
                onClick={shareList}
                className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-card text-muted-foreground transition hover:bg-muted"
              >
                <Share2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  clearAll();
                  hapticLight();
                  toast.success("Список очищен");
                }}
                className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-card text-muted-foreground transition hover:bg-destructive hover:text-destructive-foreground"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {items.length === 0 ? (
          /* Пустой список */
          <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
            <ShoppingCart className="mx-auto mb-3 h-12 w-12 text-muted-foreground/30" />
            <p className="text-lg font-semibold">Список пуст</p>
            <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
              Добавляйте товары из поиска — мы посчитаем где выгоднее купить всё сразу.
            </p>
            <Link
              to="/search"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft transition hover:opacity-90"
            >
              Найти товары <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Итог по магазинам */}
            {storeTotals.length > 0 && (
              <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
                <div className="border-b border-border px-4 py-3">
                  <p className="text-sm font-semibold">Где выгоднее купить всё?</p>
                  {saving > 0 && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Экономия до{" "}
                      <span className="font-semibold text-success">{formatRub(saving)}</span> если
                      выбрать лучший магазин
                    </p>
                  )}
                </div>
                <div className="divide-y divide-border">
                  {storeTotals.map((s, i) => {
                    const isBest = i === 0;
                    const diff = s.total - (cheapest?.total ?? 0);
                    return (
                      <div
                        key={s.store_id}
                        className={`flex items-center justify-between px-4 py-3 ${isBest ? "bg-primary/5" : ""}`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold"
                            style={{
                              backgroundColor: `${s.brand_color}20`,
                              color: s.brand_color ?? undefined,
                            }}
                          >
                            {i + 1}
                          </span>
                          <div>
                            <p className="text-sm font-medium">{s.store_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {s.available} из {items.length} товаров
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p
                            className={`font-display text-lg font-bold ${isBest ? "text-success" : ""}`}
                          >
                            {formatRub(s.total)}
                          </p>
                          {diff > 0 && (
                            <p className="text-xs text-muted-foreground">+{formatRub(diff)}</p>
                          )}
                          {isBest && (
                            <span className="mt-0.5 inline-block rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">
                              Лучшая цена
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Список товаров */}
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
              <AnimatePresence mode="popLayout">
                {items.map(({ product, qty }, idx) => (
                  <motion.div
                    key={product.id}
                    layout
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0, transition: { duration: 0.15 } }}
                    className={idx > 0 ? "border-t border-border" : ""}
                  >
                    <div className="flex items-center gap-3 p-3">
                      {/* Фото */}
                      <Link to="/product/$slug" params={{ slug: product.slug }}>
                        {product.image_url ? (
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="h-14 w-14 shrink-0 rounded-xl object-cover"
                          />
                        ) : (
                          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-muted text-2xl">
                            🛒
                          </div>
                        )}
                      </Link>

                      {/* Инфо */}
                      <div className="min-w-0 flex-1">
                        <Link to="/product/$slug" params={{ slug: product.slug }}>
                          <p className="line-clamp-1 text-sm font-medium hover:text-primary">
                            {product.name}
                          </p>
                        </Link>
                        {product.volume && (
                          <p className="text-xs text-muted-foreground">{product.volume}</p>
                        )}
                        <p className="mt-0.5 text-sm font-semibold text-success">
                          от {formatRub(product.best_price)}
                          {qty > 1 && (
                            <span className="ml-1 text-xs text-muted-foreground">
                              × {qty} = {formatRub((product.best_price ?? 0) * qty)}
                            </span>
                          )}
                        </p>
                      </div>

                      {/* Кол-во + удалить */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            updateQty(product.id, qty - 1);
                            hapticLight();
                          }}
                          className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-card transition hover:bg-muted"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-6 text-center text-sm font-semibold">{qty}</span>
                        <button
                          onClick={() => {
                            updateQty(product.id, qty + 1);
                            hapticLight();
                          }}
                          className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-card transition hover:bg-muted"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            removeItem(product.id);
                            hapticLight();
                          }}
                          className="ml-1 grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* CTA */}
            <p className="text-center text-xs text-muted-foreground">
              Цены обновляются каждые 6 часов · Актуально на момент загрузки
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
