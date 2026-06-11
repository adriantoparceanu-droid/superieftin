import pool from '../lib/db.js'
import pino from 'pino'

const logger = pino({ level: 'info' })
const TOKEN = process.env.TELEGRAM_BOT_TOKEN
const BASE = `https://api.telegram.org/bot${TOKEN}`
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://superieftin.ro'

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
      o.current_price
    FROM price_alerts pa
    JOIN telegram_users tu ON tu.id = pa.telegram_user_id
    JOIN offers o ON o.id = pa.offer_id
    JOIN products p ON p.id = o.product_id
    WHERE pa.is_active = true
      AND pa.triggered_at IS NULL
      AND o.current_price IS NOT NULL
      AND o.current_price <= pa.target_price
  `)

  if (!rows.length) return

  logger.info({ count: rows.length }, 'Alerte de trimis')

  for (const alert of rows) {
    try {
      const current = parseFloat(alert.current_price).toLocaleString('ro-RO', { minimumFractionDigits: 2 })
      const target = parseFloat(alert.target_price).toLocaleString('ro-RO', { minimumFractionDigits: 2 })

      await sendMsg(
        Number(alert.telegram_chat_id),
        `🔥 <b>Alertă de preț!</b>\n\n<b>${alert.product_name}</b> a scăzut la <b>${current} RON</b>\n(pragul tău: ${target} RON)\n\n👉 <a href="${SITE_URL}/p/${alert.product_slug}">Vezi produsul</a>`
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
