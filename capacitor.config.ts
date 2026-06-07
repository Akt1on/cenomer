import { CapacitorConfig } from "@capacitor/cli";

const isDev = process.env.NODE_ENV === "development";

const config: CapacitorConfig = {
  appId: "ru.cenomer.app",
  appName: "Ценомер",
  webDir: "dist",

  // В dev — живой сервер (hot reload), в prod — задеплоенный Vercel
  server: isDev
    ? {
        url: "http://localhost:3000",
        cleartext: true, // HTTP разрешён только в dev
      }
    : {
        // ⚠️ Замени на реальный URL после деплоя на Vercel
        url: "https://cenomer.vercel.app",
        cleartext: false,
      },

  ios: {
    contentInset: "always", // контент не прячется под notch
    backgroundColor: "#fafaf9",
    scrollEnabled: true,
  },

  android: {
    backgroundColor: "#fafaf9",
    allowMixedContent: false,
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: "#fafaf9",
      androidSplashResourceName: "splash",
      iosSpinnerStyle: "small",
      spinnerColor: "#16a34a", // primary green
      showSpinner: false,
    },
    StatusBar: {
      style: "LIGHT", // светлый статус-бар (тёмные иконки)
      backgroundColor: "#fafaf9",
      overlaysWebView: false,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    LocalNotifications: {
      smallIcon: "ic_stat_cenomer",
      iconColor: "#16a34a",
    },
    Keyboard: {
      resize: "body",
      resizeOnFullScreen: true,
    },
  },
};

export default config;
