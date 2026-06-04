from .base import BaseScraper
from datetime import datetime
from typing import List, Dict

class VernyScraper(BaseScraper):
    def __init__(self):
        super().__init__("verny")

    async def scrape_category(self, category_url: str, max_products: int = 60) -> List[Dict]:
        p, browser, context = await self.create_context()
        page = await context.new_page()
        products = []

        try:
            print(f"🌐 [Верный] Открываем: {category_url}")
            await page.goto(category_url, wait_until="networkidle", timeout=90000)
            await self.random_delay(7, 12)

            items = await page.query_selector_all('div[class*="product"], article, div[class*="card"]')

            for item in items[:max_products]:
                try:
                    name_el = await item.query_selector('h3, h4, [class*="title"], [class*="name"]')
                    name = await name_el.inner_text() if name_el else None

                    price_el = await item.query_selector('[class*="price"], [data-testid*="price"]')
                    price_text = await price_el.inner_text() if price_el else None

                    if not name or not price_text:
                        continue

                    price_clean = ''.join(c for c in price_text if c.isdigit() or c in '.,')
                    price = float(price_clean.replace(',', '.'))

                    products.append({
                        "supermarket": "verny",
                        "name": name.strip(),
                        "price": round(price, 2),
                        "timestamp": datetime.now().isoformat(),
                        "url": category_url,
                        "source": "verny"
                    })
                except:
                    continue

            print(f"✅ [Верный] Спарсено: {len(products)}")
        except Exception as e:
            print(f"❌ [Верный] Ошибка: {e}")
        finally:
            await browser.close()
            await p.stop()

        return products