// Ramas-bun la inchiderea alertelor de pret (20 nov. 2026: site-ul devine blog de recomandari).
//
// Utilizare (local, din worker/ — citeste .env din radacina):
//   npm run alerte:ramas-bun                         # PLAN: numara + afiseaza textele, NU trimite nimic
//   npm run alerte:ramas-bun -- --confirm            # trimite: UN mesaj Telegram per conversatie cu alerte
//                                                    #   active (max 20/s) + UN email per abonat confirmat
//                                                    #   (joburi 'farewell' in coada 'email' — le trimite workerul)
//   npm run alerte:ramas-bun -- --purge              # PLAN pentru stergere: ce s-ar sterge
//   npm run alerte:ramas-bun -- --purge --confirm    # sterge abonatii email + conversatiile Telegram + alertele
// Productie (containerul worker, dupa deploy):
//   docker compose exec -T worker node worker/dist/scripts/alerte-ramas-bun.js [--confirm] [--purge]
//
// Textele: lib/alerts-closing.ts (un singur loc, de aprobat de proprietar). Logica: lib/alerts-farewell.ts.
// Reluarea lui --confirm nu trimite dubluri (conversatiile anuntate sunt tinute minte in Redis,
// joburile de email au jobId fix). --purge refuza cat timp mai sunt emailuri de ramas-bun in coada.
import pool from '../lib/db.js'
import { emailQueue } from '../lib/queue.js'
import { emailConfig } from '../lib/email/config.js'
import { siteUrl } from '../lib/price-alert.js'
import { parseFarewellArgs, runFarewell, type FarewellDeps, type FarewellMode, type TelegramSendResult } from '../lib/alerts-farewell.js'

const SENT_KEY = 'alerte:ramas-bun:telegram'   // conversatiile deja anuntate (set Redis)
const JOB_ID = (id: number) => `farewell-${id}`

async function sendTelegram(token: string, chatId: number, text: string): Promise<TelegramSendResult> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
      signal: AbortSignal.timeout(15000),
    })
    if (res.ok) return { ok: true }
    const data = await res.json().catch(() => ({})) as { description?: string; parameters?: { retry_after?: number } }
    if (res.status === 429) return { ok: false, retryAfterSec: data.parameters?.retry_after ?? 5, error: data.description }
    // 403 = botul blocat / cont dezactivat; 400 „chat not found” = conversatia nu mai exista
    if (res.status === 403 || (res.status === 400 && /chat not found/i.test(data.description ?? ''))) {
      return { ok: false, blocked: true, error: data.description }
    }
    return { ok: false, error: `${res.status} ${data.description ?? ''}`.trim() }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
}

async function main(): Promise<number> {
  const mode = parseFarewellArgs(process.argv.slice(2))
  if (typeof mode !== 'string') { console.error(mode.error); return 1 }

  const token = process.env.TELEGRAM_BOT_TOKEN?.trim() || ''
  // Conexiunea Redis a cozii (aceeasi versiune ioredis ca BullMQ — vezi lib/queue.ts)
  // (la rulare e un client ioredis complet; tipul BullMQ expune doar o parte din comenzi)
  const redis = (await emailQueue.client) as unknown as SetCommands
  return runWith(redis, token, mode)
}

interface SetCommands {
  sismember(key: string, member: string): Promise<number>
  sadd(key: string, member: string): Promise<number>
  del(key: string): Promise<number>
}

async function runWith(redis: SetCommands, token: string, mode: FarewellMode): Promise<number> {
    const deps: FarewellDeps = {
      siteUrl: siteUrl(),
      telegramEnabled: Boolean(token),
      emailEnabled: emailConfig() != null,
      log: (l) => console.log(l),
      sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
      async counts() {
        const { rows } = await pool.query(`
          SELECT
            (SELECT count(DISTINCT tu.telegram_chat_id) FROM price_alerts pa JOIN telegram_users tu ON tu.id = pa.telegram_user_id WHERE pa.is_active)::int AS telegram_chats,
            (SELECT count(*) FROM price_alerts WHERE telegram_user_id IS NOT NULL AND is_active)::int AS telegram_alerts,
            (SELECT count(*) FROM telegram_users)::int AS telegram_users,
            (SELECT count(*) FROM email_subscribers WHERE confirmed_at IS NOT NULL)::int AS email_subscribers,
            (SELECT count(*) FROM price_alerts WHERE email_subscriber_id IS NOT NULL AND is_active AND confirmed_at IS NOT NULL)::int AS email_alerts,
            (SELECT count(*) FROM email_subscribers WHERE confirmed_at IS NULL)::int AS email_unconfirmed,
            (SELECT count(*) FROM price_alerts)::int AS all_alerts`)
        const r = rows[0]
        return {
          telegramChats: r.telegram_chats, telegramAlerts: r.telegram_alerts, telegramUsers: r.telegram_users,
          emailSubscribers: r.email_subscribers, emailAlerts: r.email_alerts, emailUnconfirmed: r.email_unconfirmed, allAlerts: r.all_alerts,
        }
      },
      async telegramChats() {
        const { rows } = await pool.query(`
          SELECT DISTINCT tu.telegram_chat_id::text AS chat_id
          FROM price_alerts pa JOIN telegram_users tu ON tu.id = pa.telegram_user_id
          WHERE pa.is_active ORDER BY 1`)
        return rows.map((r) => Number(r.chat_id))
      },
      async emailSubscriberIds() {
        const { rows } = await pool.query(`SELECT id FROM email_subscribers WHERE confirmed_at IS NOT NULL ORDER BY id`)
        return rows.map((r) => Number(r.id))
      },
      sendTelegram: (chatId, text) => sendTelegram(token, chatId, text),
      async enqueueFarewellEmail(subscriberId) {
        if (await emailQueue.getJob(JOB_ID(subscriberId))) return 'exists'
        await emailQueue.add('farewell', { subscriberId }, {
          jobId: JOB_ID(subscriberId),
          attempts: 3, backoff: { type: 'exponential', delay: 60_000 },
          // pastrat 30 de zile: o reluare a scriptului nu pune acelasi email din nou in coada
          removeOnComplete: { age: 30 * 24 * 3600 }, removeOnFail: false,
        })
        return 'added'
      },
      async pendingFarewellEmails() {
        const jobs = await emailQueue.getJobs(['waiting', 'active', 'delayed', 'prioritized', 'paused'])
        return jobs.filter((j) => j?.name === 'farewell').length
      },
      async purge() {
        const client = await pool.connect()
        try {
          await client.query('BEGIN')
          const alerts = await client.query('SELECT count(*)::int AS n FROM price_alerts')
          // CASCADE: alertele pe email pleaca odata cu abonatul, cele pe Telegram cu conversatia
          const e = await client.query('DELETE FROM email_subscribers')
          const t = await client.query('DELETE FROM telegram_users')
          await client.query('DELETE FROM price_alerts')   // orice rand ramas (nu ar trebui sa existe)
          await client.query('COMMIT')
          return { emailSubscribers: e.rowCount ?? 0, telegramUsers: t.rowCount ?? 0, alerts: alerts.rows[0].n }
        } catch (err) {
          await client.query('ROLLBACK').catch(() => {})
          throw err
        } finally { client.release() }
      },
      sentTelegram: {
        has: async (id) => (await redis.sismember(SENT_KEY, String(id))) === 1,
        add: async (id) => { await redis.sadd(SENT_KEY, String(id)) },
        clear: async () => { await redis.del(SENT_KEY) },
      },
    }
    const r = await runFarewell(mode, deps)
    return r.refused || r.telegram.failed ? 2 : 0
}

main()
  .then(async (code) => { await emailQueue.close().catch(() => {}); await pool.end(); process.exit(code) })
  .catch(async (err) => { console.error(err); await emailQueue.close().catch(() => {}); await pool.end().catch(() => {}); process.exit(1) })
