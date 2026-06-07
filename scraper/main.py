"""
Главный скрипт скрапинга Ценомер v2.
Новое в этой версии:
  - Все скраперы: old_price, is_promo, image_url, brand, volume
  - AI-категоризация через Claude API (батчами)
  - Дедупликация: canonical_slug для группировки одинаковых товаров
  - Retry при ошибке (до 3 попыток)
  - Telegram-алерт если 0 товаров загружено
  - --dry-run: только JSON без записи в БД

✅ FIX 1.3: помечаем in_stock=false товары которых нет в текущем скрапинге
✅ FIX 5.3: asyncio.Semaphore(3) чтобы не парсить все магазины одновременно

Запуск:
  python main.py                 # полный прогон
  python main.py --dry-run       # только JSON
  python main.py --store magnit  # только один магазин
  python main.py --no-ai         # без AI-категоризации
"""
import asyncio
import json
import argparse
import httpx
import os
from datetime import datetime
from pathlib import Path

from supabase import create_client, Client
from scraper.perekrestok import PerekrestokScraper
from scraper.magnit import MagnitScraper
from scraper.pyaterochka import PyaterochkaScraper
from scraper.lenta import LentaScraper
from scraper.verny import VernyScraper
from scraper.categorizer import categorize_products
from scraper.deduplicator import deduplicate_products, group_by_canonical
from scraper.config import SUPABASE_URL, SUPABASE_KEY, DATA_DIR

# ── Конфигурация магазинов ─────────────────────────────────────────────────
SCRAPER_CONFIG = [
    {
        "scraper": PerekrestokScraper(),
        "store_slug": "perekrestok",
        "urls": [
            "https://www.perekrestok.ru/cat/123/moloko-i-molochnye-produkty/",
            "https://www.perekrestok.ru/cat/124/myaso-i-ptitsa/",
            "https://www.perekrestok.ru/cat/125/ovoshi-i-frukty/",
        ],
    },
    {
        "scraper": MagnitScraper(),
        "store_slug": "magnit",
        "urls": [
            "https://dostavka.magnit.ru/catalog/moloko-i-molochnye-produkty/",
            "https://dostavka.magnit.ru/catalog/myaso-i-ptitsa/",
        ],
    },
    {
        "scraper": PyaterochkaScraper(),
        "store_slug": "pyaterochka",
        "urls": [
            "https://5ka.ru/catalog/molochnyye_produkty/",
            "https://5ka.ru/catalog/myaso/",
        ],
    },
    {
        "scraper": LentaScraper(),
        "store_slug": "lenta",
        "urls": [
            "https://lenta.com/catalog/molochnye-produkty/",
            "https://lenta.com/catalog/myaso/",
        ],
    },
    {
        "scraper": VernyScraper(),
        "store_slug": "verny",
        "urls": [
            "https://www.verno-info.ru/products",
        ],
    },
]

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")

# ✅ FIX 5.3: семафор ограничивает параллельный скрапинг до 3 магазинов
semaphore = asyncio.Semaphore(3)


async def send_telegram_alert(message: str) -> None:
    """Отправляет алерт в Telegram если что-то пошло не так."""
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        return
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(
                f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage",
                json={"chat_id": TELEGRAM_CHAT_ID, "text": f"🚨 Ценомер: {message}", "parse_mode": "HTML"},
            )
    except Exception as e:
        print(f"  ⚠️ Telegram алерт не отправлен: {e}")


def get_supabase() -> Client:
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise RuntimeError("SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY должны быть в .env")
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def upsert_to_supabase(sb: Client, store_slug: str, products: list[dict]) -> int:
    """
    Загружает товары в Supabase с дедупликацией по canonical_slug.
    ✅ FIX 1.3: после upsert помечает отсутствующие товары as in_stock=false.
    Возвращает количество успешно обработанных.
    """
    # Получаем store_id
    res = sb.table("stores").select("id").eq("slug", store_slug).maybe_single().execute()
    if not res.data:
        print(f"  ⚠️  Магазин '{store_slug}' не найден в БД")
        return 0
    store_id: str = res.data["id"]

    # Получаем category_id по slug
    cats_res = sb.table("categories").select("id, slug").execute()
    cat_map = {c["slug"]: c["id"] for c in (cats_res.data or [])}

    ok_count = 0
    scraped_product_ids: list[str] = []  # ✅ FIX 1.3: собираем ID скрапнутых товаров

    for item in products:
        name = (item.get("name") or "").strip()
        price = item.get("price")
        if not name or not price:
            continue

        canonical_slug = item.get("canonical_slug") or name.lower()[:80]
        category_id = cat_map.get(item.get("category_slug") or "")

        try:
            # 1. Upsert product по canonical_slug
            prod_res = sb.table("products").upsert(
                {
                    "slug": canonical_slug,
                    "name": name,
                    "brand": item.get("brand"),
                    "volume": item.get("volume"),
                    "image_url": item.get("image_url"),
                    "category_id": category_id,
                },
                on_conflict="slug",
                returning="representation",
            ).execute()

            if not prod_res.data:
                continue
            product_id: str = prod_res.data[0]["id"]
            scraped_product_ids.append(product_id)  # ✅ FIX 1.3

            # UTM-метки для реферальных ссылок
            raw_url = item.get("url")
            store_product_url = None
            if raw_url:
                sep = "&" if "?" in raw_url else "?"
                store_product_url = f"{raw_url}{sep}utm_source=cenomer&utm_medium=aggregator&utm_campaign=price"

            # 2. Upsert store_product
            sb.table("store_products").upsert(
                {
                    "product_id": product_id,
                    "store_id": store_id,
                    "price": round(float(price), 2),
                    "old_price": item.get("old_price"),
                    "is_promo": bool(item.get("is_promo", False)),
                    "store_product_url": store_product_url,
                    "in_stock": True,
                    "fetched_at": datetime.utcnow().isoformat(),
                },
                on_conflict="product_id,store_id",
            ).execute()

            # 3. История цен
            sb.table("price_history").insert({
                "product_id": product_id,
                "store_id": store_id,
                "price": round(float(price), 2),
            }).execute()

            ok_count += 1
        except Exception as e:
            print(f"  ⚠️  Ошибка записи '{name}': {e}")
            continue

    # ✅ FIX 1.3: помечаем товары которых не было в этом скрапинге как вышедшие из продажи
    if scraped_product_ids:
        try:
            sb.table("store_products").update({"in_stock": False}) \
                .eq("store_id", store_id) \
                .not_.in_("product_id", scraped_product_ids) \
                .execute()
            print(f"  🔄 Помечены как in_stock=false: товары не вошедшие в текущий скрапинг")
        except Exception as e:
            print(f"  ⚠️  Ошибка при пометке in_stock=false: {e}")

    return ok_count


async def scrape_store(cfg: dict) -> tuple[str, list[dict]]:
    """Скрапит один магазин и возвращает (store_slug, products)."""
    scraper = cfg["scraper"]
    store_slug = cfg["store_slug"]
    urls = cfg["urls"]
    all_products: list[dict] = []

    print(f"━━━ {store_slug.upper()} ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

    for url in urls:
        result = await scraper.scrape_with_retry(url, max_products=60)
        all_products.extend(result)
        await asyncio.sleep(2)  # пауза между категориями

    return store_slug, all_products


async def scrape_store_with_limit(cfg: dict) -> tuple[str, list[dict]]:
    """✅ FIX 5.3: оборачиваем скрапинг в семафор."""
    async with semaphore:
        return await scrape_store(cfg)


async def main(
    dry_run: bool = False,
    store_filter: str | None = None,
    use_ai: bool = True,
) -> None:
    start = datetime.now()
    print(f"\n🚀 Ценомер Scraper v2 — {start.strftime('%Y-%m-%d %H:%M')}")
    print(f"   Режим: {'dry-run' if dry_run else 'production'} | AI: {'вкл' if use_ai else 'выкл'}\n")

    sb = None if dry_run else get_supabase()
    DATA_DIR.mkdir(exist_ok=True)
    timestamp = start.strftime("%Y%m%d_%H%M")

    total_scraped = 0
    total_uploaded = 0
    errors: list[str] = []

    configs = [c for c in SCRAPER_CONFIG if not store_filter or c["store_slug"] == store_filter]

    # ✅ FIX 5.3: запускаем все магазины параллельно, но с ограничением через семафор
    tasks = [scrape_store_with_limit(cfg) for cfg in configs]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    for cfg, result in zip(configs, results):
        store_slug = cfg["store_slug"]

        if isinstance(result, Exception):
            msg = f"Ошибка скрапинга {store_slug}: {result}"
            print(f"  ❌ {msg}")
            errors.append(msg)
            continue

        store_slug, all_products = result

        if not all_products:
            msg = f"0 товаров из {store_slug}"
            print(f"  ❌ {msg}")
            errors.append(msg)
            continue

        total_scraped += len(all_products)
        print(f"  📦 Собрано: {len(all_products)} товаров")

        # AI-категоризация
        if use_ai:
            all_products = await categorize_products(all_products)

        # Дедупликация
        all_products = deduplicate_products(all_products)

        # JSON-дамп для отладки
        out_file = DATA_DIR / f"{store_slug}_{timestamp}.json"
        with open(out_file, "w", encoding="utf-8") as f:
            json.dump(all_products, f, ensure_ascii=False, indent=2)
        print(f"  💾 JSON: {out_file}")

        # Загрузка в Supabase
        if not dry_run:
            uploaded = upsert_to_supabase(sb, store_slug, all_products)
            total_uploaded += uploaded
            print(f"  ✅ В Supabase: {uploaded}/{len(all_products)}")
        print()

    # Итог
    elapsed = (datetime.now() - start).seconds
    print(f"━━━ ИТОГ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print(f"  Собрано:   {total_scraped} товаров")
    if not dry_run:
        print(f"  Загружено: {total_uploaded} в Supabase")
    print(f"  Время:     {elapsed}с")
    if errors:
        print(f"  Ошибки:    {', '.join(errors)}")

    # Telegram алерт если всё плохо
    if not dry_run and total_uploaded == 0:
        await send_telegram_alert(
            f"❌ Скрапинг завершён с 0 загруженными товарами!\n"
            f"Ошибки: {', '.join(errors) or 'нет данных'}"
        )
    elif not dry_run and errors:
        await send_telegram_alert(
            f"⚠️ Скрапинг завершён с ошибками: {', '.join(errors)}\n"
            f"Загружено: {total_uploaded}/{total_scraped}"
        )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Ценомер Scraper v2")
    parser.add_argument("--dry-run", action="store_true", help="Только JSON, без Supabase")
    parser.add_argument("--store", type=str, default=None, help="Только один магазин (perekrestok/magnit/...)")
    parser.add_argument("--no-ai", action="store_true", help="Без AI-категоризации")
    args = parser.parse_args()

    asyncio.run(main(dry_run=args.dry_run, store_filter=args.store, use_ai=not args.no_ai))
