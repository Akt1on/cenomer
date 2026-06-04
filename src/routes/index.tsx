import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ShieldCheck, Sparkles, Zap } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SearchBar } from "@/components/SearchBar";
import { ProductCard } from "@/components/ProductCard";
import { getHomeData } from "@/lib/products.functions";

const homeQuery = queryOptions({
  queryKey: ["home"],
  queryFn: () => getHomeData(),
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ценомер — сравнение цен на продукты в Москве" },
      {
        name: "description",
        content:
          "Найдите самую низкую цену на любой продукт среди Перекрёстка, Пятёрочки, Магнита и Ленты. Обновление цен каждые 6 часов.",
      },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(homeQuery),
  component: IndexPage,
  errorComponent: ({ error }) => (
    <div className="p-8 text-center text-destructive">{error.message}</div>
  ),
});

const STORES = [
  { name: "Перекрёсток", color: "#00984A" },
  { name: "Пятёрочка", color: "#E30613" },
  { name: "Магнит", color: "#E2231A" },
  { name: "Лента", color: "#003C96" },
];

function IndexPage() {
  const { data } = useSuspenseQuery(homeQuery);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(60% 60% at 50% 0%, oklch(0.95 0.08 150 / 0.6) 0%, transparent 70%)",
          }}
        />
        <div className="mx-auto max-w-5xl px-4 pb-12 pt-10 sm:pb-20 sm:pt-16">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center"
          >
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary-soft px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Цены обновляются каждые 6 часов
            </span>
            <h1 className="mt-5 text-balance font-display text-4xl font-bold tracking-tight sm:text-6xl">
              Самая низкая цена{" "}
              <span className="bg-gradient-to-r from-primary to-emerald-500 bg-clip-text text-transparent">
                на продукты
              </span>{" "}
              за 1 клик
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-balance text-base text-muted-foreground sm:text-lg">
              Ценомер сравнивает цены в крупнейших супермаркетах Москвы и области. Найдите выгодное
              предложение мгновенно.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mx-auto mt-8 max-w-3xl"
          >
            <SearchBar />
          </motion.div>

          {/* Trust strip */}
          <div className="mx-auto mt-8 flex max-w-3xl flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground sm:gap-x-8">
            {STORES.map((s) => (
              <span key={s.name} className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                {s.name}
              </span>
            ))}
          </div>

          <div className="mx-auto mt-10 grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              { icon: Zap, title: "За 1 секунду", text: "Сравнение по 4 сетям" },
              { icon: ShieldCheck, title: "Реальные цены", text: "Прямой парсинг сайтов" },
              { icon: Sparkles, title: "История цен", text: "График за 30 дней" },
            ].map((f) => (
              <div
                key={f.title}
                className="flex items-center gap-3 rounded-xl border border-border bg-card/60 p-3 text-left shadow-soft"
              >
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary-soft text-primary">
                  <f.icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{f.title}</p>
                  <p className="text-xs text-muted-foreground">{f.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Лучшие предложения */}
      {data.deals.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-12">
          <div className="mb-5 flex items-end justify-between">
            <div>
              <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
                🔥 Лучшие предложения сегодня
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Товары с самой большой скидкой среди всех сетей
              </p>
            </div>
            <Link
              to="/search"
              search={{ promoOnly: true }}
              className="hidden text-sm font-medium text-primary hover:underline sm:inline"
            >
              Все акции →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {data.deals.map((p, i) => (
              <ProductCard key={p.id} product={p} index={i} />
            ))}
          </div>
        </section>
      )}

      {/* Категории */}
      <section className="mx-auto max-w-7xl px-4 pb-20">
        <h2 className="mb-5 font-display text-2xl font-bold tracking-tight sm:text-3xl">
          Популярные категории
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {data.categories.map((c, i) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <Link
                to="/search"
                search={{ category: c.slug }}
                className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lift"
              >
                <span className="text-3xl">{c.icon}</span>
                <div>
                  <p className="font-medium leading-tight">{c.name}</p>
                  <p className="text-xs text-muted-foreground group-hover:text-primary">
                    Смотреть →
                  </p>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border bg-card/40">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-6 text-xs text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} Ценомер — сравнение цен на продукты</p>
          <p>Москва и область</p>
        </div>
      </footer>
    </div>
  );
}
