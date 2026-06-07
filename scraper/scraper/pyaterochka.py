"""Пятёрочка scraper — 5ka.ru"""
from typing import List, Dict
from .base import BaseScraper


class PyaterochkaScraper(BaseScraper):
    def __init__(self):
        super().__init__("pyaterochka")

    async def scrape_category(self, category_url: str, max_products: int = 80) -> List[Dict]:
        p, browser, context = await self.create_context()
        page = await context.new_page()
        products: List[Dict] = []

        try:
            print(f"🌐 [Пятёрочка] {category_url}")
            await page.goto(category_url, wait_until="domcontentloaded", timeout=60_000)
            await self.random_delay(4, 8)
            await self.scroll_page(page, times=8)
            await self.random_delay(2, 3)

            items = await page.query_selector_all(
                "div[class*='product-card'], article[class*='product'], "
                "div[data-qa='product-card'], li[class*='product']"
            )
            print(f"  Найдено: {len(items)}")

            for item in items[:max_products]:
                try:
                    name_el = await item.query_selector(
                        "[class*='title'], [class*='name'], h3, h4, [data-qa='product-title']"
                    )
                    name = (await name_el.inner_text()).strip() if name_el else None
                    if not name or len(name) < 3:
                        continue

                    # Пятёрочка: часто цена разделена на рубли и копейки
                    price_el = await item.query_selector(
                        "[class*='current-price'], [class*='price-new'], "
                        "[class*='price__value'], [data-qa='product-price']"
                    )
                    price_text = await price_el.inner_text() if price_el else None

                    # Фоллбэк — берём всё из [class*=price]
                    if not price_text:
                        price_el = await item.query_selector("[class*='price']")
                        price_text = await price_el.inner_text() if price_el else None

                    price = self.parse_price(price_text)
                    if not price:
                        continue

                    # Старая цена
                    old_el = await item.query_selector(
                        "[class*='old-price'], [class*='price-old'], "
                        "[class*='crossed'], del, s, [data-qa='product-old-price']"
                    )
                    old_price = self.parse_price(await old_el.inner_text() if old_el else None)

                    # Бейдж акции
                    badge_el = await item.query_selector(
                        "[class*='badge'], [class*='promo'], [class*='label'], "
                        "[class*='sale'], [class*='discount'], [class*='sticker']"
                    )
                    is_promo = badge_el is not None or old_price is not None

                    # Изображение
                    img_el = await item.query_selector("img")
                    image_url = None
                    if img_el:
                        image_url = (
                            await img_el.get_attribute("src")
                            or await img_el.get_attribute("data-src")
                        )
                        if image_url and image_url.startswith("/"):
                            image_url = f"https://5ka.ru{image_url}"

                    # Ссылка
                    link_el = await item.query_selector("a[href]")
                    href = await link_el.get_attribute("href") if link_el else None
                    product_url = (
                        href if href and href.startswith("http")
                        else f"https://5ka.ru{href}" if href else None
                    )

                    products.append(self.make_product(
                        name=name, price=price, old_price=old_price,
                        is_promo=is_promo, image_url=image_url, url=product_url,
                    ))
                except Exception:
                    continue

            print(f"✅ [Пятёрочка] {len(products)} товаров ({sum(1 for p in products if p['is_promo'])} акций)")
        except Exception as e:
            print(f"❌ [Пятёрочка] Ошибка: {e}")
        finally:
            await browser.close()
            await p.stop()
        return products
