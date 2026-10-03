import pool from '../lib/db.js'
import pino from 'pino'
import { alertProductUrl, buildAlertMessage, pickTriggerOffer, siteUrl, type AlertOffer } from '../lib/price-alert.js'
import { ALERT_HAS_TRIGGER_SQL, ALERT_OFFERS_JSON_SQL } from '../lib/alert-sql.js'
import { alertRearmPct, bestAvailablePrice, decideAlert, rearmThreshold, telegramMinIntervalHours } from '../lib/alert-rearm.js'
import { deleteIdleAlerts, markNotified, rearmAlerts } from '../lib/alert-lifecycle.js'

// Alertele pe TELEGRAM (cele pe email: workers/email.worker.ts, cu digest si plafon zilnic).
// Alerta e pe PRODUS: pleaca atunci cand ORICE oferta disponibila a produsului (orice magazin)
// ajunge la sau sub prag; mesajul spune magazinul si pretul care au declansat-o.
// Dupa anunt alerta ramane activa si se RE-ARMEAZA cand pretul urca peste prag + ALERT_REARM_PCT
// (lib/alert-rearm.ts); plafon: cel mult un mesaj la TELEGRAM_ALERT_MIN_INTERVAL_HOURS per alerta.

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

  const idle = await deleteIdleAlerts().catch((err) => { logger.error({ err }, 'Alerte: curatenie esuata'); return 0 })
  if (idle) logger.info({ idle }, 'Alerte: sterse dupa limita de viata')

  const rearmPct = alertRearmPct()
  const minIntervalHours = telegramMinIntervalHours()

  // ARMATE cu o oferta disponibila la/sub prag (candidate la anunt) + TRIMISE (candidate la
  // re-armare). Disponibil = aceeasi regula ca pe /p/ (lib/alert-sql.ts).
  const { rows } = await pool.query(`
    SELECT
      pa.id,
      pa.target_price::float AS target_price,
      pa.triggered_at IS NULL AS armed,
      to_json(pa.last_notified_at) #>> '{}' AS last_notified_at,
      tu.telegram_chat_id,
      p.name AS product_name,
      p.slug AS product_slug,
      ${ALERT_OFFERS_JSON_SQL} AS offers
    FROM price_alerts pa
    JOIN telegram_users tu ON tu.id = pa.telegram_user_id
    JOIN products p ON p.id = pa.product_id
    WHERE pa.is_active = true
      AND pa.confirmed_at IS NOT NULL
      AND (pa.triggered_at IS NOT NULL OR ${ALERT_HAS_TRIGGER_SQL})
  `)

  if (!rows.length) return

  const toRearm: number[] = []
  let sent = 0
  for (const alert of rows) {
    const offers = alert.offers as AlertOffer[] | null
    const decision = decideAlert(
      { armed: alert.armed, target: alert.target_price, bestPrice: bestAvailablePrice(offers), lastNotifiedAt: alert.last_notified_at },
      { rearmPct, minIntervalHours, nowMs: Date.now() },
    )
    if (decision === 'rearm') { toRearm.push(alert.id); continue }
    if (decision !== 'notify') continue
    const best = pickTriggerOffer(offers, alert.target_price)
    if (!best) continue
    try {
      // Numele produsului e escapat (HTML): un „&” sau „<” in nume facea Telegram sa respinga
      // mesajul, iar alerta ramanea netrimisa si se reincerca la nesfarsit.
      await sendMsg(
        Number(alert.telegram_chat_id),
        buildAlertMessage({
          alertId: alert.id,
          productName: alert.product_name,
          retailerName: best.retailerName,
          currentPrice: best.price,
          targetPrice: alert.target_price,
          rearmPrice: rearmThreshold(alert.target_price, rearmPct),
          url: alertProductUrl(SITE_URL, alert.product_slug, 'telegram'),
        })
      )
      await markNotified(alert.id, best.offerId, best.price)
      sent++
      logger.info({ alertId: alert.id, product: alert.product_name, retailer: best.retailerName }, 'Alerta trimisa')

      // Respecta limita Telegram: max 30 mesaje/secunda global, 1/secunda per chat
      await new Promise(r => setTimeout(r, 1100))
    } catch (err) {
      logger.error({ err, alertId: alert.id }, 'Eroare trimitere alerta')
    }
  }
  const rearmed = await rearmAlerts(toRearm)
  if (sent || rearmed) logger.info({ sent, rearmed }, 'Alerte Telegram')
}
