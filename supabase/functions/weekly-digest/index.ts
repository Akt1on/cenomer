/**
 * weekly-digest Edge Function
 * Каждое воскресенье в 10:00 отправляет топ-акции на email пользователей.
 * Использует Resend (resend.com) — бесплатно до 3000 писем/месяц.
 *
 * Деплой: supabase functions deploy weekly-digest
 * Secrets: supabase secrets set RESEND_API_KEY=re_...
 *
 * pg_cron: SELECT cron.schedule('weekly-digest', '0 10 * * 0', $$
 *   SELECT net.http_post(url := '...functions/v1/weekly-digest', ...)
 * $$);
 *
 * ✅ FIX: best_price не существует в таблице products (это вычисляемое поле в JS).
 * Теперь запрашиваем MIN(price) прямо в JOIN через store_products.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const RESEND_KEY = Deno.env.get("RESEND_API_KEY");
const APP_URL = Deno.env.get("APP_URL") ?? "https://cenomer.vercel.app";

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_KEY) return false;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Ценомер <digest@cenomer.ru>",
      to,
      subject,
      html,
    }),
  });
  return res.ok;
}

// ✅ FIX: best_price вычисляется через MIN(sp.price) в запросе,
// а не читается из несуществующей колонки products.best_price.
// Структура deal: { id, slug, name, image_url, best_price, max_price }
type Deal = {
  id: string;
  slug: string;
  name: string;
  image_url: string | null;
  best_price: number;
  max_price: number | null;
};

function buildEmailHtml(deals: Deal[]): string {
  const items = deals
    .slice(0, 8)
    .map(
      (d) => `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid #f0f0f0">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td width="60">
              ${
                d.image_url
                  ? `<img src="${d.image_url}" width="56" height="56" style="border-radius:8px;object-fit:cover">`
                  : `<div style="width:56px;height:56px;background:#f0fdf4;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:24px">🛒</div>`
              }
            </td>
            <td style="padding-left:12px">
              <p style="margin:0;font-size:14px;font-weight:600;color:#111">${d.name}</p>
              <p style="margin:4px 0 0;font-size:13px;color:#16a34a;font-weight:700">
                от ${d.best_price} ₽
                ${
                  d.max_price && d.max_price > d.best_price
                    ? `<span style="color:#888;text-decoration:line-through;font-weight:400;margin-left:6px">${d.max_price} ₽</span>`
                    : ""
                }
              </p>
            </td>
            <td align="right" width="80">
              <a href="${APP_URL}/product/${d.slug}?utm_source=digest&utm_medium=email"
                style="background:#16a34a;color:#fff;padding:6px 14px;border-radius:20px;text-decoration:none;font-size:12px;font-weight:600">
                Смотреть
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `
    )
    .join("");

  return `
<!DOCTYPE html>
<html lang="ru">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:32px 16px">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:100%">

        <!-- Шапка -->
        <tr><td style="background:#16a34a;border-radius:16px 16px 0 0;padding:24px 32px;text-align:center">
          <h1 style="margin:0;color:#fff;font-size:24px;font-weight:800">🛒 Ценомер</h1>
          <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px">
            Лучшие акции этой недели
          </p>
        </td></tr>

        <!-- Тело -->
        <tr><td style="background:#fff;padding:24px 32px;border-radius:0 0 16px 16px">
          <table width="100%" cellpadding="0" cellspacing="0">
            ${items}
          </table>

          <div style="margin-top:24px;text-align:center">
            <a href="${APP_URL}?utm_source=digest&utm_medium=email"
              style="background:#16a34a;color:#fff;padding:14px 32px;border-radius:12px;text-decoration:none;font-size:15px;font-weight:700;display:inline-block">
              Все акции →
            </a>
          </div>
        </td></tr>

        <!-- Футер -->
        <tr><td style="padding:20px 0;text-align:center">
          <p style="margin:0;font-size:12px;color:#9ca3af">
            Ценомер · Москва ·
            <a href="${APP_URL}/unsubscribe" style="color:#9ca3af">Отписаться</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

Deno.serve(async (req) => {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`) {
    return new Response("Forbidden", { status: 403 });
  }

  // ✅ FIX: best_price вычисляем через MIN(sp.price) прямо в SQL.
  // products.best_price не существует в схеме БД — раньше письма падали молча.
  //
  // Используем RPC-функцию get_weekly_deals() которую нужно добавить в БД:
  // ─────────────────────────────────────────────────────────────────────────
  // CREATE OR REPLACE FUNCTION get_weekly_deals(lim int DEFAULT 8)
  // RETURNS TABLE (
  //   id uuid, slug text, name text, image_url text,
  //   best_price numeric, max_price numeric
  // )
  // LANGUAGE sql STABLE SECURITY DEFINER AS $$
  //   SELECT
  //     p.id, p.slug, p.name, p.image_url,
  //     MIN(sp.price) AS best_price,
  //     MAX(sp.old_price) AS max_price
  //   FROM products p
  //   JOIN store_products sp ON sp.product_id = p.id AND sp.is_promo = true
  //   GROUP BY p.id, p.slug, p.name, p.image_url
  //   ORDER BY MIN(sp.price) ASC
  //   LIMIT lim;
  // $$;
  // ─────────────────────────────────────────────────────────────────────────
  const { data: deals, error } = await sb.rpc("get_weekly_deals", { lim: 8 });

  if (error) {
    console.error("get_weekly_deals error:", error);
    return new Response(JSON.stringify({ ok: false, reason: error.message }), { status: 500 });
  }

  if (!deals?.length) {
    return new Response(JSON.stringify({ ok: false, reason: "no deals" }), { status: 200 });
  }

  // ✅ FIX 5.2: listUsers возвращает max 1000 — пагинируем
  let allUsers: any[] = [];
  let page = 1;
  while (true) {
    const { data } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
    allUsers = [...allUsers, ...(data?.users ?? [])];
    if ((data?.users?.length ?? 0) < 1000) break;
    page++;
  }
  const emails = allUsers
    .filter((u) => u.email && !u.user_metadata?.unsubscribed_digest)
    .map((u) => u.email!);

  const subject = `🛒 ${deals.length} акций этой недели — экономьте с Ценомером`;
  const html = buildEmailHtml(deals as Deal[]);

  let sent = 0;
  // Отправляем батчами по 10 (rate limit Resend)
  for (let i = 0; i < emails.length; i += 10) {
    const batch = emails.slice(i, i + 10);
    await Promise.all(
      batch.map((email) =>
        sendEmail(email, subject, html).then((ok) => {
          if (ok) sent++;
        })
      )
    );
    if (i + 10 < emails.length) await new Promise((r) => setTimeout(r, 1000));
  }

  return new Response(
    JSON.stringify({ ok: true, sent, total: emails.length, deals: deals.length }),
    { headers: { "Content-Type": "application/json" } }
  );
});
