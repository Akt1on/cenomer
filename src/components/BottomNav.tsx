/**
 * BottomNav — нативный таб-бар для iOS/Android.
 * Отображается только на мобильных устройствах (< lg).
 * На iOS добавляет padding для home indicator.
 */
import { Link, useLocation } from "@tanstack/react-router";
import { Home, Search, Heart, User, ShoppingCart, Trophy } from "lucide-react";
import { useShoppingList } from "@/lib/shopping-list";
import { hapticLight } from "@/hooks/use-native";
import { useNativePlatform } from "@/hooks/use-native";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/", icon: Home, label: "Главная" },
  { to: "/search", icon: Search, label: "Каталог" },
  { to: "/cart", icon: ShoppingCart, label: "Корзина" },
  { to: "/favorites", icon: Heart, label: "Избранное" },
  { to: "/rating", icon: Trophy, label: "Рейтинг" },
  { to: "/auth", icon: User, label: "Профиль" },
] as const;

export function BottomNav() {
  const location = useLocation();
  const { isIos } = useNativePlatform();
  const { itemCount } = useShoppingList();
  const cartCount = itemCount();

  return (
    <nav
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card/95 backdrop-blur-md lg:hidden",
        // iOS home indicator
        isIos ? "pb-[env(safe-area-inset-bottom)]" : "pb-1",
      )}
      style={{ boxShadow: "0 -1px 0 0 var(--color-border)" }}
    >
      <div className="flex h-14 items-stretch">
        {TABS.map((tab) => {
          const isActive =
            tab.to === "/"
              ? location.pathname === "/"
              : location.pathname.startsWith(tab.to);

          return (
            <Link
              key={tab.to}
              to={tab.to}
              onClick={() => hapticLight()}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors",
                isActive ? "text-primary" : "text-muted-foreground",
              )}
            >
              <span className="relative">
                <tab.icon
                  className={cn("h-5 w-5 transition-transform", isActive && "scale-110")}
                  strokeWidth={isActive ? 2.5 : 1.8}
                />
                {tab.to === "/cart" && cartCount > 0 && (
                  <span className="absolute -right-2 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                    {cartCount > 9 ? "9+" : cartCount}
                  </span>
                )}
              </span>
              <span>{tab.label}</span>
              {isActive && (
                <span className="absolute -top-px h-0.5 w-8 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
