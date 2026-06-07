/** Форматирование цены в рублях. */
export function formatRub(value: number | string | null | undefined): string {
  if (value == null) return "—";
  const n = typeof value === "string" ? parseFloat(value) : value;
  if (!isFinite(n)) return "—";
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: n % 1 === 0 ? 0 : 2,
  }).format(n);
}

export function formatPercent(value: number): string {
  return `−${Math.round(value)}%`;
}

export function discountPercent(
  oldPrice: number | string | null | undefined,
  price: number | string,
): number | null {
  if (oldPrice == null) return null;
  const o = typeof oldPrice === "string" ? parseFloat(oldPrice) : oldPrice;
  const p = typeof price === "string" ? parseFloat(price) : price;
  if (!o || !p || o <= p) return null;
  return ((o - p) / o) * 100;
}
