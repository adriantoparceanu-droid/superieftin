// Trackerul de evenimente de reduceri (Black Friday 2026 → /black-friday-2026, migrația 036).
//
// De ce există: în noiembrie mediana MOBILĂ pe 30 de zile (offer_price_stats) „prinde” prețurile
// de campanie în câteva zile, deci nu mai poate spune dacă o reducere de Black Friday e reală.
// Aici comparăm prețul de azi cu o REFERINȚĂ ÎNGHEȚATĂ: mediana fiecărei oferte pe cele 30 de
// zile dinaintea înghețului (freeze_at), calculată o singură dată și apoi niciodată rescrisă.
//
// Definiții (publicate și pe pagină — web/src/lib/event-tracker.ts, modifică-le împreună):
//   - redusă  = prețul de azi e cu cel puțin 5% sub maximul ofertei din ultimele 14 zile;
//   - reală   = prețul de azi ≤ referința × 0,95 (aceeași idee ca „Reducere reală” de pe site,
//               dar față de referința înghețată, nu față de mediana mobilă);
//   - umflată = redusă, NU reală, iar maximul din ultimele 14 zile a fost ≥ referința × 1,10
//               (prețul a urcat înainte de „reducere”, iar reducerea pornește de la prețul urcat).
//
// Rulare: la finalul runPriceSnapshot (best-effort: o eroare aici nu strică snapshot-ul) și
// manual cu `npm run event-tracker:now` (worker/src/scripts/event-tracker.ts).
// Funcțiile pure de mai jos sunt testate în event-tracker.test.ts (fără bază de date).

import pool from './db.js'
import { OFFER_STALE_DAYS } from './stale.js'
import { isExcludedCategory } from './category-texts.js'

export const REDUCED_MIN_PCT = 5          // redusă: ≥ 5% sub maximul din 14 zile
export const REAL_DISCOUNT_PCT = 5        // reală: ≥ 5% sub referință (pragul site-ului, lib/discount.ts)
export const INFLATED_MIN_PCT = 10        // umflată: maximul din 14 zile ≥ 10% peste referință
export const LOOKBACK_DAYS = 14
export const REFERENCE_WINDOW_DAYS = 30
// Referința cere cel puțin o săptămână de înregistrări în fereastra de 30 de zile (pe producție
// snapshot-ul scrie zilnic → ~30 de puncte). O ofertă apărută în ultimele zile dinaintea înghețului
// nu are o „mediană din octombrie” credibilă, deci nu intră în calcul. Varianta conservatoare.
export const MIN_REFERENCE_POINTS = 7

// Rândul „Toate categoriile” din event_daily_stats
export const TOTAL_CATEGORY_ID = 0

// Toleranță la comparațiile cu virgulă mobilă (ex. 100 × 0,95 = 95,00000000000001)
const EPS = 1e-9

// --- Funcții pure ------------------------------------------------------------------------------

export interface Classification {
  reduced: boolean
  real: boolean
  inflated: boolean
}

export function classifyOffer(price: number, max14d: number, reference: number): Classification {
  const max = Math.max(max14d, price)   // maximul include oricum prețul de azi
  const reduced = price <= max * (1 - REDUCED_MIN_PCT / 100) + EPS
  const real = price <= reference * (1 - REAL_DISCOUNT_PCT / 100) + EPS
  const inflated = reduced && !real && max + EPS >= reference * (1 + INFLATED_MIN_PCT / 100)
  return { reduced, real, inflated }
}

export type EventPhase = 'before' | 'live' | 'after'

export interface EventWindow {
  freeze_at: Date
  starts_at: Date
  ends_at: Date              // exclusiv
}

export function eventPhase(e: EventWindow, now: Date): EventPhase {
  const t = now.getTime()
  if (t < new Date(e.starts_at).getTime()) return 'before'
  if (t < new Date(e.ends_at).getTime()) return 'live'
  return 'after'
}

// Ziua calendaristică în România („2026-11-27”) — agregatele sunt pe zile românești
export function bucharestDay(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bucharest', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(d)
}

export function median(values: number[]): number | null {
  if (!values.length) return null
  const s = [...values].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export interface TrackedOffer {
  offerId: string
  productId: string
  retailerId: number
  categoryId: number
  price: number
  max14d: number
  reference: number
}

export interface ClassifiedOffer extends TrackedOffer, Classification {}

export function classifyAll(offers: TrackedOffer[]): ClassifiedOffer[] {
  return offers.map((o) => ({ ...o, ...classifyOffer(o.price, o.max14d, o.reference) }))
}

// Un produs = oferta lui cea mai ieftină dintre cele urmărite (ce vede vizitatorul primul pe /p/);
// la egalitate, id-ul cel mai mic (rezultat stabil de la o zi la alta).
export function pickProductOffers<T extends { productId: string; offerId: string; price: number }>(offers: T[]): T[] {
  const best = new Map<string, T>()
  for (const o of offers) {
    const cur = best.get(o.productId)
    if (!cur || o.price < cur.price || (o.price === cur.price && BigInt(o.offerId) < BigInt(cur.offerId))) {
      best.set(o.productId, o)
    }
  }
  return [...best.values()]
}

export interface CategoryNode {
  id: number
  slug: string
  name: string
  parentId: number | null
}

export interface StatRow {
  categoryId: number
  level: 'total' | 'root' | 'sub'
  parentId: number | null
  slug: string
  name: string
  tracked: number
  reduse: number
  reale: number
  reduseReale: number
  umflate: number
  realDiscountMedianPct: number | null
  stores: number
}

// Agregatele zilei: un rând „total”, unul pe fiecare categorie-părinte (verticalele) și unul pe
// fiecare subcategorie. Granularitatea: părinte + subcategorie (arborele are 2 niveluri); pagina
// arată părinții în tabel și subcategoriile doar sub un prag de volum (web), ca procentele pe
// 3 produse să nu pară concluzii. Produsele puse direct pe părinte intră doar în rândul părintelui.
// `offers` = TOATE ofertele urmărite (pentru numărul de magazine); clasificarea e pe produs.
export function aggregateStats(offers: ClassifiedOffer[], categories: Map<number, CategoryNode>): StatRow[] {
  type Acc = { row: StatRow; discounts: number[]; stores: Set<number> }
  const acc = new Map<number, Acc>()
  const get = (id: number, level: StatRow['level'], node: CategoryNode | null): Acc => {
    let a = acc.get(id)
    if (!a) {
      a = {
        row: {
          categoryId: id, level, parentId: level === 'sub' ? node!.parentId : null,
          slug: node?.slug ?? 'toate', name: node?.name ?? 'Toate categoriile',
          tracked: 0, reduse: 0, reale: 0, reduseReale: 0, umflate: 0, realDiscountMedianPct: null, stores: 0,
        },
        discounts: [],
        stores: new Set(),
      }
      acc.set(id, a)
    }
    return a
  }
  // Ce rânduri primește o ofertă/un produs din categoria `categoryId`
  const targets = (categoryId: number): Acc[] | null => {
    const cat = categories.get(categoryId)
    if (!cat) return null
    const out = [get(TOTAL_CATEGORY_ID, 'total', null)]
    if (cat.parentId != null) {
      const parent = categories.get(cat.parentId)
      if (!parent) return null
      out.push(get(parent.id, 'root', parent), get(cat.id, 'sub', cat))
    } else {
      out.push(get(cat.id, 'root', cat))
    }
    return out
  }

  for (const o of offers) for (const a of targets(o.categoryId) ?? []) a.stores.add(o.retailerId)

  for (const p of pickProductOffers(offers)) {
    const ts = targets(p.categoryId)
    if (!ts) continue
    const discount = (1 - p.price / p.reference) * 100
    for (const a of ts) {
      a.row.tracked++
      if (p.reduced) a.row.reduse++
      if (p.real) { a.row.reale++; a.discounts.push(discount) }
      if (p.reduced && p.real) a.row.reduseReale++
      if (p.inflated) a.row.umflate++
    }
  }

  return [...acc.values()].map(({ row, discounts, stores }) => {
    const m = median(discounts)
    return { ...row, stores: stores.size, realDiscountMedianPct: m == null ? null : Math.round(m * 10) / 10 }
  })
}

// --- Rularea (SQL) -----------------------------------------------------------------------------

interface EventRow extends EventWindow {
  slug: string
  name: string
  reference_computed_at: Date | null
}

export interface EventTrackerResult {
  slug: string
  phase: EventPhase
  referenceRows: number | null     // null = referința exista deja (sau nu e încă momentul)
  day: string | null               // null = nu s-au scris agregate (în afara ferestrei)
  offers: number
  products: number
  statRows: number
}

// Referința înghețată: mediana fiecărei oferte pe [freeze − 30 zile, freeze). O singură dată per
// eveniment (reference_computed_at + rândul evenimentului blocat FOR UPDATE, ca două rulări
// simultane să nu calculeze de două ori). Poate rula oricând după îngheț: fereastra e fixă.
async function computeReference(slug: string): Promise<number | null> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query<{ freeze_at: Date; reference_computed_at: Date | null }>(
      'SELECT freeze_at, reference_computed_at FROM price_events WHERE slug = $1 FOR UPDATE', [slug])
    if (!rows[0] || rows[0].reference_computed_at) {
      await client.query('ROLLBACK')
      return null
    }
    const res = await client.query(`
      INSERT INTO event_reference_prices
        (event_slug, offer_id, product_id, category_id, retailer_id, reference_median, reference_points)
      SELECT $1, o.id, o.product_id, p.category_id, o.retailer_id,
             ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ph.price)::numeric, 2),
             COUNT(*)::int
      FROM price_history ph
      JOIN offers o ON o.id = ph.offer_id
      JOIN products p ON p.id = o.product_id
      WHERE ph.recorded_at >= $2::timestamptz - make_interval(days => $3)
        AND ph.recorded_at < $2::timestamptz
      GROUP BY o.id, o.product_id, p.category_id, o.retailer_id
      ON CONFLICT (event_slug, offer_id) DO NOTHING
    `, [slug, rows[0].freeze_at, REFERENCE_WINDOW_DAYS])
    await client.query('UPDATE price_events SET reference_computed_at = now() WHERE slug = $1', [slug])
    await client.query('COMMIT')
    return res.rowCount ?? 0
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }
}

async function loadCategories(): Promise<Map<number, CategoryNode>> {
  // Doar categoriile vizibile (și cu părinte vizibil), fără Sănătate & Naturale (cu tot arborele)
  // și fără farmacie-veterinara (REGULI.md regula 8; aceeași listă ca importul de texte).
  const { rows } = await pool.query<{ id: number; slug: string; name: string; parent_id: number | null; parent_slug: string | null }>(`
    SELECT c.id, c.slug, c.name, c.parent_id, pc.slug AS parent_slug
    FROM categories c
    LEFT JOIN categories pc ON pc.id = c.parent_id
    WHERE c.is_visible AND COALESCE(pc.is_visible, true)
  `)
  const map = new Map<number, CategoryNode>()
  for (const r of rows) {
    if (isExcludedCategory(r.slug, r.parent_slug ? [r.parent_slug] : [])) continue
    map.set(r.id, { id: r.id, slug: r.slug, name: r.name, parentId: r.parent_id })
  }
  // O subcategorie al cărei părinte a fost exclus/ascuns nu se agregă (nu are vertical)
  for (const [id, c] of map) if (c.parentId != null && !map.has(c.parentId)) map.delete(id)
  return map
}

// Ofertele urmărite azi: au referință (cu destule puncte), sunt DISPONIBILE și au link afiliat.
// Disponibil = aceeași regulă ca OFFER_AVAILABLE_SQL (web/src/lib/availability.ts) și
// ALERT_OFFER_AVAILABLE_SQL (alert-sql.ts), doar că „acum” e parametrul $2 (rularea de test cu
// --as-of); în jobul zilnic $2 = acum, deci regula e identică.
async function loadTrackedOffers(slug: string, asOf: Date, minPoints: number): Promise<TrackedOffer[]> {
  const { rows } = await pool.query<{
    offer_id: string; product_id: string; retailer_id: number; category_id: number
    price: number; max14d: number; reference: number
  }>(`
    WITH ref AS (
      SELECT offer_id, reference_median FROM event_reference_prices
      WHERE event_slug = $1 AND reference_points >= $3
    ),
    mx AS (
      SELECT ph.offer_id, MAX(ph.price) AS max_price
      FROM price_history ph
      WHERE ph.recorded_at >= $2::timestamptz - make_interval(days => $4)
        AND ph.recorded_at <= $2::timestamptz
        AND ph.offer_id IN (SELECT offer_id FROM ref)
      GROUP BY ph.offer_id
    )
    SELECT o.id::text AS offer_id, o.product_id::text AS product_id, o.retailer_id, p.category_id,
           o.current_price::float AS price,
           GREATEST(o.current_price, COALESCE(mx.max_price, o.current_price))::float AS max14d,
           ref.reference_median::float AS reference
    FROM ref
    JOIN offers o ON o.id = ref.offer_id
    JOIN retailers r ON r.id = o.retailer_id
    JOIN products p ON p.id = o.product_id
    LEFT JOIN mx ON mx.offer_id = o.id
    WHERE o.current_price IS NOT NULL AND o.current_price > 0
      AND o.affiliate_url IS NOT NULL
      AND o.in_stock = true
      AND o.last_checked >= $2::timestamptz - make_interval(days => $5)
      AND r.paused_at IS NULL
      AND p.category_id IS NOT NULL
  `, [slug, asOf, minPoints, LOOKBACK_DAYS, OFFER_STALE_DAYS])
  return rows.map((r) => ({
    offerId: r.offer_id, productId: r.product_id, retailerId: r.retailer_id, categoryId: r.category_id,
    price: r.price, max14d: r.max14d, reference: r.reference,
  }))
}

// Scrie starea ofertelor + agregatele zilei într-o singură tranzacție: site-ul vede fie ziua
// veche, fie cea nouă, niciodată o stare pe jumătate.
async function writeDay(slug: string, day: string, offers: ClassifiedOffer[], stats: StatRow[]): Promise<void> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('DELETE FROM event_offer_status WHERE event_slug = $1', [slug])
    if (offers.length) {
      await client.query(`
        INSERT INTO event_offer_status
          (event_slug, offer_id, product_id, day, price, max_14d, reference_median, reduced, is_real, inflated)
        SELECT $1, u.offer_id, u.product_id, $2::date, u.price, u.max_14d, u.reference, u.reduced, u.is_real, u.inflated
        FROM unnest($3::bigint[], $4::bigint[], $5::numeric[], $6::numeric[], $7::numeric[], $8::bool[], $9::bool[], $10::bool[])
          AS u(offer_id, product_id, price, max_14d, reference, reduced, is_real, inflated)
      `, [
        slug, day,
        offers.map((o) => o.offerId), offers.map((o) => o.productId),
        offers.map((o) => o.price), offers.map((o) => o.max14d), offers.map((o) => o.reference),
        offers.map((o) => o.reduced), offers.map((o) => o.real), offers.map((o) => o.inflated),
      ])
    }
    // Upsert pe ziua curentă: rândurile zilei se rescriu complet (o categorie golită azi dispare)
    await client.query('DELETE FROM event_daily_stats WHERE event_slug = $1 AND day = $2::date', [slug, day])
    for (const s of stats) {
      await client.query(`
        INSERT INTO event_daily_stats
          (event_slug, day, category_id, level, parent_id, category_slug, category_name,
           tracked, reduse, reale, reduse_reale, umflate, real_discount_median_pct, stores)
        VALUES ($1, $2::date, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      `, [slug, day, s.categoryId, s.level, s.parentId, s.slug, s.name,
        s.tracked, s.reduse, s.reale, s.reduseReale, s.umflate, s.realDiscountMedianPct, s.stores])
    }
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }
}

export interface RunOptions {
  now?: Date            // doar pentru teste locale (--as-of); implicit acum
  slug?: string         // un singur eveniment; implicit toate
  minPoints?: number    // implicit MIN_REFERENCE_POINTS
}

export async function runEventTracker(opts: RunOptions = {}): Promise<EventTrackerResult[]> {
  const now = opts.now ?? new Date()
  const minPoints = opts.minPoints ?? MIN_REFERENCE_POINTS
  const { rows: events } = await pool.query<EventRow>(
    `SELECT slug, name, freeze_at, starts_at, ends_at, reference_computed_at FROM price_events
     WHERE ($1::text IS NULL OR slug = $1) ORDER BY freeze_at`, [opts.slug ?? null])

  const results: EventTrackerResult[] = []
  for (const e of events) {
    const phase = eventPhase(e, now)
    const r: EventTrackerResult = { slug: e.slug, phase, referenceRows: null, day: null, offers: 0, products: 0, statRows: 0 }
    results.push(r)
    if (now.getTime() < new Date(e.freeze_at).getTime()) continue   // înainte de îngheț: nimic

    let hasReference = e.reference_computed_at != null
    if (!hasReference) {
      r.referenceRows = await computeReference(e.slug)
      hasReference = true
    }
    // Agregatele se scriu doar în fereastra evenimentului; după ea, arhiva rămâne neatinsă.
    if (phase !== 'live' || !hasReference) continue

    const day = bucharestDay(now)
    const [categories, tracked] = await Promise.all([loadCategories(), loadTrackedOffers(e.slug, now, minPoints)])
    const offers = classifyAll(tracked.filter((o) => categories.has(o.categoryId)))
    const stats = aggregateStats(offers, categories)
    await writeDay(e.slug, day, offers, stats)
    r.day = day
    r.offers = offers.length
    r.products = pickProductOffers(offers).length
    r.statRows = stats.length
  }
  return results
}
