/**
 * useOffline — отслеживает состояние сети.
 * Показывает баннер когда нет интернета.
 * Также регистрирует Service Worker.
 */
import { useEffect, useState } from "react";

export function useOffline() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  return isOffline;
}

// Регистрируем Service Worker один раз
export function registerServiceWorker() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", async () => {
    try {
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      console.log("[SW] Зарегистрирован:", reg.scope);

      // Проверяем обновление каждые 60 минут
      setInterval(() => reg.update(), 60 * 60 * 1000);
    } catch (err) {
      console.warn("[SW] Ошибка регистрации:", err);
    }
  });
}
