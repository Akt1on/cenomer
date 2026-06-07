/**
 * useNative — единая точка доступа к Capacitor API.
 * Безопасно импортирует плагины: если запускается в браузере,
 * нативные вызовы просто игнорируются (no-op).
 */
import { useEffect, useState } from "react";

interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  getPlatform?: () => "ios" | "android" | "web";
}

interface WindowWithCapacitor extends Window {
  Capacitor?: CapacitorGlobal;
}

function getCapacitorWindow(): WindowWithCapacitor {
  return window as WindowWithCapacitor;
}

// Определяем, запущено ли приложение нативно (iOS/Android)
export function isNative(): boolean {
  const capacitor = getCapacitorWindow().Capacitor;
  return typeof capacitor !== "undefined" && capacitor?.isNativePlatform?.() === true;
}

export function getPlatform(): "ios" | "android" | "web" {
  if (!isNative()) return "web";
  return getCapacitorWindow().Capacitor?.getPlatform?.() ?? "web";
}

// ── Haptics (тактильная отдача) ────────────────────────────────────────────
export async function hapticLight() {
  if (!isNative()) return;
  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    /* Capacitor plugin unavailable */
  }
}

export async function hapticSuccess() {
  if (!isNative()) return;
  try {
    const { Haptics, NotificationType } = await import("@capacitor/haptics");
    await Haptics.notification({ type: NotificationType.Success });
  } catch {
    /* Capacitor plugin unavailable */
  }
}

export async function hapticMedium() {
  if (!isNative()) return;
  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    await Haptics.impact({ style: ImpactStyle.Medium });
  } catch {
    /* Capacitor plugin unavailable */
  }
}

// ── StatusBar ──────────────────────────────────────────────────────────────
export async function setStatusBarLight() {
  if (!isNative()) return;
  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({ style: Style.Light });
    await StatusBar.setBackgroundColor({ color: "#fafaf9" });
  } catch {
    /* Capacitor plugin unavailable */
  }
}

export async function setStatusBarDark() {
  if (!isNative()) return;
  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: "#1a1a1a" });
  } catch {
    /* Capacitor plugin unavailable */
  }
}

// ── Push Notifications ─────────────────────────────────────────────────────
export async function registerPushNotifications(): Promise<string | null> {
  if (!isNative()) return null;
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");

    const permission = await PushNotifications.requestPermissions();
    if (permission.receive !== "granted") return null;

    await PushNotifications.register();

    return new Promise((resolve) => {
      PushNotifications.addListener("registration", (token) => {
        console.log("[Push] FCM token:", token.value);
        resolve(token.value);
      });
      PushNotifications.addListener("registrationError", () => resolve(null));
      // Таймаут на случай если событие не придёт
      setTimeout(() => resolve(null), 5000);
    });
  } catch {
    return null;
  }
}

// ── Share ──────────────────────────────────────────────────────────────────
export async function shareProduct(name: string, url: string) {
  if (!isNative()) {
    // Фоллбэк: Web Share API или просто копирование
    if (navigator.share) {
      await navigator.share({ title: name, url });
    } else {
      await navigator.clipboard.writeText(url);
    }
    return;
  }
  try {
    const { Share } = await import("@capacitor/share");
    await Share.share({
      title: name,
      text: `Смотри цену на ${name} в Ценомере`,
      url,
      dialogTitle: "Поделиться товаром",
    });
  } catch {
    /* Capacitor plugin unavailable */
  }
}

// ── Хук: платформа + safe-area insets ─────────────────────────────────────
export function useNativePlatform() {
  const [platform, setPlatform] = useState<"ios" | "android" | "web">("web");

  useEffect(() => {
    setPlatform(getPlatform());
    if (isNative()) {
      setStatusBarLight();
    }
  }, []);

  return { platform, isNative: platform !== "web", isIos: platform === "ios" };
}
