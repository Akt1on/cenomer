"""
PerekrestokScraper — парсинг сайта perekrestok.ru.
Парсит: название, цена, старая цена, признак акции, изображение, URL товара.
"""
from typing import List, Dict
from .base import BaseScraper


class PerekrestokScraper(BaseScraper):
    def __init__(self):
        super().__init__("perekrestok")

    async def scrape_category(self, category_url: str, max_products: int = 80) -> List[Dict]:
        p, browser, context = await self.create_context()
        page = await context.new_page()
        products: List[Dict] = []

        try:
            print(f"🌐 [Перекрёсток] {category_url}")
            await page.goto(category_url, wait_until="domcontentloaded", timeout=60_000)
            await self.random_delay(4, 7)
            await self.scroll_page(page, times=6)
            await self.random_delay(2, 4)

            items = await page.query_selector_all(
                "article[class*='product'], div[class*='ProductCard'], "
                "div[data-testid='product-card'], div[class*='product-card']"
            )
            print(f"  Найдено элементов: {len(items)}")

            for item in items[:max_products]:
                try:
                    # Название
                    name_el = await item.query_selector(
                        "h3, h4, [class*='title'], [class*='name'], [data-testid*='title']"
                    )
                    name = (await name_el.inner_text()).strip() if name_el else None
                    if not name or len(name) < 3:
                        continue

                    # Текущая цена
                    price_el = await item.query_selector(
                        "[class*='price-new'], [class*='price_new'], "
                        "[class*='current-price'], [data-testid*='price']"
                    )
                    if not price_el:
                        price_el = await item.query_selector("[class*='price']")
                    price_text = await price_el.inner_text() if price_el else None
                    price = self.parse_price(price_text)
                    if not price:
                        continue

                    # Старая цена (признак акции)
                    old_el = await item.query_selector(
                        "[class*='price-old'], [class*='price_old'], "
                        "[class*='crossed'], [class*='strike'], s, del"
                    )
                    old_price = self.parse_price(await old_el.inner_text() if old_el else None)

                    # Признак акции (бейдж)
                    promo_el = await item.query_selector(
                        "[class*='badge'], [class*='label'], [class*='promo'], "
                        "[class*='discount'], [class*='sale']"
                    )
                    is_promo = promo_el is not None or old_price is not None

                    # Изображение
                    img_el = await item.query_selector("img")
                    image_url = None
                    if img_el:
                        image_url = (
                            await img_el.get_attribute("src")
                            or await img_el.get_attribute("data-src")
                            or await img_el.get_attribute("data-lazy")
                        )
                        if image_url and image_url.startswith("/"):
                            image_url = f"https://www.perekrestok.ru{image_url}"

                    # URL товара
                    link_el = await item.query_selector("a[href]")
                    product_url = None
                    if link_el:
                        href = await link_el.get_attribute("href")
                        if href:
                            product_url = href if href.startswith("http") else f"https://www.perekrestok.ru{href}"

                    products.append(self.make_product(
                        name=name, price=price, old_price=old_price,
                        is_promo=is_promo, image_url=image_url, url=product_url,
                        category_hint="supermarket",
                    ))
                except Exception as e:
                    continue

            print(f"✅ [Перекрёсток] Собрано: {len(products)} товаров "
                  f"({sum(1 for p in products if p['is_promo'])} акций)")
        except Exception as e:
            print(f"❌ [Перекрёсток] Ошибка: {e}")
        finally:
            await browser.close()
            await p.stop()

        return products
