import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Search, X, Sparkles } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { autocompleteProducts } from "@/lib/products.functions";

interface Props {
  variant?: "hero" | "compact";
  defaultValue?: string;
}

const SUGGESTIONS = ["молоко 3.2%", "куриная грудка", "яйца", "бананы", "сыр", "масло сливочное"];

export function SearchBar({ variant = "hero", defaultValue = "" }: Props) {
  const navigate = useNavigate();
  const [value, setValue] = useState(defaultValue);
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const autocomplete = useServerFn(autocompleteProducts);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), 180);
    return () => clearTimeout(t);
  }, [value]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const { data } = useQuery({
    queryKey: ["autocomplete", debounced],
    queryFn: () => autocomplete({ data: { q: debounced } }),
    enabled: debounced.trim().length >= 2,
    staleTime: 30_000,
  });

  function submit(q: string) {
    if (!q.trim()) return;
    setOpen(false);
    navigate({ to: "/search", search: { q: q.trim() } });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!data?.items) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => Math.min(current + 1, data.items.length - 1));
      setOpen(true);
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
      setOpen(true);
    }
    if (event.key === "Enter") {
      const item = data.items[activeIndex];
      if (item && open) {
        event.preventDefault();
        setValue("");
        setOpen(false);
        navigate({ to: "/product/$slug", params: { slug: item.slug } });
      }
    }
    if (event.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  const isHero = variant === "hero";

  return (
    <div ref={wrapRef} className="relative w-full">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(value);
        }}
        className={
          isHero
            ? "group flex items-center gap-2 rounded-2xl border border-border bg-card p-2 shadow-lift transition focus-within:ring-4 focus-within:ring-primary/20"
            : "group flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 shadow-soft focus-within:ring-2 focus-within:ring-primary/30"
        }
      >
        <Search
          className={
            isHero ? "ml-3 h-6 w-6 text-muted-foreground" : "h-4 w-4 text-muted-foreground"
          }
        />
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={isHero ? "Например, молоко 3.2% 900мл" : "Поиск товаров…"}
          role="combobox"
          aria-autocomplete="list"
          aria-label="Поиск товаров"
          aria-expanded={open}
          aria-controls="search-autocomplete-list"
          aria-activedescendant={
            open && activeIndex >= 0 ? `search-option-${activeIndex}` : undefined
          }
          onKeyDown={handleKeyDown}
          className={
            isHero
              ? "min-w-0 flex-1 bg-transparent px-2 py-3 text-base outline-none placeholder:text-muted-foreground sm:text-lg"
              : "min-w-0 flex-1 bg-transparent py-1.5 text-sm outline-none placeholder:text-muted-foreground"
          }
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              setValue("");
              inputRef.current?.focus();
            }}
            className="rounded-full p-1.5 text-muted-foreground hover:bg-muted"
            aria-label="Очистить"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        <button
          type="submit"
          className={
            isHero
              ? "rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-soft transition hover:opacity-90 sm:px-7 sm:text-base"
              : "rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
          }
        >
          Найти
        </button>
      </form>

      {open && (
        <div className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-border bg-popover shadow-lift">
          {data && data.items.length > 0 ? (
            <ul
              id="search-autocomplete-list"
              role="listbox"
              className="max-h-96 overflow-y-auto py-1"
            >
              {data.items.map((item, index) => (
                <li key={item.id} role="option" aria-selected={activeIndex === index}>
                  <button
                    id={`search-option-${index}`}
                    type="button"
                    onMouseEnter={() => setActiveIndex(index)}
                    onMouseLeave={() => setActiveIndex(-1)}
                    onClick={() => {
                      setValue("");
                      setOpen(false);
                      setActiveIndex(-1);
                      navigate({ to: "/product/$slug", params: { slug: item.slug } });
                    }}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition ${
                      activeIndex === index ? "bg-muted" : "hover:bg-muted"
                    }`}
                  >
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="h-10 w-10 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-lg bg-muted" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.name}</p>
                      {item.brand && (
                        <p className="truncate text-xs text-muted-foreground">{item.brand}</p>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-4 py-3">
              <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5" /> Популярные запросы
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => submit(s)}
                    className="rounded-full bg-muted px-3 py-1 text-xs transition hover:bg-accent hover:text-accent-foreground"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
