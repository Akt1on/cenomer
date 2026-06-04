from .base import BaseScraper
from datetime import datetime
from typing import List, Dict

class LentaScraper(BaseScraper):
    def __init__(self):
        super().__init__("lenta")

    async def scrape_category(self, category_url: str, max_products: int = 60) -> List[Dict]:
        p, browser, context = await self.create_context()
        page = await context.new_page()
        products = []

        try:
            print(f"🌐 [Лента] Открываем: {category_url}")
            await page.goto(category_url, wait_until="networkidle", timeout=90000)
            await self.random_delay(6, 11)

            items = await page.query_selector_all('div[class*="product"], article')

            for item in items[:max_products]:
                try:
                    name = await item.query_selector_eval('h3, [class*="name"]', 'el => el.textContent.trim()')
                    price_text = await item.query_selector_eval('[class*="price"]', 'el => el.textContent')

                    if not name or not price_text:
                        continue

                    price = float(''.join(c for c in price_text if c.isdigit() or c in '.,').replace(',', '.'))

                    products.append({
                        "supermarket": "lenta",
                        "name": name,
                        "price": round(price, 2),
                        "timestamp": datetime.now().isoformat(),
                        "url": category_url,
                        "source": "lenta"
                    })
                except:
                    continue

            print(f"✅ [Лента] Спарсено: {len(products)}")
        except Exception as e:
            print(f"❌ [Лента] Ошибка: {e}")
        finally:
            await browser.close()
            await p.stop()

        return products