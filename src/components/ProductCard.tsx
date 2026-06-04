import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { TrendingDown } from "lucide-react";
import { formatRub, discountPercent } from "@/lib/format";
import type { ProductWithOffers } from "@/lib/products.functions";

export function ProductCard({
  product,
  index = 0,
}: {
  product: ProductWithOffers;
  index?: number;
}) {
  const best = product.offers[0];
  const dp = best ? discountPercent(best.old_price, best.price) : null;
  const savings =
    product.max_price && product.best_price ? product.max_price - product.best_price : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.03, 0.3) }}
    >
      <Link
        to="/product/$slug"
        params={{ slug: product.slug }}
        className="group block h-full overflow-hidden rounded-2xl border border-border bg-card shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
      >
        <div className="relative aspect-square overflow-hidden bg-muted">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="grid h-full place-items-center text-muted-foreground">—</div>
          )}
          {dp && (
            <span className="absolute left-2 top-2 rounded-full bg-promo px-2 py-0.5 text-[11px] font-semibold text-promo-foreground shadow-soft">
              −{Math.round(dp)}%
            </span>
          )}
        </div>
        <div className="space-y-2 p-3">
          <h3 className="line-clamp-2 min-h-[2.6em] text-sm font-medium leading-snug">
            {product.name}
          </h3>
          {product.volume && <p className="text-xs text-muted-foreground">{product.volume}</p>}
          <div className="flex items-end justify-between gap-2 pt-1">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">от</p>
              <p className="font-display text-xl font-bold text-success price-glow">
                {formatRub(product.best_price)}
              </p>
            </div>
            {savings > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-1 text-[11px] font-medium text-primary">
                <TrendingDown className="h-3 w-3" />
                {formatRub(savings)}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1 pt-1">
            {product.offers.slice(0, 4).map((o) => (
              <span
                key={o.store_id}
                className="rounded-md px-1.5 py-0.5 text-[10px] font-medium"
                style={{
                  backgroundColor: `${o.brand_color}1a`,
                  color: o.brand_color ?? undefined,
                }}
              >
                {o.store_name}
              </span>
            ))}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
