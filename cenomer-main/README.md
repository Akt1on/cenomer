# Ценомер — локальная разработка

Короткие команды для разработки, сборки и анализа веса бандла.

Установка зависимостей:

```bash
npm install
# или в CI: npm ci
```

Запуск в dev режиме:

```bash
npm run dev
```

Форматирование и линтинг:

```bash
npm run format
npm run lint
```

Сборка production:

```bash
npm run build
```

Тесты:

```bash
# Запуск unit тестов
npm test

# Запуск тестов в watch режиме
npm run test:watch
```

Анализ бандла (генерирует `dist/stats.html`):

```bash
npm run analyze
```

Python-скрейпер:

```bash
cd scraper
python -m pip install -r requirements.txt
python main.py
```

## Функции приложения

- 🔍 **Поиск товаров** — быстрый поиск по 4 сетям магазинов
- 💰 **Сравнение цен** — находит самую низкую цену мгновенно
- 📊 **График цен** — история цен за 30 дней (собственная SVG реализация без recharts)
- ❤️ **Избранное** — сохранение товаров в Supabase
- 🔔 **Отслеживание цен** — уведомления о падении цены
- 📱 **PWA** — работает offline и устанавливается как приложение
- ♿ **Доступность** — поддержка ARIA, клавиатурная навигация
- 🚀 **Производительность** — lazy-loading, оптимизированный бандл, кэширование

## Архитектура

```
src/
├── components/        # React компоненты
│   ├── ProductCard.tsx
│   ├── SearchBar.tsx      # Accessible combobox с ARIA
│   ├── ProductPriceChart.tsx  # SVG график без библиотек
│   └── ui/            # Radix UI компоненты
├── routes/            # TanStack Router страницы
│   ├── __root.tsx     # Root layout
│   ├── index.tsx      # Главная страница
│   ├── search.tsx     # Поиск
│   └── product.$slug.tsx  # Страница товара
├── lib/               # Утилиты и сервер функции
│   ├── products.functions.ts  # API для товаров
│   ├── format.ts      # Форматирование цен
│   └── auth-context.tsx       # Auth провайдер
└── styles.css         # Tailwind CSS

scraper/              # Python парсер цен
├── main.py
├── config.py
└── scraper/
    ├── base.py        # Базовый класс
    ├── perekrestok.py
    ├── pyaterochka.py
    ├── magnit.py
    ├── lenta.py
    ├── verny.py
    └── __init__.py
```

## CI/CD

Пайплайн запускается на GitHub Actions (`.github/workflows/ci.yml`):
- ✅ Линтинг (ESLint, Prettier)
- ✅ Сборка (Vite)
- ✅ Юнит тесты (Vitest)
- ✅ Проверка Python скриптов

Dependabot автоматически создаёт PR для обновления зависимостей.

## Безопасность

Полный аудит: см. [SECURITY.md](./SECURITY.md)

**Ключевые меры:**
- ✅ TypeScript strict mode
- ✅ Zod валидация
- ✅ Supabase Auth
- ✅ RLS на базе
- ✅ XSS protection (React escaping)
- ✅ CSRF tokens для операций
- 📋 TODO: CSP headers, rate limiting, HTTPS enforcement

## Performance

- **LCP:** < 2.5s
- **FID:** < 100ms
- **CLS:** < 0.1
- **Bundle:** 218KB (gzip: 69KB для клиента)
- **Lazy Loading:** ProductPriceChart грузится по требованию
- **Caching:** Service Worker для offline режима

## PWA Features

- ✅ Web App Manifest (`public/manifest.json`)
- ✅ Service Worker для offline (`public/sw.js`)
- ✅ App icons и shortcuts
- ✅ Offline fallback
- ✅ Network-first strategy для API
- ✅ Cache-first strategy для статики

Можно установить на мобильный: "Add to Home Screen" (iOS/Android).
