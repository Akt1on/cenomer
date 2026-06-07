"""
BaseScraper — общая база для всех скраперов Ценомер.
Возможности:
  - Playwright с anti-detection (случайные UA, viewport, задержки)
  - Стандартизированный формат товара: name, price, old_price, is_promo,
    image_url, brand, volume, category_hint, url
  - Автоматический retry при ошибке (до 3 попыток)
  - Парсинг цены из любого формата ("129,99 ₽", "1 290 р", "от 45")
  - Scroll для бесконечных страниц
"""
import asyncio
import random
import re
import logging
from pathlib import Path
from typing import List, Dict, Optional
from playwright.async_api import async_playwright, Page, Browser

from scraper.config import USER_AGENTS, DATA_DIR

logger = logging.getLogger(__name__)


class BaseScraper:
    name: str = "base"
    MAX_RETRIES = 3
    RETRY_DELAY = (5.0, 12.0)

    def __init__(self, name: str):
        self.name = name
        self.data_dir = DATA_DIR
        self.data_dir.mkdir(exist_ok=True)

    # ── Утилиты ────────────────────────────────────────────────────────────

    async def random_delay(self, min_sec: float = 3.0, max_sec: float = 8.0) -> None:
        await asyncio.sleep(random.uniform(min_sec, max_sec))

    def parse_price(self, text: str | None) -> Optional[float]:
        """Вытаскивает число из любого ценового текста."""
        if not text:
            return None
        # Убираем всё кроме цифр, запятой и точки
        clean = re.sub(r"[^\d.,]", "", text.strip())
        if not clean:
            return None
        # Если есть запятая как десятичный разделитель
        if "," in clean and "." not in clean:
            clean = clean.replace(",", ".")
        elif "," in clean and "." in clean:
            # формат "1.290,99" → убираем точку-разделитель тысяч
            clean = clean.replace(".", "").replace(",", ".")
        try:
            val = float(clean)
            return round(val, 2) if 1 < val < 100_000 else None
        except ValueError:
            return None

    def extract_brand_volume(self, name: str) -> tuple[str | None, str | None]:
        """Пытается вычленить бренд и объём из названия товара."""
        # Объём: "900 мл", "1 л", "1.5л", "500г", "1 кг"
        vol_match = re.search(
            r"(\d+[\.,]?\d*)\s*(мл|л|г|кг|ml|l|g|kg)\b", name, re.IGNORECASE
        )
        volume = None
        if vol_match:
            val = vol_match.group(1).replace(",", ".")
            unit = vol_match.group(2).lower()
            volume = f"{val} {unit}"

        # Бренд: первое слово в кавычках или первые 1-2 слова до запятой/объёма
        brand_match = re.search(r'[«"\']([^«»"\']+)[»"\']', name)
        brand = brand_match.group(1).strip() if brand_match else None

        return brand, volume

    async def scroll_page(self, page: Page, times: int = 5) -> None:
        """Прокручивает страницу вниз для загрузки lazy-контента."""
        for _ in range(times):
            await page.evaluate("window.scrollBy(0, window.innerHeight * 1.5)")
            await asyncio.sleep(random.uniform(0.8, 1.8))

    async def create_context(self):
        p = await async_playwright().start()
        browser = await p.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-blink-features=AutomationControlled",
                "--disable-dev-shm-usage",
            ],
        )
        context = await browser.new_context(
            user_agent=random.choice(USER_AGENTS),
            viewport={"width": random.randint(1280, 1440), "height": random.randint(800, 900)},
            locale="ru-RU",
            timezone_id="Europe/Moscow",
            extra_http_headers={
                "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            },
        )
        # Скрываем признаки автоматизации
        await context.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
        """)
        return p, browser, context

    async def safe_text(self, page: Page, selector: str) -> Optional[str]:
        try:
            el = await page.query_selector(selector)
            return (await el.inner_text()).strip() if el else None
        except Exception:
            return None

    async def safe_attr(self, page: Page, selector: str, attr: str) -> Optional[str]:
        try:
            el = await page.query_selector(selector)
            return await el.get_attribute(attr) if el else None
        except Exception:
            return None

    # ── Основной метод — переопределяется в каждом скрапере ────────────────

    async def scrape_category(self, url: str, max_products: int = 80) -> List[Dict]:
        raise NotImplementedError

    async def scrape_with_retry(self, url: str, max_products: int = 80) -> List[Dict]:
        """Обёртка с retry — пробует до MAX_RETRIES раз."""
        for attempt in range(1, self.MAX_RETRIES + 1):
            try:
                result = await self.scrape_category(url, max_products)
                if result:
                    return result
                logger.warning(f"[{self.name}] Попытка {attempt}: 0 товаров")
            except Exception as e:
                logger.error(f"[{self.name}] Попытка {attempt} упала: {e}")
            if attempt < self.MAX_RETRIES:
                await self.random_delay(*self.RETRY_DELAY)
        logger.error(f"[{self.name}] Все {self.MAX_RETRIES} попытки провалились")
        return []

    def make_product(
        self,
        name: str,
        price: float,
        *,
        old_price: float | None = None,
        is_promo: bool = False,
        image_url: str | None = None,
        url: str | None = None,
        category_hint: str | None = None,
    ) -> Dict:
        """Создаёт стандартный словарь товара."""
        brand, volume = self.extract_brand_volume(name)
        return {
            "supermarket": self.name,
            "name": name.strip(),
            "price": price,
            "old_price": old_price,
            "is_promo": is_promo or (old_price is not None and old_price > price),
            "image_url": image_url,
            "brand": brand,
            "volume": volume,
            "category_hint": category_hint,
            "url": url,
            "source": self.name,
        }
