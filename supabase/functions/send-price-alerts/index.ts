/**
 * Supabase Edge Function: send-price-alerts
 *
 * Запускается через pg_cron после обновления цен (refresh-prices).
 * Находит price_alerts где текущая цена <= target_price,
 * отправляет FCM push на все устройства пользователя.
 *
 * ✅ FIX 2.5: best_price читается из store_products (MIN цена), а не из products.best_price
 * ✅ FIX 4.2: проверка исторического минимума за 30 дней
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const FCM_KEY = Deno.env.get("FCM_SERVER_KEY");

type AlertStoreProduct = {
  price: number | string;
  store_id: string;
  stores: { name: string } | null;
};

type AlertProduct = {
  id: string;
  slug: string;
  name: string;
  store_products: AlertStoreProduct[];
};

type PriceAlertRow = {
  id: string;
  user_id: string;
  target_price: number | string | null;
  product_id: string;
  products: AlertProduct | null;
};

async function sendFcmPush(
  token: string,
  title: string,
  body: string,
  data?: Record<string, string>,
) {
  if (!FCM_KEY) {
    console.error("FCM_SERVER_KEY не задан");
    return false;
  }
  const res = await fetch("https://fcm.googleapis.com/fcm/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `key=${FCM_KEY}`,
    },
    body: JSON.stringify({
      to: token,
      notification: { title, body, sound: "default" },
      data: data ?? {},
      priority: "high",
    }),
  });
  return res.ok;
}

Deno.serve(async (req) => {
  // Защита — только внутренние вызовы
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`) {
    return new Response("Forbidden", { status: 403 });
  }

  // ✅ FIX 2.5: читаем MIN(store_products.price) вместо products.best_price (которого нет в БД)
  const { data: alerts, error } = await supabase
    .from("price_alerts")
    .select(
      `
      id,
      user_id,
      target_price,
      product_id,
      products (
        id, slug, name,
        store_products!inner(price, store_id, stores(name))
      )
    `,
    )
    .eq("is_active", true);

  if (error) return new Response(error.message, { status: 500 });

  let sent = 0;
  let deactivated = 0;

  for (const alert of (alerts ?? []) as PriceAlertRow[]) {
    const product = alert.products;
    if (!product) continue;

    // Вычисляем актуальную минимальную цену из store_products
    const storePrices: number[] = (product.store_products ?? []).map((sp) => Number(sp.price));
    if (storePrices.length === 0) continue;
    const currentPrice = Math.min(...storePrices);

    const targetPrice = alert.target_price ? Number(alert.target_price) : null;
    const priceDropped = targetPrice ? currentPrice <= targetPrice : false;

    if (!priceDropped) continue;

    // ✅ FIX 4.2: проверяем исторический минимум за 30 дней
    let isHistoricalMin = false;
    try {
      const { data: histMin } = await supabase
        .from("price_history")
        .select("price")
        .eq("product_id", alert.product_id)
        .gte("recorded_at", new Date(Date.now() - 30 * 24 * 3600_000).toISOString())
        .order("price", { ascending: true })
        .limit(1)
        .single();

      if (histMin && Number(histMin.price) >= currentPrice) {
        isHistoricalMin = true;
      }
    } catch {
      // Если нет истории — игнорируем
    }

    // Получаем токены устройств пользователя
    const { data: tokens } = await supabase
      .from("device_tokens")
      .select("token")
      .eq("user_id", alert.user_id);

    for (const { token } of tokens ?? []) {
      const title = isHistoricalMin ? "📉 Исторический минимум!" : "📉 Цена упала!";
      const baseBody = `${product.name} теперь стоит ${currentPrice} ₽`;
      const body = isHistoricalMin ? `${baseBody} — исторический минимум за 30 дней!` : baseBody;

      const ok = await sendFcmPush(token, title, body, {
        product_slug: product.slug,
        product_id: product.id,
        price: String(currentPrice),
        is_historical_min: String(isHistoricalMin),
      });
      if (ok) sent++;
    }

    // Деактивируем алерт чтобы не спамить
    await supabase.from("price_alerts").update({ is_active: false }).eq("id", alert.id);
    deactivated++;
  }

  return new Response(JSON.stringify({ ok: true, sent, deactivated }), {
    headers: { "Content-Type": "application/json" },
  });
});
