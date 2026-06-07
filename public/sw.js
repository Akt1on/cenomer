/**
 * Ценомер Service Worker
 * Стратегия: Network-first для API, Cache-first для статики.
 * Офлайн: показываем кэшированные данные, пока нет сети.
 *
 * ✅ FIX 1.4: CACHE_VERSION заменяется при сборке через vite define
 * ✅ FIX 1.5: /favorites убран из PRECACHE_URLS (требует авторизации → 302)
 */

const CACHE_VERSION = "__APP_VERSION__";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DATA_CACHE = `${CACHE_VERSION}-data`;

// Статика которую кэшируем сразу при установке
// ✅ FIX 1.5: убрали /favorites — она требует авторизации, SW закэширует 302-редирект
const PRECACHE_URLS = ["/", "/search"];

// ── Install: precache shell ────────────────────────────────────────────────
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)));
  self.skipWaiting();
});

// ── Activate: удаляем старые кэши ─────────────────────────────────────────
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("cenomer-") && k !== STATIC_CACHE && k !== DATA_CACHE)
            .map((k) => caches.delete(k)),
        ),
      ),
  );
  self.clients.claim();
});

// ── Fetch: разные стратегии ────────────────────────────────────────────────
self.addEventListener("fetch", (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // Игнорируем не-GET и внешние запросы (Supabase, analytics)
  if (request.method !== "GET") return;
  if (!url.origin.includes(self.location.hostname) && !url.pathname.startsWith("/_server/")) return;

  // API / Server Functions → Network-first, fallback → кэш
  if (url.pathname.startsWith("/_server/") || url.pathname.startsWith("/api/")) {
    e.respondWith(networkFirstDataStrategy(request));
    return;
  }

  // Статика (JS, CSS, шрифты, картинки) → Cache-first
  if (
    url.pathname.match(/\.(js|css|woff2?|png|jpg|svg|ico)$/) ||
    url.pathname.startsWith("/assets/")
  ) {
    e.respondWith(cacheFirstStaticStrategy(request));
    return;
  }

  // HTML-навигация → Network-first с офлайн-фоллбэком
  e.respondWith(networkFirstWithOfflineFallback(request));
});

// Network-first для данных
async function networkFirstDataStrategy(request) {
  const cache = await caches.open(DATA_CACHE);
  try {
    const response = await fetch(request.clone());
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    return (
      cached ??
      new Response(JSON.stringify({ error: "offline", cached: false }), {
        status: 503,
        headers: { "Content-Type": "application/json", "X-Offline": "true" },
      })
    );
  }
}

// Cache-first для статики
async function cacheFirstStaticStrategy(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response("Offline", { status: 503 });
  }
}

// Network-first для навигации
async function networkFirstWithOfflineFallback(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = (await caches.match(request)) ?? (await caches.match("/"));
    return cached ?? new Response("Offline", { status: 503 });
  }
}

// ── Push: входящие уведомления ─────────────────────────────────────────────
self.addEventListener("push", (e) => {
  if (!e.data) return;
  const data = e.data.json();
  e.waitUntil(
    self.registration.showNotification(data.title ?? "Ценомер", {
      body: data.body ?? "",
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      data: data.data ?? {},
      vibrate: [100, 50, 100],
      tag: "price-alert",
      renotify: true,
    }),
  );
});

// Клик по уведомлению → открываем страницу товара
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const slug = e.notification.data?.product_slug;
  const target = slug ? `/product/${slug}` : "/";
  e.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      const existing = clientList.find((c) => c.url.includes(self.location.origin));
      if (existing) return existing.focus().then((c) => c.navigate(target));
      return clients.openWindow(target);
    }),
  );
});

// Принимаем сообщение от useServiceWorkerUpdate
self.addEventListener("message", (e) => {
  if (e.data?.type === "SKIP_WAITING") self.skipWaiting();
});
