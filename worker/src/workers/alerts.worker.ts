import pool from '../lib/db.js'
import pino from 'pino'
import { alertProductUrl, buildAlertMessage, pickTriggerOffer, siteUrl, type AlertOffer } from '../lib/price-alert.js'
import { ALERT_HAS_TRIGGER_SQL, ALERT_OFFERS_JSON_SQL } from '../lib/alert-sql.js'

// Alertele pe TELEGRAM (cele pe email: workers/email.worker.ts, cu digest si plafon zilnic).
// Alerta e pe PRODUS: pleaca atunci cand ORICE oferta disponibila a produsului (orice magazin)
// ajunge la sau sub prag; mesajul spune magazinul si pretul care au declansat-o.

const logger = pino({ level: 'info' })
const TOKEN = process.env.TELEGRAM_BOT_TOKEN
const BASE = `https://api.telegram.org/bot${TOKEN}`
// Linkul din alerta duce pe /p/ al produsului cu UTM (lib/price-alert.ts explica de ce)
const SITE_URL = siteUrl()

async function sendMsg(chatId: number, text: string) {
  const res = await fetch(`${BASE}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: false }),
  })
  if (!res.ok) throw new Error(`sendMessage failed: ${await res.text()}`)
}

export async function checkAndSendAlerts() {
  if (!TOKEN) return

  // Doar oferte pe care vizitatorul le vede pe /p/ (lib/alert-sql.ts: aceeasi regula ca
  // OFFER_AVAILABLE_SQL din web). Alerta ramane activa pana cand o oferta disponibila ajunge la prag.
  const { rows } = await pool.query(`
    SELECT
      pa.id,
      pa.target_price::float AS target_price,
      tu.telegram_chat_id,
      p.name AS product_name,
      p.slug AS product_slug,
      ${ALERT_OFFERS_JSON_SQL} AS offers
    FROM price_alerts pa
    JOIN telegram_users tu ON tu.id = pa.telegram_user_id
    JOIN products p ON p.id = pa.product_id
    WHERE pa.is_active = true
      AND pa.triggered_at IS NULL
      AND ${ALERT_HAS_TRIGGER_SQL}
  `)

  if (!rows.length) return

  logger.info({ count: rows.length }, 'Alerte Telegram de trimis')

  for (const alert of rows) {
    const best = pickTriggerOffer(alert.offers as AlertOffer[], alert.target_price)
    if (!best) continue
    try {
      // Numele produsului e escapat (HTML): un „&” sau „<” in nume facea Telegram sa respinga
      // mesajul, iar alerta ramanea netrimisa si se reincerca la nesfarsit.
      await sendMsg(
        Number(alert.telegram_chat_id),
        buildAlertMessage({
          productName: alert.product_name,
          retailerName: best.retailerName,
          currentPrice: best.price,
          targetPrice: alert.target_price,
          url: alertProductUrl(SITE_URL, alert.product_slug, 'telegram'),
        })
      )

      await pool.query(
        `UPDATE price_alerts
         SET triggered_at = now(), is_active = false, trigger_offer_id = $2, trigger_price = $3
         WHERE id = $1`,
        [alert.id, best.offerId, best.price]
      )

      logger.info({ alertId: alert.id, product: alert.product_name, retailer: best.retailerName }, 'Alerta trimisa')

      // Respecta limita Telegram: max 30 mesaje/secunda global, 1/secunda per chat
      await new Promise(r => setTimeout(r, 1100))
    } catch (err) {
      logger.error({ err, alertId: alert.id }, 'Eroare trimitere alerta')
    }
  }
}
