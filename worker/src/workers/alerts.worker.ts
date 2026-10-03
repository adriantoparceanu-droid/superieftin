import pool from '../lib/db.js'
import pino from 'pino'
import { OFFER_STALE_DAYS } from '../lib/stale.js'
import { alertProductUrl, buildAlertMessage, siteUrl } from '../lib/price-alert.js'

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

  const { rows } = await pool.query(`
    SELECT
      pa.id,
      pa.target_price,
      tu.telegram_chat_id,
      p.name AS product_name,
      p.slug AS product_slug,
      r.name AS retailer_name,
      o.current_price
    FROM price_alerts pa
    JOIN telegram_users tu ON tu.id = pa.telegram_user_id
    JOIN offers o ON o.id = pa.offer_id
    JOIN products p ON p.id = o.product_id
    JOIN retailers r ON r.id = o.retailer_id
    WHERE pa.is_active = true
      AND pa.triggered_at IS NULL
      AND o.current_price IS NOT NULL
      AND o.current_price <= pa.target_price
      -- Doar oferte pe care vizitatorul le vede pe /p/ (aceeasi regula ca OFFER_AVAILABLE_SQL
      -- din web/src/lib/availability.ts): in stoc, confirmate recent, magazin nepus pe pauza.
      -- Altfel alerta ar trimite pe o pagina unde pretul anuntat nu exista. Alerta ramane
      -- activa si pleaca atunci cand oferta revine la pretul dorit.
      AND o.in_stock = true
      AND o.last_checked >= now() - make_interval(days => $1)
      AND r.paused_at IS NULL
  `, [OFFER_STALE_DAYS])

  if (!rows.length) return

  logger.info({ count: rows.length }, 'Alerte de trimis')

  for (const alert of rows) {
    try {
      // Numele produsului e escapat (HTML): un „&” sau „<” in nume facea Telegram sa respinga
      // mesajul, iar alerta ramanea netrimisa si se reincerca la nesfarsit.
      await sendMsg(
        Number(alert.telegram_chat_id),
        buildAlertMessage({
          productName: alert.product_name,
          retailerName: alert.retailer_name,
          currentPrice: parseFloat(alert.current_price),
          targetPrice: parseFloat(alert.target_price),
          url: alertProductUrl(SITE_URL, alert.product_slug, 'telegram'),
        })
      )

      await pool.query(
        `UPDATE price_alerts SET triggered_at = now(), is_active = false WHERE id = $1`,
        [alert.id]
      )

      logger.info({ alertId: alert.id, product: alert.product_name }, 'Alerta trimisa')

      // Respecta limita Telegram: max 30 mesaje/secunda global, 1/secunda per chat
      await new Promise(r => setTimeout(r, 1100))
    } catch (err) {
      logger.error({ err, alertId: alert.id }, 'Eroare trimitere alerta')
    }
  }
}
