import { Link } from "@tanstack/react-router";
import { Heart, ShoppingBasket, User } from "lucide-react";
import { SearchBar } from "./SearchBar";
import { useAuth } from "@/lib/auth-context";

export function SiteHeader({ compact = false }: { compact?: boolean }) {
  const { user } = useAuth();
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:gap-6">
        <Link to="/" className="flex shrink-0 items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-soft">
            <ShoppingBasket className="h-5 w-5" strokeWidth={2.4} />
          </div>
          <span className="hidden font-display text-lg font-bold tracking-tight sm:inline">
            Ценомер
          </span>
        </Link>
        {compact && (
          <div className="min-w-0 flex-1">
            <SearchBar variant="compact" />
          </div>
        )}
        {!compact && <div className="flex-1" />}
        <nav className="flex items-center gap-1">
          <Link
            to="/favorites"
            className="hidden items-center gap-1.5 rounded-full px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground sm:inline-flex"
          >
            <Heart className="h-4 w-4" />
            Избранное
          </Link>
          <Link
            to={user ? "/favorites" : "/auth"}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-soft transition hover:opacity-90"
          >
            <User className="h-4 w-4" />
            {user ? "Профиль" : "Войти"}
          </Link>
        </nav>
      </div>
    </header>
  );
}
