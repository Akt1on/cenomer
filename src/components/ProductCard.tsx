import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { motion, useReducedMotion } from "framer-motion";
import { TrendingDown, ShoppingCart, BarChart3 } from "lucide-react";
import { formatRub, discountPercent } from "@/lib/format";
import { useShoppingList } from "@/lib/shopping-list";
import { hapticLight, hapticSuccess } from "@/hooks/use-native";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
import type { ProductWithOffers } from "@/lib/products.functions";

// Эмодзи-фоллбэк по категории
const CATEGORY_EMOJI: Record<string, string> = {
  moloko: "🥛", molochnye: "🥛", myaso: "🥩", ptitsa: "🍗",
  ovoshi: "🥦", frukty: "🍎", hleb: "🍞", vypechka: "🥐",
  ryba: "🐟", kolbasy: "🌭", syry: "🧀", yaytsa: "🥚",
  napitki: "🧃", sladosti: "🍫", krupy: "🌾", makarony: "🍝",
  zamorozhennye: "🧊", konservy: "🥫", masla: "🫙", morozhenoe: "🍦",
};

function ProductImageFallback({ categorySlug }: { categorySlug: string | null }) {
  const emoji = (categorySlug && CATEGORY_EMOJI[categorySlug]) ?? "🛒";
  return (
    <div className="grid h-full w-full place-items-center bg-gradient-to-br from-muted to-muted/50">
      <span className="text-4xl opacity-60">{emoji}</span>
    </div>
  );
}

interface ProductCardProps {
  product: ProductWithOffers;
  index?: number;
  compareMode?: boolean;
  // ✅ FIX 3.1: cartIds передаётся снаружи как Set для O(1) lookup
  cartIds?: Set<string>;
}

export function ProductCard({ product, index = 0, compareMode = false, cartIds }: ProductCardProps) {
  const best = product.offers[0];
  const dp = best ? discountPercent(best.old_price, best.price) : null;
  const savings = product.max_price && product.best_price ? product.max_price - product.best_price : 0;
  const { addItem, items } = useShoppingList();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  // ✅ FIX 3.1: если cartIds передан снаружи — O(1), иначе fallback O(n)
  const inCart = cartIds ? cartIds.has(product.id) : items.some((i) => i.product.id === product.id);

  function addToCart(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    addItem(product);
    hapticSuccess();
    toast.success("Добавлено в список покупок", {
      action: { label: "Открыть", onClick: () => navigate({ to: "/cart" }) },
    });
  }

  // ✅ FIX 1.1: addToCompare использует URL-параметры, а не localStorage
  function addToCompare(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    hapticLight();

    // Читаем текущий список из window.location (не из navigate, т.к. не хук)
    const params = new URLSearchParams(window.location.search);
    const currentSlugs = (params.get("slugs") ?? "").split(",").filter(Boolean);

    if (currentSlugs.includes(product.slug)) {
      toast.info("Уже в сравнении");
      return;
    }
    if (currentSlugs.length >= 4) {
      toast.error("Можно сравнить максимум 4 товара");
      return;
    }
    const next = [...currentSlugs, product.slug].join(",");
    toast.success("Добавлено к сравнению", {
      action: {
        label: "Сравнить",
        onClick: () => navigate({ to: "/compare", search: { slugs: next } }),
      },
    });
    // Навигируем сразу на /compare с обновлённым списком
    navigate({ to: "/compare", search: { slugs: next } });
  }

  // ✅ FIX 4.5: кнопки видны всегда на мобильном, hover — только на десктопе
  const actionButtonsClass = isMobile
    ? "absolute bottom-[52px] inset-x-3 flex gap-1 opacity-100"
    : "absolute bottom-[52px] inset-x-3 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100";

  // ✅ FIX 3.3: отключаем анимации для пользователей с prefers-reduced-motion
  // и при большом index (экономим ресурсы на слабых устройствах)
  const prefersReducedMotion = useReducedMotion();
  const shouldAnimate = !prefersReducedMotion && index < 20;

  return (
    <motion.div
      initial={shouldAnimate ? { opacity: 0, y: 12 } : false}
      animate={shouldAnimate ? { opacity: 1, y: 0 } : undefined}
      viewport={{ once: true, margin: "100px" }}
      transition={{ duration: 0.3, delay: shouldAnimate ? Math.min(index * 0.03, 0.25) : 0 }}
      className="group relative"
    >
      <Link to="/product/$slug" params={{ slug: product.slug }}
        className="block h-full overflow-hidden rounded-2xl border border-border bg-card shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift">

        {/* Фото */}
        <div className="relative aspect-square overflow-hidden bg-muted">
          {product.image_url ? (
            <img src={product.image_url} alt={product.name}
              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
              loading="lazy"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            <ProductImageFallback categorySlug={product.category_slug} />
          )}
          {dp && (
            <span className="absolute left-2 top-2 rounded-full bg-promo px-2 py-0.5 text-[11px] font-semibold text-promo-foreground shadow-soft">
              −{Math.round(dp)}%
            </span>
          )}
          {inCart && (
            <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-primary text-primary-foreground shadow-soft">
              <ShoppingCart className="h-3 w-3" />
            </span>
          )}
        </div>

        {/* Текст */}
        <div className="space-y-2 p-3">
          <h3 className="line-clamp-2 min-h-[2.6em] text-sm font-medium leading-snug">{product.name}</h3>
          {product.volume && <p className="text-xs text-muted-foreground">{product.volume}</p>}
          <div className="flex items-end justify-between gap-2 pt-1">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">от</p>
              <p className="font-display text-xl font-bold text-success">{formatRub(product.best_price)}</p>
            </div>
            {savings > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-1 text-[11px] font-medium text-primary">
                <TrendingDown className="h-3 w-3" />{formatRub(savings)}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1 pt-1">
            {product.offers.slice(0, 4).map((o) => (
              <Link key={o.store_id} to="/store/$slug" params={{ slug: o.store_slug }}
                onClick={(e) => e.stopPropagation()}
                className="rounded-md px-1.5 py-0.5 text-[10px] font-medium transition hover:opacity-80"
                style={{ backgroundColor: `${o.brand_color}1a`, color: o.brand_color ?? undefined }}>
                {o.store_name}
              </Link>
            ))}
          </div>
        </div>
      </Link>

      {/* Кнопки действий */}
      <div className={actionButtonsClass}>
        <button onClick={addToCart}
          className={`flex flex-1 items-center justify-center gap-1 rounded-xl py-1.5 text-[11px] font-semibold transition ${inCart ? "bg-primary text-primary-foreground" : "bg-card/90 text-foreground backdrop-blur-sm hover:bg-primary hover:text-primary-foreground border border-border"}`}>
          <ShoppingCart className="h-3 w-3" />
          {inCart ? "В списке" : "В список"}
        </button>
        <button onClick={addToCompare}
          className="grid h-7 w-7 place-items-center rounded-xl border border-border bg-card/90 text-muted-foreground backdrop-blur-sm transition hover:bg-muted"
          title="Добавить к сравнению">
          <BarChart3 className="h-3.5 w-3.5" />
        </button>
      </div>
    </motion.div>
  );
}
