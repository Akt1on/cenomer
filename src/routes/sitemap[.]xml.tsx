/**
 * Динамический sitemap.xml для Яндекс/Google.
 * Включает все страницы товаров из БД.
 */
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/sitemap[.]xml")({
  server: {
    handlers: {
      GET: async () => {
        const sb = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
        );

        const BASE = "https://cenomer.vercel.app"; // ⚠️ поменяй на свой домен
        const now = new Date().toISOString().slice(0, 10);

        const { data: products } = await sb
          .from("products")
          .select("slug, updated_at")
          .order("updated_at", { ascending: false })
          .limit(5000);

        const staticPages = [
          { loc: `${BASE}/`, changefreq: "daily", priority: "1.0" },
          { loc: `${BASE}/search`, changefreq: "daily", priority: "0.9" },
        ];

        const productPages = (products || []).map((p) => ({
          loc: `${BASE}/product/${p.slug}`,
          changefreq: "hourly",
          priority: "0.8",
          lastmod: p.updated_at?.slice(0, 10) ?? now,
        }));

        const allPages = [...staticPages, ...productPages];

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPages.map((p) => `  <url>
    <loc>${p.loc}</loc>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>${(p as any).lastmod ? `\n    <lastmod>${(p as any).lastmod}</lastmod>` : ""}
  </url>`).join("\n")}
</urlset>`;

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600, s-maxage=3600",
          },
        });
      },
    },
  },
});
