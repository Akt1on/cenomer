/**
 * usePushNotifications
 * Регистрирует устройство для push-уведомлений и сохраняет FCM-токен
 * в таблицу device_tokens в Supabase (привязывается к user_id).
 *
 * Использование: вызвать один раз после авторизации.
 */
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { registerPushNotifications, isNative, getPlatform } from "./use-native";
import type { User } from "@supabase/supabase-js";

export function usePushNotifications(user: User | null) {
  useEffect(() => {
    if (!user || !isNative()) return;

    async function setup() {
      const token = await registerPushNotifications();
      if (!token) return;

      // Сохраняем токен в БД — upsert по (user_id, token)
      const { error } = await supabase.from("device_tokens").upsert(
        {
          user_id: user!.id,
          token,
          platform: getPlatform(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,token" },
      );

      if (error) console.error("[Push] Не удалось сохранить токен:", error.message);
      else console.log("[Push] Токен сохранён");
    }

    setup();

    // Слушаем входящие пуши пока приложение открыто
    let cleanup: (() => void) | undefined;
    (async () => {
      if (!isNative()) return;
      try {
        const { PushNotifications } = await import("@capacitor/push-notifications");
        const listener = await PushNotifications.addListener(
          "pushNotificationReceived",
          (notification) => {
            console.log("[Push] Получено:", notification.title);
          },
        );
        cleanup = () => listener.remove();
      } catch {
        /* Push listener unavailable */
      }
    })();

    return () => cleanup?.();
  }, [user]);
}
