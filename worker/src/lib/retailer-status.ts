import pino from 'pino'
import pool from './db.js'
import { extractDomain } from './affiliate/domain.js'

// Starea sursei fiecarui magazin, pentru Admin → Magazine & surse (migratia 018).
// Calculata zilnic la finalul feed-sync-ului. La schimbarea starii trimite o avertizare pe
// Telegram proprietarului (TELEGRAM_ADMIN_CHAT_ID), ca un feed oprit sa nu treaca neobservat
// luni de zile (cum s-a intamplat cu CITGrup si ForIT in 2026).

const logger = pino({ level: 'info' })

// „Actualizat” = cel putin o oferta confirmata in ultimele FRESH_HOURS ore
const FRESH_HOURS = 48

export type SourceState =
  | 'ok' | 'paused' | 'empty' | 'feed_empty' | 'feed_rejected' | 'feed_missing'
  | 'feed_error' | 'program_inactive' | 'scan_failed' | 'manual_only' | 'stale'

export const STATE_LABELS: Record<SourceState, string> = {
  ok: 'OK',
  paused: 'Pus pe pauză',
  empty: 'Fără oferte',
  feed_empty: 'Feed gol',
  feed_rejected: 'Feed respins',
  feed_missing: 'Feed dezactivat',
  feed_error: 'Feed neimportat',
  program_inactive: 'Program inactiv',
  scan_failed: 'Scanare eșuată',
  manual_only: 'Doar import manual',
  stale: 'Neactualizat',
}

interface RetailerFacts {
  id: number
  name: string
  base_url: string | null
  paused_at: Date | null
  pause_reason: string | null
  source_state: SourceState | null
  offers_total: number
  last_fresh: Date | null
  last_source: string | null
  last_status: string | null
  last_count: number | null
  sources: string[] | null
}

export interface StatusInput {
  // Magazinele acoperite de un feed Profitshare ACTIV azi (din lista API) — cele care au avut
  // feed Profitshare, dar nu mai sunt aici, au feed-ul dezactivat/sters de retea.
  profitshareCoveredIds: Set<number>
}

// Regula de decizie — pura, exportata pentru teste. Ordinea conteaza (prima potrivire castiga).
export function decideState(f: RetailerFacts, input: StatusInput, advertiserActive: boolean | null, now = Date.now()):
  { state: SourceState; reason: string } {
  if (f.paused_at) return { state: 'paused', reason: f.pause_reason || 'Pus pe pauză din admin' }
  if (f.offers_total === 0) return { state: 'empty', reason: 'Magazinul nu are oferte' }
  if (f.last_fresh && now - f.last_fresh.getTime() < FRESH_HOURS * 3600_000) {
    return { state: 'ok', reason: 'Prețuri actualizate în ultimele 48 de ore' }
  }
  const sources = new Set(f.sources ?? [])
  if (f.last_source === 'profitshare' && f.last_status === 'rejected') {
    return f.last_count === 0
      ? { state: 'feed_empty', reason: 'Profitshare trimite feed-ul fără produse („Feed-ul este gol”)' }
      : { state: 'feed_rejected', reason: `Feed respins: doar ${f.last_count} produse, mult sub importul anterior (posibil trunchiat)` }
  }
  if (sources.has('profitshare') && !input.profitshareCoveredIds.has(f.id)) {
    return { state: 'feed_missing', reason: 'Feed-ul nu mai este activ în Profitshare (dezactivat sau șters de rețea)' }
  }
  if (advertiserActive === false) {
    return { state: 'program_inactive', reason: 'Nu mai ești aprobat în programul de afiliere al magazinului' }
  }
  if (sources.has('scraper')) {
    return { state: 'scan_failed', reason: 'Scanarea nu mai aduce produse (captcha / blocaj WAF?)' }
  }
  if (sources.has('2performant')) {
    return { state: 'feed_error', reason: 'Feed-ul 2Performant nu a mai fost importat' }
  }
  if (sources.size > 0 && [...sources].every((s) => s === 'upload')) {
    return { state: 'manual_only', reason: 'Doar import manual — nu există feed automat' }
  }
  return { state: 'stale', reason: 'Prețurile nu au mai fost actualizate de peste 48 de ore' }
}

async function notifyAdmin(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID
  if (!token || !chatId) {
    logger.warn('TELEGRAM_ADMIN_CHAT_ID lipsește — avertizarea despre magazine nu s-a trimis')
    return
  }
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
    signal: AbortSignal.timeout(15000),
  }).catch((err) => { logger.error({ err }, 'Avertizare Telegram eșuată'); return null })
  if (res && !res.ok) logger.error({ status: res.status }, 'Avertizare Telegram respinsă')
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export async function updateRetailerStatuses(input: StatusInput): Promise<{ changed: number }> {
  const { rows } = await pool.query<RetailerFacts>(`
    SELECT r.id, r.name, r.base_url, r.paused_at, r.pause_reason, r.source_state,
      (SELECT count(*)::int FROM offers o WHERE o.retailer_id = r.id) AS offers_total,
      (SELECT max(o.last_checked) FROM offers o WHERE o.retailer_id = r.id) AS last_fresh,
      ls.source AS last_source, ls.status AS last_status, ls.products_count AS last_count,
      (SELECT array_agg(DISTINCT fs.source) FROM feed_syncs fs
        WHERE fs.retailer_id = r.id AND fs.source <> 'snapshot'
          AND fs.synced_at > now() - INTERVAL '180 days') AS sources
    FROM retailers r
    LEFT JOIN LATERAL (
      SELECT source, status, products_count FROM feed_syncs fs
      WHERE fs.retailer_id = r.id AND fs.source <> 'snapshot'
      ORDER BY fs.synced_at DESC LIMIT 1
    ) ls ON true
  `)

  // Statusul programului de afiliere, pe domeniu (null = magazinul nu e in nicio retea)
  const { rows: advRows } = await pool.query<{ domain: string; active: boolean }>(`
    SELECT domain, bool_or(status = 'active') AS active FROM affiliate_advertisers
    WHERE domain IS NOT NULL GROUP BY domain
  `)
  const advByDomain = new Map(advRows.map((a) => [a.domain, a.active]))

  const changes: string[] = []
  for (const f of rows) {
    const domain = f.base_url ? extractDomain(f.base_url) : null
    const { state, reason } = decideState(f, input, domain ? advByDomain.get(domain) ?? null : null)
    const changed = state !== f.source_state
    await pool.query(`
      UPDATE retailers SET source_state = $2, source_reason = $3, source_checked_at = now(),
        source_state_since = CASE WHEN $4 THEN now() ELSE COALESCE(source_state_since, now()) END
      WHERE id = $1
    `, [f.id, state, reason, changed])
    // Avertizam doar la probleme noi si la revenirea la OK dintr-o problema — nu la pauza pusa
    // chiar de admin si nici la prima calculare a unui magazin sanatos (null → ok)
    const firstOk = f.source_state == null && state === 'ok'
    if (changed && !firstOk && state !== 'paused' && state !== 'empty' && f.source_state !== 'paused') {
      changes.push(state === 'ok'
        ? `✅ <b>${esc(f.name)}</b>: a revenit la OK`
        : `⚠️ <b>${esc(f.name)}</b>: ${STATE_LABELS[state]} — ${esc(reason)}`)
    }
  }

  if (changes.length) {
    const site = process.env.SITE_URL || 'https://www.superieftin.ro'
    await notifyAdmin(`<b>superieftin.ro — surse magazine</b>\n\n${changes.join('\n')}\n\n${site}/admin/magazine`)
  }
  logger.info({ retailers: rows.length, changed: changes.length }, 'Stare magazine actualizată')
  return { changed: changes.length }
}
