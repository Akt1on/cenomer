/**
 * useServiceWorkerUpdate — следит за обновлением SW.
 * Когда новая версия готова, возвращает функцию apply() для обновления.
 */
import { useEffect, useState } from "react";

export function useServiceWorkerUpdate() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.ready.then((reg) => {
      // Уже есть ждущий воркер при первом монтировании
      if (reg.waiting) setWaitingWorker(reg.waiting);

      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            setWaitingWorker(newWorker);
          }
        });
      });
    });

    // Слушаем сообщение от SW что страница нужно обновить
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      window.location.reload();
    });
  }, []);

  function apply() {
    waitingWorker?.postMessage({ type: "SKIP_WAITING" });
    setWaitingWorker(null);
  }

  return { hasUpdate: !!waitingWorker, apply };
}
