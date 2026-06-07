/**
 * useShoppingList — глобальный стейт корзины покупок.
 * Хранится в localStorage, синхронизируется между вкладками.
 * Считает итоговую сумму по каждому магазину.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ProductWithOffers } from "@/lib/products.functions";

export interface CartItem {
  product: ProductWithOffers;
  qty: number;
  addedAt: string;
}

interface StoreTotals {
  store_id: string;
  store_name: string;
  brand_color: string | null;
  total: number;
  available: number; // сколько товаров из корзины есть в этом магазине
}

interface ShoppingListStore {
  items: CartItem[];
  addItem: (product: ProductWithOffers) => void;
  removeItem: (productId: string) => void;
  updateQty: (productId: string, qty: number) => void;
  clearAll: () => void;
  totals: () => StoreTotals[];
  itemCount: () => number;
}

export const useShoppingList = create<ShoppingListStore>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (product) =>
        set((s) => {
          const exists = s.items.find((i) => i.product.id === product.id);
          if (exists) {
            return {
              items: s.items.map((i) =>
                i.product.id === product.id ? { ...i, qty: i.qty + 1 } : i,
              ),
            };
          }
          return { items: [...s.items, { product, qty: 1, addedAt: new Date().toISOString() }] };
        }),

      removeItem: (productId) =>
        set((s) => ({ items: s.items.filter((i) => i.product.id !== productId) })),

      updateQty: (productId, qty) =>
        set((s) => ({
          items:
            qty <= 0
              ? s.items.filter((i) => i.product.id !== productId)
              : s.items.map((i) => (i.product.id === productId ? { ...i, qty } : i)),
        })),

      clearAll: () => set({ items: [] }),

      // Считаем итог по каждому магазину
      totals: () => {
        const { items } = get();
        const storeMap = new Map<string, StoreTotals>();

        for (const { product, qty } of items) {
          for (const offer of product.offers) {
            const prev = storeMap.get(offer.store_id);
            if (prev) {
              prev.total += offer.price * qty;
              prev.available += 1;
            } else {
              storeMap.set(offer.store_id, {
                store_id: offer.store_id,
                store_name: offer.store_name,
                brand_color: offer.brand_color,
                total: offer.price * qty,
                available: 1,
              });
            }
          }
        }

        return Array.from(storeMap.values()).sort((a, b) => a.total - b.total);
      },

      itemCount: () => get().items.reduce((s, i) => s + i.qty, 0),
    }),
    { name: "cenomer-cart" },
  ),
);
