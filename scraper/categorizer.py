"""
categorizer.py — Автоматическая категоризация товаров через Claude API.

Берёт батч названий товаров → возвращает slug категории для каждого.
Один API-вызов на 100 товаров = ~$0.002. За весь каталог 1000 товаров = ~$0.02.

Использование:
    from scraper.categorizer import categorize_products
    products = await categorize_products(products_list)
"""
import os
import json
import asyncio
import re
import httpx
from typing import List, Dict

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
BATCH_SIZE = 80  # товаров за один вызов API

# Категории которые знает наша БД
KNOWN_CATEGORIES = {
    "moloko": "Молоко и молочные продукты",
    "myaso": "Мясо и птица",
    "ovoshi": "Овощи и зелень",
    "frukty": "Фрукты и ягоды",
    "hleb": "Хлеб и выпечка",
    "ryba": "Рыба и морепродукты",
    "kolbasy": "Колбасы и деликатесы",
    "syry": "Сыры",
    "yaytsa": "Яйца",
    "napitki": "Напитки",
    "sladosti": "Сладости и снеки",
    "krupy": "Крупы и макароны",
    "makarony": "Макароны и паста",
    "zamorozhennye": "Замороженные продукты",
    "konservy": "Консервы",
    "masla": "Масла и соусы",
    "morozhenoe": "Мороженое",
    "bytovaya-khimiya": "Бытовая химия",
    "kosmetika": "Косметика и гигиена",
    "other": "Другое",
}

SYSTEM_PROMPT = f"""Ты категоризатор товаров для продуктового магазина.
Для каждого товара верни один slug категории из этого списка:
{json.dumps(KNOWN_CATEGORIES, ensure_ascii=False, indent=2)}

Правила:
- Верни ТОЛЬКО валидный JSON: массив строк-slug в том же порядке что и входные товары
- Если не уверен — выбери "other"
- Никаких пояснений, только JSON-массив

Пример входа: ["Молоко Простоквашино 3.2%", "Хлеб Бородинский", "Пиво Балтика"]
Пример выхода: ["moloko", "hleb", "napitki"]
"""


async def categorize_batch(names: List[str]) -> List[str]:
    """Категоризирует батч названий через Claude API."""
    if not ANTHROPIC_API_KEY:
        # Без API ключа — базовая эвристика по ключевым словам
        return [_keyword_categorize(n) for n in names]

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": ANTHROPIC_API_KEY,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": "claude-haiku-4-5-20251001",  # самая дешёвая и быстрая модель
                    "max_tokens": 512,
                    "system": SYSTEM_PROMPT,
                    "messages": [{"role": "user", "content": json.dumps(names, ensure_ascii=False)}],
                },
            )
            resp.raise_for_status()
            data = resp.json()
            text = data["content"][0]["text"].strip()

            # Извлекаем JSON из ответа
            match = re.search(r"\[.*?\]", text, re.DOTALL)
            if match:
                result = json.loads(match.group())
                # Валидируем — только известные слаги
                return [
                    slug if slug in KNOWN_CATEGORIES else "other"
                    for slug in result[:len(names)]
                ]
    except Exception as e:
        print(f"  ⚠️  AI-категоризация не удалась: {e} — используем эвристику")

    return [_keyword_categorize(n) for n in names]


def _keyword_categorize(name: str) -> str:
    """Быстрая категоризация по ключевым словам — фоллбэк без API."""
    n = name.lower()
    rules = [
        (["молоко", "кефир", "йогурт", "ряженка", "сметан", "творог", "простокваш"], "moloko"),
        (["мясо", "говядин", "свинин", "баран", "телятин", "фарш"], "myaso"),
        (["курица", "куриц", "птица", "индейк", "утка", "бройлер"], "myaso"),
        (["морковь", "картофель", "картошк", "лук", "помидор", "огурец", "капуст", "перец"], "ovoshi"),
        (["яблок", "банан", "апельсин", "мандарин", "груш", "виноград", "клубник"], "frukty"),
        (["хлеб", "батон", "булк", "лаваш", "пита", "бородинск"], "hleb"),
        (["печень", "рыба", "сёмга", "лосось", "треска", "сельдь", "тунец", "креветк"], "ryba"),
        (["колбас", "сосиск", "сарделк", "ветчин", "балык", "карбонад"], "kolbasy"),
        (["сыр", "моцарелл", "пармезан", "гауда", "чеддер"], "syry"),
        (["яйц"], "yaytsa"),
        (["сок", "вода", "морс", "напиток", "квас", "лимонад", "чай", "кофе", "пиво"], "napitki"),
        (["шоколад", "конфет", "печень", "вафл", "торт", "пряник", "мармелад"], "sladosti"),
        (["крупа", "рис", "гречк", "овсянка", "пшено", "ячмень", "геркулес"], "krupy"),
        (["макарон", "паста", "спагетти", "лапша", "вермишель"], "makarony"),
        (["заморожен", "пельмен", "вареник", "блинч", "котлет замор"], "zamorozhennye"),
        (["консерв", "тушёнк", "паштет", "банка"], "konservy"),
        (["масло", "маргарин", "майонез", "кетчуп", "соус", "уксус"], "masla"),
        (["мороженое", "пломбир", "сорбет"], "morozhenoe"),
        (["шампунь", "гель", "мыло", "зубная", "стиральн", "порошок", "чистящ"], "bytovaya-khimiya"),
    ]
    for keywords, slug in rules:
        if any(kw in n for kw in keywords):
            return slug
    return "other"


async def categorize_products(products: List[Dict]) -> List[Dict]:
    """
    Добавляет поле category_slug к каждому товару.
    Обрабатывает батчами по BATCH_SIZE.
    """
    if not products:
        return products

    names = [p.get("name", "") for p in products]
    all_slugs: List[str] = []

    # Разбиваем на батчи
    for i in range(0, len(names), BATCH_SIZE):
        batch = names[i:i + BATCH_SIZE]
        print(f"  🤖 Категоризация батча {i // BATCH_SIZE + 1} ({len(batch)} товаров)...")
        slugs = await categorize_batch(batch)
        all_slugs.extend(slugs)
        if i + BATCH_SIZE < len(names):
            await asyncio.sleep(0.5)  # небольшая пауза между батчами

    # Проставляем категорию
    for product, slug in zip(products, all_slugs):
        product["category_slug"] = slug
        # Если у товара не было category_hint — ставим из AI
        if not product.get("category_hint"):
            product["category_hint"] = slug

    promo_count = sum(1 for p in products if p.get("is_promo"))
    categorized = sum(1 for p in products if p.get("category_slug") != "other")
    print(f"  ✅ Категоризировано: {categorized}/{len(products)}, акций: {promo_count}")

    return products
