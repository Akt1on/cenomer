import asyncio
import random
from pathlib import Path
from playwright.async_api import async_playwright
from datetime import datetime
from scraper.config import USER_AGENTS

class BaseScraper:
    def __init__(self, name: str):
        self.name = name
        self.data_dir = Path(__file__).parent.parent / "data"
        self.data_dir.mkdir(exist_ok=True)

    async def random_delay(self, min_sec: float = 4.0, max_sec: float = 11.0):
        """Уважительная задержка"""
        delay = random.uniform(min_sec, max_sec)
        await asyncio.sleep(delay)
        return delay

    async def create_context(self):
        p = await async_playwright().start()
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent=random.choice(USER_AGENTS),
            viewport={"width": 1280, "height": 900},
            locale="ru-RU"
        )
        return p, browser, context