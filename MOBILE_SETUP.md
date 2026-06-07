# 📱 Ценомер — Mobile Setup Guide

## Шаг 1: Задеплоить на Vercel

```bash
npm install -g vercel
vercel --prod
```

После деплоя получишь URL типа `https://cenomer-abc123.vercel.app`.
Открой `capacitor.config.ts` и замени строку:
```ts
url: "https://cenomer.vercel.app",  // ← сюда свой URL
```

---

## Шаг 2: Установить зависимости

```bash
npm install
```

---

## Шаг 3: Подготовить иконки

1. Создай два файла по инструкции в `assets/README.md`
2. Положи их как `assets/icon.png` и `assets/splash.png`
3. Запусти генерацию:
```bash
npm run mobile:icons
```

---

## Шаг 4: Инициализировать платформы

```bash
# Только первый раз
npx cap add ios
npx cap add android
```

---

## Шаг 5: Сборка и синхронизация

```bash
npm run build:mobile
# = vite build + cap sync
```

---

## Шаг 6: Открыть в IDE и запустить

```bash
# iOS (нужен Mac + Xcode)
npm run mobile:ios

# Android (нужен Android Studio)
npm run mobile:android
```

---

## Шаг 7: Firebase Push Notifications

1. Создай проект на https://console.firebase.google.com
2. Добавь iOS приложение (`ru.cenomer.app`) → скачай `GoogleService-Info.plist`
3. Добавь Android приложение (`ru.cenomer.app`) → скачай `google-services.json`
4. Положи файлы:
   - `GoogleService-Info.plist` → в папку `ios/App/App/`
   - `google-services.json` → в папку `android/app/`
5. В Firebase Console → Cloud Messaging → скопируй Server Key
6. Добавь в Supabase:
```bash
supabase secrets set FCM_SERVER_KEY=AAAAxxxxxxx...
```
7. Задеплой Edge Function:
```bash
supabase functions deploy send-price-alerts
```

---

## Шаг 8: Публикация

### Google Play
1. В Android Studio: Build → Generate Signed Bundle/APK → Android App Bundle
2. Загрузи `.aab` в Google Play Console
3. Заполни описание, скриншоты, категорию (Покупки)

### App Store
1. В Xcode: Product → Archive
2. Загрузи через Xcode Organizer или Transporter
3. В App Store Connect заполни описание, скриншоты

---

## Переменные окружения (.env)

```
SUPABASE_URL=...
SUPABASE_PUBLISHABLE_KEY=...
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
CRON_SECRET=...                    # для защиты /api/public/hooks/refresh-prices
```

---

## Частые проблемы

**`cap sync` не видит изменений** → удали `ios/` и `android/` папки, запусти `cap add` заново

**iOS: белый экран** → проверь `server.url` в `capacitor.config.ts`, убедись что Vercel задеплоен

**Android: сеть не работает** → добавь домен в `android/app/src/main/res/xml/network_security_config.xml`

**Push не приходят** → проверь что `FCM_SERVER_KEY` задан в Supabase secrets, токен сохранился в таблице `device_tokens`
