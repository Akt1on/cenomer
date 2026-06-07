"""
deduplicator.py — Нормализация и дедупликация товаров.

Проблема: «Молоко Простоквашино 3.2% 900мл» в Перекрёстке и
«Молоко Простоквашино, 3,2%, 0.9 л» в Пятёрочке — один товар,
но создаются как два разных slug.

Решение:
1. Нормализуем название: нижний регистр, стоп-слова, числа
2. Генерируем canonical_slug для группировки
3. При загрузке в Supabase upsert идёт по canonical_slug, не по raw slug
"""
import re
import unicodedata
from typing import List, Dict


# Стоп-слова которые не несут смысл для идентификации товара
STOP_WORDS = {
    "и", "в", "на", "с", "по", "для", "из", "от", "до", "не",
    "ед", "шт", "уп", "упак", "пак", "пакет", "штук",
}


def normalize_text(text: str) -> str:
    """Нормализует текст для сравнения."""
    # Транслитерация не нужна — всё на кириллице
    text = text.lower().strip()

    # Приводим объём к единому виду: "0.9л" = "900мл" = "0,9 л"
    text = re.sub(r"(\d+)[.,](\d+)\s*л\b", lambda m: f"{int(float(m.group(1) + '.' + m.group(2)) * 1000)}мл", text)
    text = re.sub(r"(\d+)\s*л\b", lambda m: f"{int(m.group(1)) * 1000}мл", text)
    text = re.sub(r"(\d+)[.,](\d+)\s*кг\b", lambda m: f"{int(float(m.group(1) + '.' + m.group(2)) * 1000)}г", text)
    text = re.sub(r"(\d+)\s*кг\b", lambda m: f"{int(m.group(1)) * 1000}г", text)

    # Убираем лишние символы, оставляем буквы, цифры, пробелы
    text = re.sub(r"[^\w\s]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()

    # Убираем стоп-слова
    words = [w for w in text.split() if w not in STOP_WORDS and len(w) > 1]

    return " ".join(words)


def make_canonical_slug(name: str) -> str:
    """Создаёт canonical slug для группировки одинаковых товаров."""
    normalized = normalize_text(name)

    # Транслитерация кириллицы для slug
    translit_map = {
        "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "yo",
        "ж": "zh", "з": "z", "и": "i", "й": "y", "к": "k", "л": "l", "м": "m",
        "н": "n", "о": "o", "п": "p", "р": "r", "с": "s", "т": "t", "у": "u",
        "ф": "f", "х": "kh", "ц": "ts", "ч": "ch", "ш": "sh", "щ": "shch",
        "ъ": "", "ы": "y", "ь": "", "э": "e", "ю": "yu", "я": "ya",
    }
    slug = "".join(translit_map.get(c, c) for c in normalized)
    slug = re.sub(r"[^a-z0-9]+", "-", slug).strip("-")
    return slug[:120]


def similarity_score(a: str, b: str) -> float:
    """Trigram similarity между двумя строками (0..1)."""
    def trigrams(s: str):
        s = f"  {s}  "
        return {s[i:i+3] for i in range(len(s) - 2)}

    ta, tb = trigrams(a), trigrams(b)
    if not ta or not tb:
        return 0.0
    return len(ta & tb) / len(ta | tb)


def deduplicate_products(products: List[Dict], threshold: float = 0.75) -> List[Dict]:
    """
    Группирует дубликаты и оставляет один canonical товар.
    Дубликаты из разных магазинов → разные store_products для одного product.

    Возвращает список уникальных товаров с полем `canonical_slug`.
    Каждый товар сохраняет оригинальный store + цену.
    """
    # Проставляем canonical_slug всем товарам
    for p in products:
        p["canonical_slug"] = make_canonical_slug(p["name"])

    # Группируем по canonical_slug
    groups: Dict[str, List[Dict]] = {}
    for p in products:
        slug = p["canonical_slug"]
        if slug not in groups:
            groups[slug] = []
        groups[slug].append(p)

    # Вторичная дедупликация внутри магазина — по trigram similarity
    # (один магазин не должен иметь двух разных цен для одного товара)
    result: List[Dict] = []
    for slug, group in groups.items():
        # Для разных магазинов — всё ок, они будут разными store_products
        seen_stores: Dict[str, Dict] = {}
        for p in group:
            store = p.get("supermarket", "")
            if store not in seen_stores:
                seen_stores[store] = p
            else:
                # Если уже есть от этого магазина — берём с акцией или дешевле
                existing = seen_stores[store]
                if p.get("is_promo") and not existing.get("is_promo"):
                    seen_stores[store] = p
                elif p.get("price", 999999) < existing.get("price", 999999):
                    seen_stores[store] = p

        result.extend(seen_stores.values())

    print(f"  🔁 Дедупликация: {len(products)} → {len(result)} уникальных товаров")
    return result


def group_by_canonical(products: List[Dict]) -> Dict[str, List[Dict]]:
    """
    Возвращает словарь canonical_slug → список товаров из разных магазинов.
    Используется в main.py для загрузки в Supabase.
    """
    groups: Dict[str, List[Dict]] = {}
    for p in products:
        slug = p.get("canonical_slug") or make_canonical_slug(p["name"])
        if slug not in groups:
            groups[slug] = []
        groups[slug].append(p)
    return groups
