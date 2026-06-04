import asyncio
import json
from datetime import datetime

from scraper.perekrestok import PerekrestokScraper
from scraper.magnit import MagnitScraper
from scraper.pyaterochka import PyaterochkaScraper
from scraper.lenta import LentaScraper
from scraper.verny import VernyScraper

async def main():
    print("🚀 Запуск системы скрапинга Ценомер\n")

    scrapers = [
        PerekrestokScraper(),
        MagnitScraper(),
        PyaterochkaScraper(),
        LentaScraper(),
        VernyScraper(),
    ]

    for scraper in scrapers:
        if scraper.name == "perekrestok":
            url = "https://www.perekrestok.ru/cat/123/moloko-i-molochnye-produkty/"
        elif scraper.name == "magnit":
            url = "https://dostavka.magnit.ru/catalog/"
        elif scraper.name == "pyaterochka":
            url = "https://5ka.ru/catalog/"
        elif scraper.name == "lenta":
            url = "https://lenta.com/catalog/"
        elif scraper.name == "verny":
            url = "https://www.verno-info.ru/products"
        else:
            url = "https://example.com"

        products = await scraper.scrape_category(url, max_products=50)

        if products:
            filename = f"scraper/data/{scraper.name}_{datetime.now().strftime('%Y%m%d_%H%M')}.json"
            with open(filename, "w", encoding="utf-8") as f:
                json.dump(products, f, ensure_ascii=False, indent=2)
            print(f"💾 Сохранено {len(products)} товаров из {scraper.name}\n")

    print("🎉 Скрапинг завершён!")

if __name__ == "__main__":
    asyncio.run(main())