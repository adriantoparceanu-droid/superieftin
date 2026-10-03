// Alerte pe email — acces la baza de date si la coada workerului (doar pe server).
// Regulile pure (validari, activare) sunt in lib/email-alerts.ts.

import pool from './db'
import { OFFER_AVAILABLE_SQL } from './availability'
import { MAX_PENDING_PER_EMAIL_24H } from './email-alerts'

// Coada 'email' a workerului (worker/src/workers/email.worker.ts). O singura conexiune per proces.
type EmailQueue = { add: (name: string, data: object, opts?: object) => Promise<unknown> }
let queuePromise: Promise<EmailQueue> | null = null
function emailQueue(): Promise<EmailQueue> {
  queuePromise ??= import('bullmq').then(({ Queue }) => new Queue('email', {
    connection: { url: process.env.REDIS_URL || 'redis://localhost:6379', maxRetriesPerRequest: null },
  }) as unknown as EmailQueue)
  return queuePromise
}

export async function enqueueEmailJob(name: 'confirm' | 'manage-link', data: { alertId: number } | { subscriberId: number }): Promise<void> {
  const q = await emailQueue()
  // 3 incercari: un server SMTP indisponibil cateva secunde nu pierde emailul de confirmare
  await q.add(name, data, { attempts: 3, backoff: { type: 'exponential', delay: 30_000 }, removeOnComplete: 1000, removeOnFail: 1000 })
}

export interface AlertProduct { id: number; name: string; slug: string; bestPrice: number | null }

export async function getAlertProduct(productId: number): Promise<AlertProduct | null> {
  const { rows } = await pool.query(
    `SELECT p.id::int AS id, p.name, p.slug,
            (SELECT MIN(o.current_price)::float FROM offers o
             WHERE o.product_id = p.id AND o.current_price IS NOT NULL AND ${OFFER_AVAILABLE_SQL}) AS "bestPrice"
     FROM products p WHERE p.id = $1`,
    [productId],
  )
  return rows[0] ?? null
}

// Cererea de abonare: abonatul (dupa adresa) + o alerta NECONFIRMATA. Intoarce id-ul alertei de
// confirmat sau null daca adresa a atins limita de cereri pe 24 h (atunci nu trimitem nimic).
export async function createPendingAlert(email: string, productId: number, offerId: number | null, target: number): Promise<number | null> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const sub = await client.query(
      `INSERT INTO email_subscribers (email) VALUES ($1)
       ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
       RETURNING id`,
      [email],
    )
    const subscriberId = sub.rows[0].id as number
    // Blocam randul abonatului: doua cereri simultane nu pot depasi impreuna limita
    await client.query('SELECT 1 FROM email_subscribers WHERE id = $1 FOR UPDATE', [subscriberId])
    const recent = await client.query(
      `SELECT count(*)::int AS n FROM price_alerts
       WHERE email_subscriber_id = $1 AND confirmed_at IS NULL AND created_at > now() - interval '24 hours'`,
      [subscriberId],
    )
    if (recent.rows[0].n >= MAX_PENDING_PER_EMAIL_24H) {
      await client.query('COMMIT')
      return null
    }
    const ins = await client.query(
      `INSERT INTO price_alerts (email_subscriber_id, product_id, offer_id, target_price)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [subscriberId, productId, offerId, target],
    )
    await client.query('COMMIT')
    return ins.rows[0].id as number
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }
}

export interface PendingAlertInfo {
  id: number
  subscriberId: number
  confirmed: boolean
  active: boolean
  targetPrice: number
  productName: string
  productSlug: string
}

export async function getEmailAlert(alertId: number): Promise<PendingAlertInfo | null> {
  const { rows } = await pool.query(
    `SELECT pa.id, pa.email_subscriber_id AS "subscriberId", pa.confirmed_at IS NOT NULL AS confirmed,
            pa.is_active AS active, pa.target_price::float AS "targetPrice",
            p.name AS "productName", p.slug AS "productSlug"
     FROM price_alerts pa JOIN products p ON p.id = pa.product_id
     WHERE pa.id = $1 AND pa.email_subscriber_id IS NOT NULL`,
    [alertId],
  )
  return rows[0] ?? null
}

// Confirmarea (clickul pe butonul din pagina deschisa din email). O alerta activa mai veche pentru
// acelasi produs e inlocuita de cea noua (un singur prag per produs). Intoarce id-ul abonatului.
export async function confirmEmailAlert(alertId: number): Promise<number | null> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query(
      `SELECT id, email_subscriber_id, product_id, confirmed_at FROM price_alerts
       WHERE id = $1 AND email_subscriber_id IS NOT NULL AND is_active = true FOR UPDATE`,
      [alertId],
    )
    const a = rows[0]
    if (!a) { await client.query('ROLLBACK'); return null }
    if (!a.confirmed_at) {
      await client.query(
        `DELETE FROM price_alerts
         WHERE email_subscriber_id = $1 AND product_id = $2 AND id <> $3 AND is_active = true AND confirmed_at IS NOT NULL`,
        [a.email_subscriber_id, a.product_id, a.id],
      )
      await client.query(`UPDATE price_alerts SET confirmed_at = now() WHERE id = $1`, [a.id])
      await client.query(
        `UPDATE email_subscribers SET confirmed_at = COALESCE(confirmed_at, now()) WHERE id = $1`,
        [a.email_subscriber_id],
      )
    }
    await client.query('COMMIT')
    return a.email_subscriber_id as number
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }
}

export interface SubscriberAlert {
  id: number
  productName: string
  productSlug: string
  targetPrice: number
  armed: boolean                 // true = asteapta scaderea; false = trimisa, asteapta re-armarea
  notifyCount: number
  triggeredAt: string | null
  triggerPrice: number | null
  triggerRetailer: string | null
  bestPrice: number | null
}

export async function getSubscriber(subscriberId: number): Promise<{ id: number; email: string } | null> {
  const { rows } = await pool.query(`SELECT id, email FROM email_subscribers WHERE id = $1`, [subscriberId])
  return rows[0] ?? null
}

export async function listSubscriberAlerts(subscriberId: number): Promise<SubscriberAlert[]> {
  const { rows } = await pool.query(
    `SELECT pa.id, p.name AS "productName", p.slug AS "productSlug", pa.target_price::float AS "targetPrice",
            pa.triggered_at IS NULL AS armed, pa.notify_count AS "notifyCount",
            to_json(pa.triggered_at) #>> '{}' AS "triggeredAt", pa.trigger_price::float AS "triggerPrice",
            r.name AS "triggerRetailer",
            (SELECT MIN(o.current_price)::float FROM offers o
             WHERE o.product_id = p.id AND o.current_price IS NOT NULL AND ${OFFER_AVAILABLE_SQL}) AS "bestPrice"
     FROM price_alerts pa
     JOIN products p ON p.id = pa.product_id
     LEFT JOIN offers tro ON tro.id = pa.trigger_offer_id
     LEFT JOIN retailers r ON r.id = tro.retailer_id
     WHERE pa.email_subscriber_id = $1 AND pa.confirmed_at IS NOT NULL AND pa.is_active = true
     ORDER BY pa.created_at DESC
     LIMIT 200`,
    [subscriberId],
  )
  return rows
}

export async function updateAlertTarget(subscriberId: number, alertId: number, target: number): Promise<boolean> {
  const r = await pool.query(
    // Un prag nou = alerta ARMATA din nou (pragul e validat sub pretul de acum)
    `UPDATE price_alerts SET target_price = $3, triggered_at = NULL, updated_at = now()
     WHERE id = $2 AND email_subscriber_id = $1 AND is_active = true AND confirmed_at IS NOT NULL`,
    [subscriberId, alertId, target],
  )
  return (r.rowCount ?? 0) > 0
}

export async function getAlertProductIdForSubscriber(subscriberId: number, alertId: number): Promise<number | null> {
  const { rows } = await pool.query(
    `SELECT product_id::int AS id FROM price_alerts WHERE id = $2 AND email_subscriber_id = $1`,
    [subscriberId, alertId],
  )
  return rows[0]?.id ?? null
}

export async function deleteSubscriberAlert(subscriberId: number, alertId: number): Promise<void> {
  await pool.query(`DELETE FROM price_alerts WHERE id = $2 AND email_subscriber_id = $1`, [subscriberId, alertId])
}

// Dezabonare totala = stergere completa: abonatul si toate alertele lui (ON DELETE CASCADE)
export async function deleteSubscriber(subscriberId: number): Promise<void> {
  await pool.query(`DELETE FROM email_subscribers WHERE id = $1`, [subscriberId])
}

export async function confirmedSubscriberIdByEmail(email: string): Promise<number | null> {
  const { rows } = await pool.query(
    `SELECT id FROM email_subscribers WHERE email = $1 AND confirmed_at IS NOT NULL`,
    [email],
  )
  return rows[0]?.id ?? null
}
