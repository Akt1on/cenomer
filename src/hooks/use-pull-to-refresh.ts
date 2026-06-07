/**
 * usePullToRefresh — нативный pull-to-refresh для мобильных.
 * Триггерится когда пользователь тянет страницу вниз от самого верха.
 *
 * ✅ FIX stale closure: progress в onTouchEnd всегда читал значение 0,
 * потому что замыкание захватывало начальный state.
 *
 * Решение: храним progress в ref (progressRef) — ref всегда актуален
 * даже внутри addEventListener-коллбэков, которые не обновляются
 * при каждом ре-рендере. State (progress, pulling) используем только
 * для рендера индикатора.
 */
import { useEffect, useRef, useState } from "react";
import { hapticLight } from "@/hooks/use-native";

const THRESHOLD = 70; // px до срабатывания

export function usePullToRefresh(onRefresh: () => Promise<void>) {
  const [pulling, setPulling] = useState(false);
  const [progress, setProgress] = useState(0); // 0–1, только для рендера

  const startY = useRef<number | null>(null);
  const refreshing = useRef(false);
  // ✅ FIX: ref синхронен с актуальным progress — нет stale closure
  const progressRef = useRef(0);

  // onRefresh может меняться между рендерами — держим в ref
  const onRefreshRef = useRef(onRefresh);
  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    function onTouchStart(e: TouchEvent) {
      if (window.scrollY === 0) startY.current = e.touches[0].clientY;
    }

    function onTouchMove(e: TouchEvent) {
      if (startY.current === null) return;
      if (window.scrollY > 0) {
        startY.current = null;
        return;
      }
      const delta = e.touches[0].clientY - startY.current;
      if (delta <= 0) return;
      const ratio = Math.min(delta / THRESHOLD, 1);
      // ✅ обновляем ref синхронно — доступен в onTouchEnd без stale closure
      progressRef.current = ratio;
      setProgress(ratio);
      setPulling(true);
      if (ratio >= 1 && !refreshing.current) hapticLight();
    }

    async function onTouchEnd() {
      // ✅ FIX: читаем progressRef.current вместо замкнутого progress (всегда был 0)
      if (progressRef.current >= 1 && !refreshing.current) {
        refreshing.current = true;
        hapticLight();
        await onRefreshRef.current();
        refreshing.current = false;
      }
      startY.current = null;
      progressRef.current = 0;
      setPulling(false);
      setProgress(0);
    }

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: true });
    document.addEventListener("touchend", onTouchEnd);
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
    };
    // ✅ зависимостей нет — listeners регистрируются один раз,
    // актуальные значения читаются через refs
  }, []);

  return { pulling, progress };
}

// Индикатор pull-to-refresh
export function PullIndicator({
  progress,
  pulling,
}: {
  progress: number;
  pulling: boolean;
}) {
  if (!pulling) return null;
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-14 z-50 flex justify-center transition-all"
      style={{ transform: `translateY(${progress * 48}px)` }}
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-card shadow-lift border border-border">
        <svg
          className="h-5 w-5 text-primary"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          style={{
            transform: `rotate(${progress * 360}deg)`,
            transition: progress >= 1 ? "none" : "transform 0.1s",
          }}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
      </div>
    </div>
  );
}
