/**
 * Интеграция с Firecrawl для парсинга страниц супермаркетов.
 * Используется как ручным запуском (из админ-кнопки в дальнейшем),
 * так и через scheduled job (см. src/routes/api/public/hooks/refresh-prices.ts).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const FIRECRAWL_BASE = "https://api.firecrawl.dev/v2";

type ScrapedProduct = {
  external_name: string;
  price: number;
  old_price?: number | null;
  url: string;
};

async function firecrawlScrape(url: string, prompt: string): Promise<unknown> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) throw new Error("FIRECRAWL_API_KEY не настроен");
  const res = await fetch(`${FIRECRAWL_BASE}/scrape`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url,
      formats: [{ type: "json", prompt }],
      onlyMainContent: true,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Firecrawl error ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

/**
 * Парсит категорию из Перекрёстка (демо-реализация).
 * В реале — обходит несколько URL-ов и сохраняет нормализованные позиции.
 */
export const scrapePerekrestokCategory = createServerFn({ method: "POST" })
  .inputValidator((input: { categoryUrl: string }) =>
    z.object({ categoryUrl: z.string().url() }).parse(input),
  )
  .handler(async ({ data }) => {
    const result = (await firecrawlScrape(
      data.categoryUrl,
      "Извлеки список товаров с этой страницы каталога супермаркета. Для каждого товара верни: name (название), price (текущая цена в рублях, число), old_price (старая зачёркнутая цена, если есть), url (ссылка на товар). Верни массив items.",
    )) as { data?: { json?: { items?: ScrapedProduct[] } }; json?: { items?: ScrapedProduct[] } };

    const items = result?.data?.json?.items ?? result?.json?.items ?? [];
    return { count: items.length, items };
  });

/**
 * Простой пинг — проверка что Firecrawl настроен.
 */
export const checkFirecrawl = createServerFn({ method: "GET" }).handler(async () => {
  return { configured: !!process.env.FIRECRAWL_API_KEY };
});
