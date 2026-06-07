import { cn } from "@/lib/utils";

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded-lg bg-muted", className)} />
  );
}

// Карточка товара
export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
      <Skeleton className="aspect-square w-full rounded-none" />
      <div className="space-y-2 p-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/3" />
        <div className="flex items-end justify-between pt-1">
          <Skeleton className="h-7 w-20" />
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
        <div className="flex gap-1 pt-1">
          <Skeleton className="h-5 w-16 rounded-md" />
          <Skeleton className="h-5 w-16 rounded-md" />
        </div>
      </div>
    </div>
  );
}

// Грид карточек
export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}

// Страница товара
export function ProductPageSkeleton() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="grid gap-8 md:grid-cols-[1fr_1.2fr]">
        <Skeleton className="aspect-square w-full rounded-2xl" />
        <div className="space-y-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-10 w-1/2" />
          <div className="space-y-2 pt-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
          <div className="flex gap-2 pt-2">
            <Skeleton className="h-10 w-36 rounded-xl" />
            <Skeleton className="h-10 w-36 rounded-xl" />
          </div>
        </div>
      </div>
      <Skeleton className="mt-8 h-64 w-full rounded-2xl" />
    </div>
  );
}

// Главная страница
export function HomePageSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 space-y-10">
      {/* Hero */}
      <div className="text-center space-y-4">
        <Skeleton className="mx-auto h-6 w-48 rounded-full" />
        <Skeleton className="mx-auto h-12 w-2/3" />
        <Skeleton className="mx-auto h-12 w-1/2" />
        <Skeleton className="mx-auto h-14 w-full max-w-2xl rounded-2xl" />
      </div>
      {/* Deals */}
      <div>
        <Skeleton className="mb-5 h-8 w-64" />
        <ProductGridSkeleton count={8} />
      </div>
      {/* Categories */}
      <div>
        <Skeleton className="mb-5 h-8 w-48" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        </div>
      </div>
    </div>
  );
}
