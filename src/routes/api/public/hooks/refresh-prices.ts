/**
 * Cron endpoint для регулярного обновления цен.
 * Дёргается из pg_cron каждые 6 часов.
 * Демо: слегка варьирует существующие цены и пишет в price_history.
 * В production здесь будет вызов Firecrawl для каждого магазина.
 */
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/api/public/hooks/refresh-prices")({
  server: {
    handlers: {
      POST: async () => {
        const supabaseAdmin = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { auth: { persistSession: false, autoRefreshToken: false } },
        );

        const { data: offers, error } = await supabaseAdmin.from("store_products").select("*");
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        }

        let updated = 0;
        for (const offer of offers || []) {
          // Лёгкая вариация цены (±3%), имитация смены акций
          const drift = 0.97 + Math.random() * 0.06;
          const newPrice = Math.round(Number(offer.price) * drift * 100) / 100;
          const promo = Math.random() < 0.25;
          await supabaseAdmin
            .from("store_products")
            .update({
              price: newPrice,
              old_price: promo ? Math.round(newPrice * 1.15 * 100) / 100 : null,
              is_promo: promo,
              fetched_at: new Date().toISOString(),
            })
            .eq("id", offer.id);
          await supabaseAdmin.from("price_history").insert({
            product_id: offer.product_id,
            store_id: offer.store_id,
            price: newPrice,
          });
          updated += 1;
        }

        return new Response(
          JSON.stringify({ ok: true, updated, refreshed_at: new Date().toISOString() }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
