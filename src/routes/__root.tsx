import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, Suspense, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { Toaster } from "sonner";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { useNativePlatform } from "@/hooks/use-native";
import { useOffline, registerServiceWorker } from "@/hooks/use-offline";
import { OfflineBanner } from "@/components/OfflineBanner";
import { UpdateBanner } from "@/components/UpdateBanner";
import { Onboarding, useOnboarding } from "@/components/Onboarding";
import { PullIndicator } from "@/hooks/use-pull-to-refresh";
import { useQueryClient } from "@tanstack/react-query";
import { BottomNav } from "@/components/BottomNav";
import { ThemeProvider } from "@/lib/theme";

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
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "Ценомер" },
      { name: "theme-color", content: "#fafaf9" },
      { name: "mobile-web-app-capable", content: "yes" },
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
    ],
    links: [{ rel: "stylesheet", href: appCss }],
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

function AppInner() {
  const { user } = useAuth();
  const { isIos } = useNativePlatform();
  usePushNotifications(user);

  // Регистрируем Service Worker для офлайн-поддержки
  useEffect(() => {
    registerServiceWorker();
  }, []);

  // Обрабатываем реферальный код из URL при первом открытии
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref) {
      localStorage.setItem("cenomer-pending-ref", ref.toUpperCase());
      // Убираем из URL без перезагрузки
      const clean = window.location.pathname;
      window.history.replaceState({}, "", clean);
    }
  }, []);

  const showOnboarding = useOnboarding();
  const [onboardingDone, setOnboardingDone] = useState(!showOnboarding);
  const queryClient = useQueryClient();
  const [pulling, setPulling] = useState(false);
  const [pullProgress, setPullProgress] = useState(0);

  useEffect(() => {
    // Pull-to-refresh
    let startY: number | null = null;
    const THRESHOLD = 70;

    function onTouchStart(e: TouchEvent) {
      if (window.scrollY === 0) startY = e.touches[0].clientY;
    }
    function onTouchMove(e: TouchEvent) {
      if (startY === null || window.scrollY > 0) return;
      const delta = e.touches[0].clientY - startY;
      if (delta <= 0) return;
      setPullProgress(Math.min(delta / THRESHOLD, 1));
      setPulling(true);
    }
    async function onTouchEnd() {
      if (pullProgress >= 1) {
        await queryClient.invalidateQueries();
      }
      startY = null;
      setPulling(false);
      setPullProgress(0);
    }
    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: true });
    document.addEventListener("touchend", onTouchEnd);
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, [pullProgress, queryClient]);

  if (!onboardingDone) return <Onboarding onDone={() => setOnboardingDone(true)} />;

  return (
    <>
      <OfflineBanner />
      <PullIndicator progress={pullProgress} pulling={pulling} />
      {isIos && <div className="h-[env(safe-area-inset-top)] bg-background" />}
      <div className="pb-16 lg:pb-0">
        <Outlet />
      </div>
      <BottomNav />
      <UpdateBanner />
      <Toaster position="top-center" richColors closeButton />
    </>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AppInner />
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
