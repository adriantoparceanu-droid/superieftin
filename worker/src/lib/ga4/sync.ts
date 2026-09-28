import pino from 'pino'
import type { Pool } from 'pg'
import { ga4ConfigFromEnv, runReport, availableDimensions, type Ga4Config } from './client.js'
import { KINDS, DAILY_METRICS, affiliateFilter, buildDaily, buildBreakdown, dayRange, type BreakdownRow } from './transform.js'
import { notifyAdmin, escHtml } from '../admin-telegram.js'

// Jobul ga4-sync: trage rapoartele GA4 si le salveaza in ga4_daily / ga4_daily_breakdown.
// Ruleaza zilnic (GA4_SYNC_CRON) si la butonul „Actualizează acum” din /admin/statistici.
//
// - Fiecare rulare rescrie ultimele 3 zile (GA4 mai corecteaza datele pana la 48 h).
// - Prima rulare (tabel gol) aduce ultimele 90 de zile.
// - La eroare NU se sterge nimic (adminul arata ultimele date bune); dupa 3 esecuri la rand
//   trimitem o alerta pe Telegram.

const logger = pino({ level: 'info' })

const RECENT_DAYS = 3
const BACKFILL_DAYS = 90
const ALERT_AFTER_FAILURES = 3
// Maximul de randuri pe raport (GA4 permite 250.000). La 90 de zile × pagini ajunge din plin.
const ROW_LIMIT = 100000

export interface Ga4SyncResult { skipped?: string; start?: string; end?: string; days?: number; breakdownRows?: number; warnings?: string[] }

export async function runGa4Sync(pool: Pool, opts: { daysBack?: number } = {}): Promise<Ga4SyncResult> {
  let cfg: Ga4Config | null
  try {
    cfg = ga4ConfigFromEnv()
  } catch (err) {
    await recordFailure(pool, err)
    throw err
  }
  if (!cfg) {
    logger.info('GA4 neconfigurat (GA4_PROPERTY_ID / GA4_SERVICE_ACCOUNT_JSON lipsesc) — sar peste ga4-sync')
    return { skipped: 'neconfigurat' }
  }

  try {
    const { rows: existing } = await pool.query('SELECT 1 FROM ga4_daily LIMIT 1')
    const daysBack = opts.daysBack ?? (existing.length ? RECENT_DAYS : BACKFILL_DAYS)
    const { start, end } = dayRange(daysBack)
    const dateRanges = [{ startDate: start, endDate: end }]
    const warnings: string[] = []

    // Totalurile pe zi: trafic + clickuri afiliate (raport separat, filtrat pe eveniment)
    const [traffic, clicks] = await Promise.all([
      runReport(cfg, { dateRanges, dimensions: [{ name: 'date' }], metrics: DAILY_METRICS.map((name) => ({ name })), limit: ROW_LIMIT }),
      runReport(cfg, { dateRanges, dimensions: [{ name: 'date' }], metrics: [{ name: 'eventCount' }], dimensionFilter: affiliateFilter, limit: ROW_LIMIT }),
    ])
    const daily = buildDaily(traffic, clicks)

    // Defalcarile. Dimensiunile personalizate (magazin, produs) exista doar daca au fost
    // inregistrate in GA4 — altfel sarim peste tip cu un avertisment, fara sa oprim jobul.
    const dims = await availableDimensions(cfg)
    const breakdowns = new Map<string, BreakdownRow[]>()
    for (const spec of KINDS) {
      if (!dims.has(spec.dimension)) {
        warnings.push(`Dimensiunea ${spec.dimension} nu e înregistrată în GA4 (Admin → Definiții personalizate) — „${spec.kind}” lipsește din statistici`)
        continue
      }
      const dimensions = [{ name: 'date' }, { name: spec.dimension }]
      const [t, a] = await Promise.all([
        spec.trafficMetrics.length
          ? runReport(cfg, { dateRanges, dimensions, metrics: spec.trafficMetrics.map((name) => ({ name })), limit: ROW_LIMIT })
          : Promise.resolve(null),
        runReport(cfg, { dateRanges, dimensions, metrics: [{ name: 'eventCount' }], dimensionFilter: affiliateFilter, limit: ROW_LIMIT }),
      ])
      for (const r of [t, a]) {
        if (r?.rowCount && r.rowCount > ROW_LIMIT) warnings.push(`Raportul „${spec.kind}” are ${r.rowCount} rânduri, am citit primele ${ROW_LIMIT}`)
      }
      breakdowns.set(spec.kind, buildBreakdown(spec, t, a))
    }

    // Scriem totul intr-o singura tranzactie: ori ziua e rescrisa complet, ori deloc
    const client = await pool.connect()
    let breakdownRows = 0
    try {
      await client.query('BEGIN')
      for (const d of daily) {
        await client.query(
          `INSERT INTO ga4_daily (day, users, new_users, sessions, engaged_sessions, page_views, avg_engagement_seconds, affiliate_clicks, synced_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
           ON CONFLICT (day) DO UPDATE SET users = EXCLUDED.users, new_users = EXCLUDED.new_users, sessions = EXCLUDED.sessions,
             engaged_sessions = EXCLUDED.engaged_sessions, page_views = EXCLUDED.page_views,
             avg_engagement_seconds = EXCLUDED.avg_engagement_seconds, affiliate_clicks = EXCLUDED.affiliate_clicks, synced_at = now()`,
          [d.day, d.users, d.new_users, d.sessions, d.engaged_sessions, d.page_views, d.avg_engagement_seconds, d.affiliate_clicks],
        )
      }
      // Top 50 se poate schimba de la o rulare la alta → stergem zilele din interval si le rescriem.
      // Doar pentru tipurile citite cu succes (un tip sarit isi pastreaza datele vechi).
      for (const [kind, rows] of breakdowns) {
        await client.query('DELETE FROM ga4_daily_breakdown WHERE kind = $1 AND day BETWEEN $2 AND $3', [kind, start, end])
        // insert in loturi de 500 (un singur INSERT cu mii de parametri ar depasi limita Postgres)
        for (let i = 0; i < rows.length; i += 500) {
          const chunk = rows.slice(i, i + 500)
          const values: unknown[] = []
          const tuples = chunk.map((r, j) => {
            values.push(r.day, r.kind, r.key, r.sessions, r.users, r.page_views, r.affiliate_clicks)
            const b = j * 7
            return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6}, $${b + 7})`
          })
          await client.query(
            `INSERT INTO ga4_daily_breakdown (day, kind, key, sessions, users, page_views, affiliate_clicks) VALUES ${tuples.join(', ')}`,
            values,
          )
        }
        breakdownRows += rows.length
      }
      await client.query(
        `INSERT INTO ga4_sync_state (id, last_success_at, consecutive_failures, warnings) VALUES (1, now(), 0, $1)
         ON CONFLICT (id) DO UPDATE SET last_success_at = now(), consecutive_failures = 0, warnings = EXCLUDED.warnings`,
        [warnings],
      )
      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {})
      throw err
    } finally {
      client.release()
    }

    for (const w of warnings) logger.warn(w)
    return { start, end, days: daily.length, breakdownRows, warnings }
  } catch (err) {
    await recordFailure(pool, err)
    throw err
  }
}

async function recordFailure(pool: Pool, err: unknown) {
  const message = String((err as Error)?.message ?? err).slice(0, 1000)
  const { rows } = await pool.query(
    `INSERT INTO ga4_sync_state (id, last_error, last_error_at, consecutive_failures) VALUES (1, $1, now(), 1)
     ON CONFLICT (id) DO UPDATE SET last_error = EXCLUDED.last_error, last_error_at = now(),
       consecutive_failures = ga4_sync_state.consecutive_failures + 1
     RETURNING consecutive_failures`,
    [message],
  ).catch((e) => { logger.error({ err: e }, 'Nu am putut salva starea ga4-sync'); return { rows: [] as { consecutive_failures: number }[] } })
  const failures = rows[0]?.consecutive_failures ?? 0
  logger.error({ err, failures }, 'ga4-sync eșuat')
  // O singura alerta, la al treilea esec la rand (nu in fiecare zi pana se repara)
  if (failures === ALERT_AFTER_FAILURES) {
    await notifyAdmin(`⚠️ <b>Statistici GA4</b>: sincronizarea a eșuat de ${failures} ori la rând.\n<code>${escHtml(message)}</code>\n\nAdminul arată ultimele date bune.`, 'alerta GA4')
  }
}
