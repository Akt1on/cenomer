import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQuery, useIsFetching } from "@tanstack/react-query";
import { z } from "zod";
import { useState, useMemo } from "react";
import { SlidersHorizontal, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { ProductGridSkeleton } from "@/components/Skeletons";
import { Suspense } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { ProductCard } from "@/components/ProductCard";
import { searchProducts, PAGE_SIZE } from "@/lib/products.functions";
import { useShoppingList } from "@/lib/shopping-list";
import { supabase } from "@/integrations/supabase/client";

const searchSchema = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
  promoOnly: z.boolean().optional(),
  sort: z.enum(["price", "discount", "name"]).optional(),
  page: z.number().int().min(1).optional(),
});

export const Route = createFileRoute("/search")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(
      queryOptions({
        queryKey: ["search", deps],
        queryFn: () => searchProducts({ data: deps }),
      }),
    ),
  head: () => ({
    meta: [{ title: "Поиск — Ценомер" }, { name: "description", content: "Сравнение цен на продукты" }],
  }),
  component: () => <Suspense fallback={<div className="min-h-screen bg-background p-4 pt-16"><ProductGridSkeleton count={12} /></div>}><SearchPage /></Suspense>,
  errorComponent: ({ error }) => <div className="p-8 text-center text-destructive">{error.message}</div>,
});

function SearchPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [showFilters, setShowFilters] = useState(false);
  const { items } = useShoppingList();

  // ✅ FIX 3.1: вычисляем Set один раз, передаём в ProductCard
  const cartIds = useMemo(() => new Set(items.map((i) => i.product.id)), [items]);

  const { data } = useSuspenseQuery(
    queryOptions({
      queryKey: ["search", search],
      queryFn: () => searchProducts({ data: search }),
    }),
  );

  const { data: cats } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await supabase.from("categories").select("*").order("sort_order")).data ?? [],
    staleTime: 5 * 60_000,
  });

  // ✅ FIX 2.4: показываем оверлей загрузки при смене страницы
  const isFetching = useIsFetching({ queryKey: ["search"] }) > 0;

  function update(patch: Partial<z.infer<typeof searchSchema>>) {
    navigate({ search: (s: z.infer<typeof searchSchema>) => ({ ...s, ...patch, page: 1 }) });
  }

  function goToPage(p: number) {
    navigate({ search: (s: z.infer<typeof searchSchema>) => ({ ...s, page: p }) });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const currentPage = search.page ?? 1;
  const totalPages = Math.ceil((data.total ?? 0) / PAGE_SIZE);

  const filterPanel = (
    <aside className="space-y-5 rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div>
        <h3 className="mb-2 text-sm font-semibold">Категория</h3>
        <div className="space-y-1">
          <button
            onClick={() => update({ category: undefined })}
            className={`block w-full rounded-lg px-3 py-1.5 text-left text-sm ${!search.category ? "bg-primary-soft text-primary font-medium" : "hover:bg-muted"}`}
          >
            Все категории
          </button>
          {cats?.map((c) => (
            <button
              key={c.id}
              onClick={() => update({ category: c.slug })}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-sm ${search.category === c.slug ? "bg-primary-soft text-primary font-medium" : "hover:bg-muted"}`}
            >
              <span>{c.icon}</span>
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold">Сортировка</h3>
        <div className="space-y-1">
          {[
            { v: "price", l: "По цене (дешевле)" },
            { v: "discount", l: "По скидке" },
            { v: "name", l: "По названию" },
          ].map((o) => (
            <button
              key={o.v}
              onClick={() => update({ sort: o.v as "price" | "discount" | "name" })}
              className={`block w-full rounded-lg px-3 py-1.5 text-left text-sm ${(search.sort ?? "price") === o.v ? "bg-primary-soft text-primary font-medium" : "hover:bg-muted"}`}
            >
              {o.l}
            </button>
          ))}
        </div>
      </div>

      <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
        Только акции
        <input
          type="checkbox"
          className="h-4 w-4 accent-[var(--color-primary)]"
          checked={!!search.promoOnly}
          onChange={(e) => update({ promoOnly: e.target.checked || undefined })}
        />
      </label>
    </aside>
  );

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader compact />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:py-10">
        <div className="mb-6 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Результаты поиска</p>
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
              {search.q
                ? `«${search.q}»`
                : search.category
                  ? cats?.find((c) => c.slug === search.category)?.name
                  : "Все товары"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Найдено: {data.total ?? data.products.length}
              {totalPages > 1 && ` · страница ${currentPage} из ${totalPages}`}
            </p>
          </div>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm lg:hidden"
          >
            <SlidersHorizontal className="h-4 w-4" /> Фильтры
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          <div className={showFilters ? "block" : "hidden lg:block"}>{filterPanel}</div>
          <div>
            {data.products.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
                <p className="text-lg font-semibold">Ничего не нашли</p>
                <p className="mt-1 text-sm text-muted-foreground">Попробуйте изменить запрос или фильтры.</p>
                <Link to="/" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">
                  ← На главную
                </Link>
              </div>
            ) : (
              <>
                {/* ✅ FIX 2.4: dim-оверлей при подгрузке следующей страницы */}
                <div className="relative">
                  {isFetching && (
                    <div className="absolute inset-0 z-10 flex items-start justify-center bg-background/60 pt-20 backdrop-blur-[1px]">
                      <div className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 shadow-soft">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        <span className="text-sm font-medium">Загрузка...</span>
                      </div>
                    </div>
                  )}
                  <div className={`grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4 transition-opacity ${isFetching ? "opacity-60" : "opacity-100"}`}>
                    {data.products.map((p, i) => (
                      <ProductCard key={p.id} product={p} index={i} cartIds={cartIds} />
                    ))}
                  </div>
                </div>

                {/* Пагинация */}
                {totalPages > 1 && (
                  <div className="mt-8 flex items-center justify-center gap-2">
                    <button
                      onClick={() => goToPage(currentPage - 1)}
                      disabled={currentPage <= 1}
                      className="inline-flex items-center gap-1 rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium transition hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="h-4 w-4" /> Назад
                    </button>

                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                        .reduce<(number | "...")[]>((acc, p, idx, arr) => {
                          if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("...");
                          acc.push(p);
                          return acc;
                        }, [])
                        .map((p, i) =>
                          p === "..." ? (
                            <span key={`ellipsis-${i}`} className="px-2 text-muted-foreground">…</span>
                          ) : (
                            <button
                              key={p}
                              onClick={() => goToPage(p as number)}
                              className={`h-9 w-9 rounded-lg text-sm font-medium transition ${currentPage === p ? "bg-primary text-primary-foreground" : "border border-border bg-card hover:bg-muted"}`}
                            >
                              {p}
                            </button>
                          ),
                        )}
                    </div>

                    <button
                      onClick={() => goToPage(currentPage + 1)}
                      disabled={currentPage >= totalPages}
                      className="inline-flex items-center gap-1 rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium transition hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Вперёд <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
