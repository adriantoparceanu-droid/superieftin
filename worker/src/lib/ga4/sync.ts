import pino from 'pino'
import type { Pool } from 'pg'
import { ga4ConfigFromEnv, runReport, availableDimensions, type Ga4Config } from './client.js'
import { KINDS, DAILY_METRICS, affiliateFilter, buildDaily, buildBreakdown, dayRange, type BreakdownRow } from './transform.js'
import { notifyAdmin, escHtml } from '../admin-telegram.js'
import { listSites, pickSite, fetchSearchAnalytics, topGscPerDay } from './search-console.js'
import { fetchAdsSearchTerms, type AdsTermRow } from './ads-terms.js'

// Jobul ga4-sync: trage rapoartele GA4 si le salveaza in ga4_daily / ga4_daily_breakdown, plus
// cuvintele cheie: organic din Search Console (gsc_daily) si din reclame (ads_search_terms).
// Ruleaza zilnic (GA4_SYNC_CRON) si la butonul „Actualizează acum” din /admin/statistici.
//
// - Fiecare rulare rescrie ultimele 3 zile (GA4 mai corecteaza datele pana la 48 h).
// - Prima rulare (tabel gol) aduce ultimele 90 de zile.
// - La eroare NU se sterge nimic (adminul arata ultimele date bune); dupa 3 esecuri la rand
//   trimitem o alerta pe Telegram.

const logger = pino({ level: 'info' })

const RECENT_DAYS = 3
const BACKFILL_DAYS = 90
// Search Console publica datele cu 2–3 zile intarziere; Google Ads mai corecteaza clickurile
// invalide cateva zile → la aceste surse rescriem o fereastra mai lunga.
const GSC_RECENT_DAYS = 5
const ADS_RECENT_DAYS = 7
const ALERT_AFTER_FAILURES = 3
// Maximul de randuri pe raport (GA4 permite 250.000). La 90 de zile × pagini ajunge din plin.
const ROW_LIMIT = 100000

export interface Ga4SyncResult { skipped?: string; start?: string; end?: string; days?: number; breakdownRows?: number; gscRows?: number | null; adsRows?: number | null; warnings?: string[] }

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
      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {})
      throw err
    } finally {
      client.release()
    }

    // Cuvintele cheie (Search Console + Google Ads). Surse separate: o eroare aici devine
    // avertisment in admin si NU anuleaza statisticile GA4 salvate mai sus.
    const gscRows = await syncSearchConsole(pool, cfg, opts.daysBack, warnings)
    const adsRows = await syncAdsTerms(pool, opts.daysBack, warnings)

    await pool.query(
      `INSERT INTO ga4_sync_state (id, last_success_at, consecutive_failures, warnings) VALUES (1, now(), 0, $1)
       ON CONFLICT (id) DO UPDATE SET last_success_at = now(), consecutive_failures = 0, warnings = EXCLUDED.warnings`,
      [warnings],
    )

    for (const w of warnings) logger.warn(w)
    return { start, end, days: daily.length, breakdownRows, gscRows, adsRows, warnings }
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

// Rescrie in DB zilele din [start, end] pentru o sursa: sterge intervalul, insereaza randurile
// (in loturi de 500 — un singur INSERT cu mii de parametri ar depasi limita Postgres).
async function replaceDays(pool: Pool, table: 'gsc_daily' | 'ads_search_terms', columns: string[], rows: unknown[][], start: string, end: string) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(`DELETE FROM ${table} WHERE day BETWEEN $1 AND $2`, [start, end])
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500)
      const n = columns.length
      const tuples = chunk.map((_, j) => `(${columns.map((__, k) => `$${j * n + k + 1}`).join(', ')})`)
      await client.query(`INSERT INTO ${table} (${columns.join(', ')}) VALUES ${tuples.join(', ')}`, chunk.flat())
    }
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }
}

async function isEmpty(pool: Pool, table: 'gsc_daily' | 'ads_search_terms') {
  const { rows } = await pool.query(`SELECT 1 FROM ${table} LIMIT 1`)
  return rows.length === 0
}

// null = sursa n-a fost citita (neconfigurata sau eroare → avertisment)
async function syncSearchConsole(pool: Pool, cfg: Ga4Config, daysBack: number | undefined, warnings: string[]): Promise<number | null> {
  try {
    const sites = (await listSites(cfg)).map((s) => s.siteUrl)
    const site = pickSite(sites, process.env.GSC_SITE_URL?.trim() || undefined)
    if (!site) {
      warnings.push(`Search Console: contul de serviciu nu are acces la superieftin.ro (proprietăți văzute: ${sites.join(', ') || 'niciuna'}) — adaugă-l în Search Console → Setări → Utilizatori și permisiuni, cu „Restricționat”`)
      return null
    }
    const { start, end } = dayRange(daysBack ?? ((await isEmpty(pool, 'gsc_daily')) ? BACKFILL_DAYS : GSC_RECENT_DAYS))
    const rows = topGscPerDay(await fetchSearchAnalytics(cfg, site, start, end))
    await replaceDays(pool, 'gsc_daily', ['day', 'query', 'page', 'clicks', 'impressions', 'position'],
      rows.map((r) => [r.day, r.query, r.page, Math.round(r.clicks), Math.round(r.impressions), Math.round(r.position * 100) / 100]), start, end)
    return rows.length
  } catch (err) {
    const msg = String((err as Error)?.message ?? err)
    warnings.push(/SERVICE_DISABLED|has not been used|is disabled/.test(msg)
      ? 'Search Console: activează „Google Search Console API” în proiectul Google Cloud al contului de serviciu'
      : `Search Console: ${msg.slice(0, 300)}`)
    return null
  }
}

async function syncAdsTerms(pool: Pool, daysBack: number | undefined, warnings: string[]): Promise<number | null> {
  try {
    const { start, end } = dayRange(daysBack ?? ((await isEmpty(pool, 'ads_search_terms')) ? BACKFILL_DAYS : ADS_RECENT_DAYS))
    const rows = await fetchAdsSearchTerms(start, end)
    if (!rows) {
      warnings.push('Google Ads neconfigurat în .env — termenii din reclame lipsesc')
      return null
    }
    await replaceDays(pool, 'ads_search_terms', ['day', 'campaign', 'ad_group', 'search_term', 'status', 'impressions', 'clicks', 'cost_micros', 'conversions'],
      rows.map((r: AdsTermRow) => [r.day, r.campaign, r.ad_group, r.search_term, r.status, r.impressions, r.clicks, r.cost_micros, r.conversions]), start, end)
    return rows.length
  } catch (err) {
    warnings.push(`Google Ads (termeni căutați): ${String((err as Error)?.message ?? err).slice(0, 300)}`)
    return null
  }
}
