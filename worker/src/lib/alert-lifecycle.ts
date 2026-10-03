// Scrierile din ciclul de viata al alertelor (re-armare, anunt, limita de viata) — comune
// Telegram (alerts.worker.ts) si email (email.worker.ts). Deciziile: lib/alert-rearm.ts.
import pool from './db.js'
import { alertMaxIdleDays } from './alert-rearm.js'

// Pretul a urcat peste prag + marja → alerta e din nou ARMATA
export async function rearmAlerts(ids: number[]): Promise<number> {
  if (!ids.length) return 0
  const r = await pool.query(
    `UPDATE price_alerts SET triggered_at = NULL, rearmed_at = now()
     WHERE id = ANY($1::int[]) AND is_active = true AND triggered_at IS NOT NULL`,
    [ids],
  )
  return r.rowCount ?? 0
}

// Anunt trimis → TRIMISA (asteapta re-armarea); retinem oferta si pretul care au declansat-o
export async function markNotified(id: number, offerId: number | null, price: number | null): Promise<void> {
  await pool.query(
    `UPDATE price_alerts
     SET triggered_at = now(), last_notified_at = now(), notify_count = notify_count + 1,
         trigger_offer_id = $2, trigger_price = $3
     WHERE id = $1 AND is_active = true`,
    [id, offerId, price],
  )
}

// Limita de viata (promisa in /confidentialitate): alertele vii fara nicio activitate (creare,
// confirmare, anunt, re-armare, schimbare de prag) de ALERT_MAX_IDLE_DAYS zile (implicit 365) se
// sterg — pe ambele canale. Alertele neconfirmate au regula lor (7 zile, email.worker.ts).
export async function deleteIdleAlerts(days = alertMaxIdleDays()): Promise<number> {
  const r = await pool.query(
    `DELETE FROM price_alerts
     WHERE is_active = true AND confirmed_at IS NOT NULL
       AND GREATEST(created_at, confirmed_at, last_notified_at, rearmed_at, updated_at) < now() - make_interval(days => $1)`,
    [Math.floor(days)],
  )
  return r.rowCount ?? 0
}
