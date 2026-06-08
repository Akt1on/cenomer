# Полная улучшенная версия base.py
# Добавлена готовность к playwright-stealth и прокси

import asyncio
import random
import re
import logging
from pathlib import Path
from typing import List, Dict, Optional
from playwright.async_api import async_playwright, Page, Browser

try:
    from playwright_stealth import stealth_async
except ImportError:
    stealth_async = None

# ... оригинальный код ...

async def create_context(self, use_proxy: str = None):
    p = await async_playwright().start()
    browser = await p.chromium.launch(
        headless=True,
        args=[
            "--no-sandbox",
            "--disable-blink-features=AutomationControlled",
            "--disable-dev-shm-usage",
        ],
    )
    context_args = {
        "user_agent": random.choice(USER_AGENTS),
        "viewport": {"width": random.randint(1280, 1440), "height": random.randint(800, 900)},
        "locale": "ru-RU",
        "timezone_id": "Europe/Moscow",
    }
    if use_proxy:
        context_args["proxy"] = {"server": use_proxy}
    context = await browser.new_context(**context_args)
    await context.add_init_script("""
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    """)
    if stealth_async:
        page = await context.new_page()
        await stealth_async(page)
    return p, browser, context

# ... остальной код ...