/**
 * Cron endpoint для регулярного обновления цен.
 * Дёргается из pg_cron / внешнего планировщика каждые 6 часов.
 * Защищён заголовком x-cron-secret (задаётся в переменной окружения CRON_SECRET).
 * Демо: слегка варьирует существующие цены и пишет в price_history.
 * В production здесь будет вызов Firecrawl для каждого магазина.
 */
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/api/public/hooks/refresh-prices")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // ── Защита от несанкционированного вызова ──────────────────────────
        const cronSecret = process.env.CRON_SECRET;
        if (!cronSecret) {
          console.error("[refresh-prices] CRON_SECRET не задан в окружении!");
          return new Response(JSON.stringify({ error: "Server misconfiguration" }), {
            status: 500,
          });
        }
        const incoming = request.headers.get("x-cron-secret");
        if (incoming !== cronSecret) {
          return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
        }
        // ──────────────────────────────────────────────────────────────────

        const supabaseAdmin = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { auth: { persistSession: false, autoRefreshToken: false } },
        );

        const { data: offers, error } = await supabaseAdmin.from("store_products").select("*");
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        }

        // Батчевое обновление: собираем все обновления параллельно
        const updates = (offers || []).map(async (offer) => {
          const drift = 0.97 + Math.random() * 0.06;
          const newPrice = Math.round(Number(offer.price) * drift * 100) / 100;
          const promo = Math.random() < 0.25;

          const [updateResult, insertResult] = await Promise.all([
            supabaseAdmin
              .from("store_products")
              .update({
                price: newPrice,
                old_price: promo ? Math.round(newPrice * 1.15 * 100) / 100 : null,
                is_promo: promo,
                fetched_at: new Date().toISOString(),
              })
              .eq("id", offer.id),
            supabaseAdmin.from("price_history").insert({
              product_id: offer.product_id,
              store_id: offer.store_id,
              price: newPrice,
            }),
          ]);

          if (updateResult.error)
            console.error("[refresh-prices] update error:", updateResult.error.message);
          if (insertResult.error)
            console.error("[refresh-prices] history insert error:", insertResult.error.message);

          return !updateResult.error && !insertResult.error;
        });

        const results = await Promise.all(updates);
        const updated = results.filter(Boolean).length;

        return new Response(
          JSON.stringify({
            ok: true,
            updated,
            total: offers?.length ?? 0,
            refreshed_at: new Date().toISOString(),
          }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
