import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { ProductCard } from "@/components/ProductCard";
import { searchProducts } from "@/lib/products.functions";
import { supabase } from "@/integrations/supabase/client";

const searchSchema = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
  promoOnly: z.boolean().optional(),
  sort: z.enum(["price", "discount", "popular"]).optional(),
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
  head: ({ params: _p, loaderData: _l, match: _m }) => ({
    meta: [
      { title: "Поиск — Ценомер" },
      { name: "description", content: "Сравнение цен на продукты" },
    ],
  }),
  component: SearchPage,
  errorComponent: ({ error }) => (
    <div className="p-8 text-center text-destructive">{error.message}</div>
  ),
});

function SearchPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [showFilters, setShowFilters] = useState(false);

  const { data } = useSuspenseQuery(
    queryOptions({
      queryKey: ["search", search],
      queryFn: () => searchProducts({ data: search }),
    }),
  );

  const { data: cats } = useQuery({
    queryKey: ["categories"],
    queryFn: async () =>
      (await supabase.from("categories").select("*").order("sort_order")).data ?? [],
    staleTime: 5 * 60_000,
  });

  function update(patch: Partial<z.infer<typeof searchSchema>>) {
    navigate({ search: (s: z.infer<typeof searchSchema>) => ({ ...s, ...patch }) });
  }

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
          {(() => {
            const sortOptions: { v: "price" | "discount" | "popular"; l: string }[] = [
              { v: "price", l: "По цене (дешевле)" },
              { v: "discount", l: "По скидке" },
              { v: "popular", l: "По названию" },
            ];
            return sortOptions.map((o) => (
              <button
                key={o.v}
                onClick={() => update({ sort: o.v })}
                className={`block w-full rounded-lg px-3 py-1.5 text-left text-sm ${(search.sort ?? "price") === o.v ? "bg-primary-soft text-primary font-medium" : "hover:bg-muted"}`}
              >
                {o.l}
              </button>
            ));
          })()}
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
            <p className="mt-1 text-sm text-muted-foreground">Найдено: {data.products.length}</p>
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
                <p className="mt-1 text-sm text-muted-foreground">
                  Попробуйте изменить запрос или фильтры.
                </p>
                <Link
                  to="/"
                  className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
                >
                  ← На главную
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4">
                {data.products.map((p, i) => (
                  <ProductCard key={p.id} product={p} index={i} />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
