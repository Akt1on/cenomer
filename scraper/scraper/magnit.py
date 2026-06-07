"""Магнит scraper — dostavka.magnit.ru"""
from typing import List, Dict
from .base import BaseScraper


class MagnitScraper(BaseScraper):
    def __init__(self):
        super().__init__("magnit")

    async def scrape_category(self, category_url: str, max_products: int = 80) -> List[Dict]:
        p, browser, context = await self.create_context()
        page = await context.new_page()
        products: List[Dict] = []

        try:
            print(f"🌐 [Магнит] {category_url}")
            await page.goto(category_url, wait_until="domcontentloaded", timeout=60_000)
            await self.random_delay(5, 9)
            await self.scroll_page(page, times=7)
            await self.random_delay(2, 4)

            items = await page.query_selector_all(
                "div[class*='product-card'], article, "
                "div[class*='goods-card'], li[class*='product']"
            )
            print(f"  Найдено: {len(items)}")

            for item in items[:max_products]:
                try:
                    name_el = await item.query_selector(
                        "[class*='title'], [class*='name'], h3, h4"
                    )
                    name = (await name_el.inner_text()).strip() if name_el else None
                    if not name or len(name) < 3:
                        continue

                    price_el = await item.query_selector(
                        "[class*='price-new'], [class*='new-price'], "
                        "[class*='current'], [class*='actual']"
                    )
                    if not price_el:
                        price_el = await item.query_selector("[class*='price']")
                    price = self.parse_price(await price_el.inner_text() if price_el else None)
                    if not price:
                        continue

                    old_el = await item.query_selector(
                        "[class*='old-price'], [class*='price-old'], del, s"
                    )
                    old_price = self.parse_price(await old_el.inner_text() if old_el else None)

                    badge_el = await item.query_selector(
                        "[class*='badge'], [class*='label'], [class*='promo'], [class*='discount']"
                    )
                    is_promo = badge_el is not None or old_price is not None

                    img_el = await item.query_selector("img")
                    image_url = None
                    if img_el:
                        image_url = (
                            await img_el.get_attribute("src")
                            or await img_el.get_attribute("data-src")
                        )
                        if image_url and image_url.startswith("/"):
                            image_url = f"https://dostavka.magnit.ru{image_url}"

                    link_el = await item.query_selector("a[href]")
                    href = await link_el.get_attribute("href") if link_el else None
                    product_url = (
                        href if href and href.startswith("http")
                        else f"https://dostavka.magnit.ru{href}" if href else None
                    )

                    products.append(self.make_product(
                        name=name, price=price, old_price=old_price,
                        is_promo=is_promo, image_url=image_url, url=product_url,
                    ))
                except Exception:
                    continue

            print(f"✅ [Магнит] {len(products)} товаров ({sum(1 for p in products if p['is_promo'])} акций)")
        except Exception as e:
            print(f"❌ [Магнит] Ошибка: {e}")
        finally:
            await browser.close()
            await p.stop()
        return products
