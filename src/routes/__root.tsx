import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AuthProvider } from "@/lib/auth-context";
import { Toaster } from "sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Страница не найдена</h2>
        <p className="mt-2 text-sm text-muted-foreground">Похоже, такой страницы у нас нет.</p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
        >
          На главную
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Что-то пошло не так</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Мы уже знаем о проблеме. Попробуйте обновить страницу.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
          >
            Обновить
          </button>
          <a
            href="/"
            className="rounded-xl border border-input bg-background px-5 py-2.5 text-sm font-medium hover:bg-muted"
          >
            На главную
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Ценомер — лучший агрегатор цен на продукты в Москве" },
      {
        name: "description",
        content:
          "Сравнивайте цены на продукты в Перекрёстке, Пятёрочке, Магните и Ленте. Самая низкая цена за 1 клик.",
      },
      { name: "theme-color", content: "#16a34a" },
      { property: "og:title", content: "Ценомер — лучший агрегатор цен на продукты в Москве" },
      {
        property: "og:description",
        content:
          "Сравнивайте цены на продукты в Перекрёстке, Пятёрочке, Магните и Ленте. Самая низкая цена за 1 клик.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "Ценомер — лучший агрегатор цен на продукты в Москве" },
      {
        name: "twitter:description",
        content:
          "Сравнивайте цены на продукты в Перекрёстке, Пятёрочке, Магните и Ленте. Самая низкая цена за 1 клик.",
      },
      {
        property: "og:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/49843427-29d8-44a5-b271-212947784cb7/id-preview-8a130d09--22797235-15ac-4a59-a761-e73fc6a8b1da.lovable.app-1780521032001.png",
      },
      {
        name: "twitter:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/49843427-29d8-44a5-b271-212947784cb7/id-preview-8a130d09--22797235-15ac-4a59-a761-e73fc6a8b1da.lovable.app-1780521032001.png",
      },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Ценомер" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.json" },
      {
        rel: "apple-touch-icon",
        href: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 180 180'><rect fill='%2316a34a' width='180' height='180' rx='40'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-size='90' font-weight='bold' fill='white' font-family='system-ui'>₽</text></svg>",
      },
      {
        rel: "icon",
        href: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect fill='%2316a34a' width='32' height='32' rx='6'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-size='18' font-weight='bold' fill='white' font-family='system-ui'>₽</text></svg>",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    // Register service worker for PWA support
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        console.info("Service worker registration failed (offline mode unavailable)");
      });
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Outlet />
        <Toaster position="top-center" richColors closeButton />
      </AuthProvider>
    </QueryClientProvider>
  );
}
