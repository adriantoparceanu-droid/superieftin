// Alertele de pret pe email: confirmari (double opt-in), linkuri „Alertele mele” si digestul.
//
// Coada BullMQ separata ('email'), cu un singur job o data (concurrency 1): un feed-sync lung pe
// coada 'sync' nu intarzie emailul de confirmare, iar doua digesturi nu ruleaza niciodata in paralel.
// Joburi:
//   confirm      { alertId }       — trimis de site (POST /api/alerte-email) dupa o cerere de abonare
//   manage-link  { subscriberId }  — trimis de site cand cineva cere din nou linkul „Alertele mele”
//   digest       {}                — programat (EMAIL_DIGEST_CRON) + dupa fiecare job care schimba preturi
//
// Fara configurare (lib/email/config.ts) workerul nu porneste deloc; site-ul nici nu arata formularul.

import { Worker, type Job } from 'bullmq'
import pino from 'pino'
import type { Transporter } from 'nodemailer'
import pool from '../lib/db.js'
import { connection, emailQueue } from '../lib/queue.js'
import { emailConfig, type EmailConfig } from '../lib/email/config.js'
import { createMailer, sendEmail } from '../lib/email/send.js'
import { emailLinks, renderConfirmEmail, renderDigestEmail, renderManageLinkEmail } from '../lib/email/templates.js'
import { planDigest, type DigestCandidate } from '../lib/email/digest.js'
import { signAlertToken } from '../lib/alert-token.js'
import { pickTriggerOffer, type AlertOffer } from '../lib/price-alert.js'
import { ALERT_HAS_TRIGGER_SQL, ALERT_OFFERS_JSON_SQL } from '../lib/alert-sql.js'

const logger = pino({ level: 'info' })

// Abonarile neconfirmate se sterg dupa atatea zile (promis in /confidentialitate)
export const UNCONFIRMED_TTL_DAYS = 7
// Alertele deja trimise raman vizibile in „Alertele mele” atatea zile, apoi se sterg;
// abonatul fara nicio alerta (si fara email in perioada asta) se sterge si el.
export const SENT_ALERT_TTL_DAYS = 90

export type EmailJobData = { alertId: number } | { subscriberId: number } | Record<string, never>

function linksFor(cfg: EmailConfig, subscriberId: number) {
  return emailLinks(cfg.siteUrl, {
    manage: signAlertToken(cfg.tokenSecret, 'm', subscriberId),
    unsubscribe: signAlertToken(cfg.tokenSecret, 'u', subscriberId),
  })
}

export async function sendConfirmEmail(cfg: EmailConfig, mailer: Pick<Transporter, 'sendMail'>, alertId: number): Promise<'sent' | 'skip'> {
  const { rows } = await pool.query(
    `SELECT pa.id, pa.target_price::float AS target_price, pa.confirmed_at, pa.is_active,
            es.id AS subscriber_id, es.email, p.name AS product_name
     FROM price_alerts pa
     JOIN email_subscribers es ON es.id = pa.email_subscriber_id
     JOIN products p ON p.id = pa.product_id
     WHERE pa.id = $1`,
    [alertId],
  )
  const a = rows[0]
  if (!a || a.confirmed_at || !a.is_active) return 'skip'   // stearsa / deja confirmata
  const links = linksFor(cfg, a.subscriber_id)
  const confirmUrl = `${links.siteUrl}/alerte/confirmare?t=${encodeURIComponent(signAlertToken(cfg.tokenSecret, 'c', a.id))}`
  await sendEmail(mailer, cfg, a.email, renderConfirmEmail({ productName: a.product_name, targetPrice: a.target_price, confirmUrl, links }))
  return 'sent'
}

export async function sendManageLinkEmail(cfg: EmailConfig, mailer: Pick<Transporter, 'sendMail'>, subscriberId: number): Promise<'sent' | 'skip'> {
  const { rows } = await pool.query(
    `SELECT id, email FROM email_subscribers WHERE id = $1 AND confirmed_at IS NOT NULL`,
    [subscriberId],
  )
  if (!rows[0]) return 'skip'
  await sendEmail(mailer, cfg, rows[0].email, renderManageLinkEmail({ links: linksFor(cfg, rows[0].id) }))
  return 'sent'
}

// Curatenie GDPR: abonari neconfirmate (7 zile), alerte trimise vechi, abonati ramasi fara alerte
export async function cleanupEmailAlerts(): Promise<{ unconfirmedAlerts: number; unconfirmedSubscribers: number; oldAlerts: number; emptySubscribers: number }> {
  const a = await pool.query(
    `DELETE FROM price_alerts
     WHERE email_subscriber_id IS NOT NULL AND confirmed_at IS NULL
       AND created_at < now() - make_interval(days => $1)`,
    [UNCONFIRMED_TTL_DAYS],
  )
  const s = await pool.query(
    `DELETE FROM email_subscribers es
     WHERE es.confirmed_at IS NULL AND es.created_at < now() - make_interval(days => $1)
       AND NOT EXISTS (SELECT 1 FROM price_alerts pa WHERE pa.email_subscriber_id = es.id)`,
    [UNCONFIRMED_TTL_DAYS],
  )
  const o = await pool.query(
    `DELETE FROM price_alerts
     WHERE email_subscriber_id IS NOT NULL AND is_active = false
       AND triggered_at < now() - make_interval(days => $1)`,
    [SENT_ALERT_TTL_DAYS],
  )
  const e = await pool.query(
    `DELETE FROM email_subscribers es
     WHERE es.confirmed_at IS NOT NULL
       AND COALESCE(es.last_digest_at, es.confirmed_at) < now() - make_interval(days => $1)
       AND NOT EXISTS (SELECT 1 FROM price_alerts pa WHERE pa.email_subscriber_id = es.id)`,
    [SENT_ALERT_TTL_DAYS],
  )
  return { unconfirmedAlerts: a.rowCount ?? 0, unconfirmedSubscribers: s.rowCount ?? 0, oldAlerts: o.rowCount ?? 0, emptySubscribers: e.rowCount ?? 0 }
}

// Alertele confirmate, active, pentru care exista ACUM o oferta disponibila la sau sub prag
export async function loadDigestCandidates(): Promise<DigestCandidate[]> {
  const { rows } = await pool.query(`
    SELECT pa.id AS alert_id, pa.target_price::float AS target_price,
           es.id AS subscriber_id, es.email, to_json(es.last_digest_at) #>> '{}' AS last_digest_at,
           p.name AS product_name, p.slug AS product_slug,
           ${ALERT_OFFERS_JSON_SQL} AS offers
    FROM price_alerts pa
    JOIN email_subscribers es ON es.id = pa.email_subscriber_id AND es.confirmed_at IS NOT NULL
    JOIN products p ON p.id = pa.product_id
    WHERE pa.is_active = true AND pa.triggered_at IS NULL AND pa.confirmed_at IS NOT NULL
      AND ${ALERT_HAS_TRIGGER_SQL}
  `)
  const out: DigestCandidate[] = []
  for (const r of rows) {
    const best = pickTriggerOffer(r.offers as AlertOffer[], r.target_price)
    if (!best) continue
    out.push({
      alertId: r.alert_id, subscriberId: r.subscriber_id, email: r.email, lastDigestAt: r.last_digest_at,
      productName: r.product_name, productSlug: r.product_slug, targetPrice: r.target_price,
      offerId: best.offerId, price: best.price, retailerName: best.retailerName,
    })
  }
  return out
}

export async function runEmailDigest(
  cfg: EmailConfig,
  mailer: Pick<Transporter, 'sendMail'>,
  nowMs = Date.now(),
): Promise<{ candidates: number; emails: number; alerts: number; deferred: number; failed: number }> {
  const cleanup = await cleanupEmailAlerts()
  if (Object.values(cleanup).some((n) => n > 0)) logger.info(cleanup, 'Alerte email: curatenie')

  const candidates = await loadDigestCandidates()
  const plan = planDigest(candidates, nowMs, cfg.minIntervalHours)
  let emails = 0, alerts = 0, failed = 0

  for (const batch of plan.batches) {
    // „Rezervam” emailul: last_digest_at se muta pe acum DOAR daca abonatul e inca in afara
    // ferestrei plafonului. Asa doua rulari suprapuse nu pot trimite acelasi email de doua ori.
    const claim = await pool.query(
      `UPDATE email_subscribers SET last_digest_at = now()
       WHERE id = $1 AND confirmed_at IS NOT NULL
         AND (last_digest_at IS NULL OR last_digest_at <= now() - make_interval(secs => $2))
       RETURNING id`,
      [batch.subscriberId, cfg.minIntervalHours * 3600],
    )
    if (!claim.rowCount) continue

    try {
      await sendEmail(mailer, cfg, batch.email, renderDigestEmail({
        items: batch.items.map((i) => ({
          productName: i.productName, productSlug: i.productSlug, retailerName: i.retailerName,
          price: i.price, targetPrice: i.targetPrice,
        })),
        links: linksFor(cfg, batch.subscriberId),
      }))
    } catch (err) {
      failed++
      logger.error({ err, subscriberId: batch.subscriberId }, 'Alerte email: trimitere esuata — reincercam la urmatoarea rulare')
      // Anulam rezervarea: plafonul nu trebuie sa „consume” un email care n-a plecat
      await pool.query(`UPDATE email_subscribers SET last_digest_at = $2::timestamptz WHERE id = $1`, [batch.subscriberId, batch.previousDigestAt])
      continue
    }

    // Alerta se opreste dupa trimitere (ca pe Telegram); retinem ce a declansat-o
    const byId = new Map(candidates.filter((c) => c.subscriberId === batch.subscriberId).map((c) => [c.alertId, c]))
    for (const id of batch.alertIds) {
      const c = byId.get(id)
      await pool.query(
        `UPDATE price_alerts SET is_active = false, triggered_at = now(), trigger_offer_id = $2, trigger_price = $3
         WHERE id = $1 AND is_active = true`,
        [id, c?.offerId ?? null, c?.price ?? null],
      )
    }
    emails++
    alerts += batch.alertIds.length
  }

  const result = { candidates: candidates.length, emails, alerts, deferred: plan.deferred.length, failed }
  if (candidates.length) logger.info(result, 'Alerte email: digest')
  return result
}

// Cere un digest (din sync.worker, dupa joburile care schimba preturi). Fara email configurat → nimic.
export async function requestEmailDigest(): Promise<void> {
  if (!emailConfig()) return
  await emailQueue.add('digest', {}, { removeOnComplete: 100, removeOnFail: 100 })
}

export function startEmailWorker(): Worker | null {
  const cfg = emailConfig()
  if (!cfg) {
    logger.warn('Alerte pe email dezactivate (lipsesc SMTP_HOST / EMAIL_FROM / ALERT_TOKEN_SECRET)')
    return null
  }
  const mailer = createMailer(cfg)
  const worker = new Worker<EmailJobData>(
    'email',
    async (job: Job<EmailJobData>) => {
      if (job.name === 'confirm') return sendConfirmEmail(cfg, mailer, Number((job.data as { alertId: number }).alertId))
      if (job.name === 'manage-link') return sendManageLinkEmail(cfg, mailer, Number((job.data as { subscriberId: number }).subscriberId))
      if (job.name === 'digest') return runEmailDigest(cfg, mailer)
      throw new Error(`job email necunoscut: ${job.name}`)
    },
    { connection, concurrency: 1 },
  )
  worker.on('failed', (job, err) => logger.error({ job: job?.name, err }, 'Job email esuat'))
  logger.info({ host: cfg.host, port: cfg.port }, 'Alerte pe email pornite')
  return worker
}
