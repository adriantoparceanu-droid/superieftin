import pool from './db.js'

// Indicele lunar al prețurilor + „Când să cumperi” (migrația 037; observatorul reducerilor reale,
// docs/plans/2026-10-21-observator-repozitionare-design.md §3).
//
// Ce calculăm și de ce așa:
// - COȘ STABIL: într-o categorie intră doar produsele cu preț în stoc în AMBELE luni comparate.
//   Altfel un catalog care se schimbă (produse noi scumpe, produse vechi ieftine dispărute) ar
//   „mișca” indicele fără ca vreun preț să se fi schimbat.
// - Prețul lunar al unui produs = MINIMUL pe oferte al medianei prețurilor zilnice în stoc din lună
//   (adică „cât costa de obicei, la cel mai ieftin magazin”). Mediana, nu media: o zi cu preț
//   greșit în feed nu strică luna.
// - Variația categoriei = MEDIANA variațiilor pe produs (nu media: câteva produse cu ±60% nu
//   trag cifra întregii categorii).
// - Reducere reală într-o zi = aceeași regulă ca pe site (web/src/lib/discount.ts): oferta în stoc,
//   preț < mediana ultimelor 30 de zile × 0,95, cu cel puțin 2 puncte în fereastră
//   (site-facts / landing-uri: points_30d >= 2 și current_price < median_30d * 0.95).
//
// Unitatea de bază e ZIUA (ora României): pentru fiecare ofertă păstrăm ultimul preț înregistrat
// în ziua respectivă („prețul de închidere”). Feed-sync-ul, verificările prin API și snapshot-ul pot
// scrie 1–3 puncte pe zi; fără comprimare, zilele cu mai multe verificări ar cântări mai mult.
//
// Funcțiile pure (fără DB) sunt testate în price-index.test.ts; cele cu SQL sunt la final.

export const TZ = 'Europe/Bucharest'
export const REAL_DISCOUNT_RATIO = 0.95      // = 1 - REAL_DISCOUNT_PCT/100 din web/src/lib/discount.ts
export const MEDIAN_WINDOW_DAYS = 30         // fereastra medianei (ziua curentă + 29 de zile înainte)
export const MIN_WINDOW_POINTS = 2           // ca points_30d >= 2 de pe site
// O categorie intră în ediția lunară doar cu un coș de cel puțin 30 de produse: sub atât, mediana
// variațiilor e prea ușor de mișcat de câteva produse (decizie conservatoare, notată în raport).
export const MIN_INDEX_BASKET = 30
// „Cele mai mari scăderi”: variațiile peste ±60% într-o lună sunt aproape mereu erori de feed
// (preț de accesoriu pe un produs, preț fără TVA) → nu le arătăm ca „scădere”. Intră totuși în
// mediană (unde nu contează).
export const MAX_PLAUSIBLE_CHANGE_PCT = 60
export const TOP_DROPS = 5
// Magazinul cel mai ieftin pe categorie: doar dacă a câștigat la cel puțin atâtea produse comparabile
export const MIN_CHEAPEST_COMPARED = 5
// Arborii excluși din observator (REGULI.md regula 8: Sănătate & Naturale; farmacia veterinară =
// afirmații de sănătate). Subcategoriile lor sunt excluse și ele.
export const EXCLUDED_ROOTS = ['sanatate-naturale', 'farmacie-veterinara']
// „Prețul obișnuit” al unui produs are sens doar cu câteva săptămâni de date: un produs văzut o
// singură săptămână ar avea mereu nivelul 100 și ar trage seria spre „obișnuit”. Sub prag, produsul
// contează la zilele cu reduceri reale, dar nu la nivelul prețurilor.
export const MIN_TIMING_WEEKS = 4

// --- Date (zile ca text „YYYY-MM-DD”, aritmetică în UTC ca să nu depindă de ora serverului) ----

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

// Luni = începutul săptămânii (ca în România)
export function weekStart(day: string): string {
  const d = new Date(`${day}T00:00:00Z`)
  const dow = (d.getUTCDay() + 6) % 7 // 0 = luni
  return addDays(day, -dow)
}

export function parseMonth(s: string): string | null {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(s.trim())
  return m ? `${m[1]}-${m[2]}` : null
}

// „2026-09” → { start: '2026-09-01', end: '2026-10-01', prevStart: '2026-08-01' } (end exclusiv)
export function monthBounds(month: string): { start: string; end: string; prevStart: string } {
  const [y, m] = month.split('-').map(Number)
  const iso = (yy: number, mm: number) => `${yy}-${String(mm).padStart(2, '0')}-01`
  const next = m === 12 ? iso(y + 1, 1) : iso(y, m + 1)
  const prev = m === 1 ? iso(y - 1, 12) : iso(y, m - 1)
  return { start: iso(y, m), end: next, prevStart: prev }
}

// Ziua de azi în ora României (YYYY-MM-DD)
export function todayInTz(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

// Luna încheiată cel mai recent (ora României): pe 1 noiembrie → „2026-10”
export function previousMonth(now: Date = new Date()): string {
  const today = todayInTz(now)
  return monthBounds(today.slice(0, 7)).prevStart.slice(0, 7)
}

// --- Statistică ---------------------------------------------------------------------------

// Mediana clasică (media celor două din mijloc la număr par) = PERCENTILE_CONT(0.5) din SQL
export function median(values: number[]): number | null {
  if (!values.length) return null
  const s = [...values].sort((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// --- Serii zilnice -----------------------------------------------------------------------

export interface DayPoint { day: string; price: number; inStock: boolean }

// Zilele în care oferta a avut reducere reală. `series` = un punct pe zi, ordonat după zi.
// Fereastra medianei pentru ziua d = [d − 29, d] (30 de zile calendaristice, inclusiv d), cu toate
// punctele (și cele fără stoc — la fel ca offer_price_stats.median_30d de pe site).
export function offerRealDays(series: DayPoint[]): Set<string> {
  const out = new Set<string>()
  let left = 0
  for (let i = 0; i < series.length; i++) {
    const p = series[i]
    const from = addDays(p.day, -(MEDIAN_WINDOW_DAYS - 1))
    while (series[left].day < from) left++
    if (!p.inStock) continue
    const count = i - left + 1
    if (count < MIN_WINDOW_POINTS) continue
    const med = median(series.slice(left, i + 1).map((x) => x.price))
    if (med != null && med > 0 && p.price < med * REAL_DISCOUNT_RATIO) out.add(p.day)
  }
  return out
}

// Mediana prețurilor în stoc dintr-un interval de zile [from, to)
export function inStockMedian(series: DayPoint[], from: string, to: string): number | null {
  return median(series.filter((p) => p.inStock && p.day >= from && p.day < to).map((p) => p.price))
}

// Seriile de zile CONSECUTIVE (o zi lipsă sau fără reducere rupe seria): [{start, length}]
export function streaks(days: Iterable<string>): { start: string; length: number }[] {
  const sorted = [...new Set(days)].sort()
  const out: { start: string; length: number }[] = []
  for (const d of sorted) {
    const last = out[out.length - 1]
    if (last && addDays(last.start, last.length) === d) last.length++
    else out.push({ start: d, length: 1 })
  }
  return out
}

// --- Indicele lunar ----------------------------------------------------------------------

export interface OfferSeries { offerId: number; retailerId: number; retailerName: string; series: DayPoint[] }
export interface ProductSeries { productId: number; slug: string; name: string; categoryId: number; offers: OfferSeries[] }

// Ce reține indicele despre un produs într-o lună (rezultatul lui productMonthEntry)
export interface ProductMonth {
  productId: number
  slug: string
  name: string
  prev: number | null                 // prețul lunar în luna anterioară
  cur: number | null                  // prețul lunar în luna măsurată
  real: boolean                       // cel puțin o zi de reducere reală în luna măsurată
  retailerPrices: { retailerId: number; retailerName: string; price: number }[]  // luna măsurată
}

export function productMonthEntry(p: ProductSeries, month: string): ProductMonth {
  const { start, end, prevStart } = monthBounds(month)
  let prev: number | null = null
  let cur: number | null = null
  let real = false
  const retailerPrices: ProductMonth['retailerPrices'] = []
  for (const o of p.offers) {
    const pm = inStockMedian(o.series, prevStart, start)
    const cm = inStockMedian(o.series, start, end)
    if (pm != null) prev = prev == null ? pm : Math.min(prev, pm)
    if (cm != null) {
      cur = cur == null ? cm : Math.min(cur, cm)
      retailerPrices.push({ retailerId: o.retailerId, retailerName: o.retailerName, price: cm })
    }
    if (!real) for (const d of offerRealDays(o.series)) if (d >= start && d < end) { real = true; break }
  }
  return { productId: p.productId, slug: p.slug, name: p.name, prev, cur, real, retailerPrices }
}

export function inBasket(e: ProductMonth): e is ProductMonth & { prev: number; cur: number } {
  return e.prev != null && e.cur != null && e.prev > 0
}

export function changePct(prev: number, cur: number): number {
  return (cur / prev - 1) * 100
}

export interface CategoryIndex {
  basketSize: number
  medianChangePct: number | null
  shareDownPct: number | null
  realDiscounts: number
  retailers: number
  cheapest: { retailerId: number; retailerName: string; wins: number } | null
  comparedProducts: number
  topDrops: { product_id: number; slug: string; name: string; pct: number }[]
}

// Cifrele unei categorii dintr-o lună. `entries` = toate produsele categoriei (cu subcategorii).
export function buildCategoryIndex(entries: ProductMonth[]): CategoryIndex {
  const basket = entries.filter(inBasket)
  const changes = basket.map((e) => ({ e, pct: changePct(e.prev, e.cur) }))
  const med = median(changes.map((c) => c.pct))

  const retailers = new Set<number>()
  const wins = new Map<number, { name: string; wins: number }>()
  let compared = 0
  for (const e of basket) {
    for (const r of e.retailerPrices) retailers.add(r.retailerId)
    if (e.retailerPrices.length < 2) continue
    compared++
    const sorted = [...e.retailerPrices].sort((a, b) => a.price - b.price)
    // egalitate la cel mai mic preț = niciun câștigător pentru produsul acesta
    if (sorted[0].price === sorted[1].price) continue
    const w = wins.get(sorted[0].retailerId) ?? { name: sorted[0].retailerName, wins: 0 }
    w.wins++
    wins.set(sorted[0].retailerId, w)
  }
  // Câștigătorul trebuie să fie clar: minim MIN_CHEAPEST_COMPARED produse comparate și strict mai
  // multe „victorii” decât al doilea (la egalitate nu numim pe nimeni — fapt pozitiv, dar corect).
  const ranked = [...wins.entries()].sort((a, b) => b[1].wins - a[1].wins)
  const cheapest = compared >= MIN_CHEAPEST_COMPARED && ranked.length && (ranked.length === 1 || ranked[0][1].wins > ranked[1][1].wins)
    ? { retailerId: ranked[0][0], retailerName: ranked[0][1].name, wins: ranked[0][1].wins }
    : null

  const topDrops = changes
    .filter((c) => c.pct < 0 && Math.abs(c.pct) <= MAX_PLAUSIBLE_CHANGE_PCT)
    .sort((a, b) => a.pct - b.pct || a.e.productId - b.e.productId)
    .slice(0, TOP_DROPS)
    .map((c) => ({ product_id: c.e.productId, slug: c.e.slug, name: c.e.name, pct: round2(c.pct) }))

  return {
    basketSize: basket.length,
    medianChangePct: med == null ? null : round2(med),
    shareDownPct: basket.length ? round2((changes.filter((c) => c.pct < 0).length / basket.length) * 100) : null,
    realDiscounts: entries.filter((e) => e.real).length,
    retailers: retailers.size,
    cheapest,
    comparedProducts: compared,
    topDrops,
  }
}

// --- Categorii -------------------------------------------------------------------------------

export interface CategoryRow { id: number; slug: string; name: string; parent_id: number | null }

// Lanțul categorie → părinte → … (inclusiv ea). Protejat împotriva unui ciclu accidental în DB.
export function ancestorChain(id: number, byId: Map<number, CategoryRow>): number[] {
  const out: number[] = []
  let cur: number | null = id
  while (cur != null && byId.has(cur) && !out.includes(cur)) {
    out.push(cur)
    cur = byId.get(cur)!.parent_id
  }
  return out
}

// Categoriile eligibile: toate, mai puțin arborii excluși (EXCLUDED_ROOTS și tot ce e sub ei)
export function eligibleCategories(all: CategoryRow[]): Map<number, CategoryRow> {
  const byId = new Map(all.map((c) => [c.id, c]))
  const out = new Map<number, CategoryRow>()
  for (const c of all) {
    const chain = ancestorChain(c.id, byId)
    if (chain.some((id) => EXCLUDED_ROOTS.includes(byId.get(id)!.slug))) continue
    out.set(c.id, c)
  }
  return out
}

// --- „Când să cumperi” (seria săptămânală) -------------------------------------------------

export interface WeekAcc {
  products: number          // produse cu preț în stoc în săptămână
  ratios: number[]          // preț săptămânal / preț obișnuit, pe produs (doar cele cu ≥ MIN_TIMING_WEEKS săptămâni)
  productDays: number       // zile-produs cu preț în stoc
  realDays: number          // dintre ele, cu reducere reală
  streakCount: number       // serii de reduceri reale care încep în săptămână
  streakDays: number        // suma lungimilor lor
}

export interface ProductTiming {
  firstDay: string | null
  weeks: Map<string, { ratio: number | null; days: number; realDays: number; streakCount: number; streakDays: number }>
}

// Seria săptămânală a unui produs. Prețul zilnic al produsului = cel mai mic preț în stoc dintre
// oferte; prețul săptămânal = mediana zilelor; prețul „obișnuit” = mediana săptămânilor (pe tot
// istoricul). Ratio 0,95 = săptămâna a fost cu 5% sub prețul obișnuit al produsului. Așa putem pune
// la un loc produse de 200 și de 8.000 de lei. Zilele sunt limitate la [.., until).
export function productTiming(p: ProductSeries, until: string): ProductTiming {
  const daily = new Map<string, number>()
  const realDays = new Set<string>()
  let firstDay: string | null = null
  for (const o of p.offers) {
    for (const pt of o.series) {
      if (pt.day >= until) continue
      if (firstDay == null || pt.day < firstDay) firstDay = pt.day
      if (!pt.inStock) continue
      const cur = daily.get(pt.day)
      if (cur == null || pt.price < cur) daily.set(pt.day, pt.price)
    }
    for (const d of offerRealDays(o.series)) if (d < until) realDays.add(d)
  }
  const byWeek = new Map<string, number[]>()
  for (const [d, price] of daily) {
    const w = weekStart(d)
    const arr = byWeek.get(w) ?? []
    arr.push(price)
    byWeek.set(w, arr)
  }
  const weekly = new Map<string, number>()
  for (const [w, prices] of byWeek) weekly.set(w, median(prices)!)
  const usual = weekly.size >= MIN_TIMING_WEEKS ? median([...weekly.values()]) : null
  const weeks: ProductTiming['weeks'] = new Map()
  for (const [w, price] of weekly) {
    const days = byWeek.get(w)!.length
    weeks.set(w, { ratio: usual != null && usual > 0 ? price / usual : null, days, realDays: 0, streakCount: 0, streakDays: 0 })
  }
  for (const d of realDays) {
    const wk = weeks.get(weekStart(d))
    if (wk && daily.has(d)) wk.realDays++
  }
  for (const s of streaks([...realDays].filter((d) => daily.has(d)))) {
    const wk = weeks.get(weekStart(s.start))
    if (wk) { wk.streakCount++; wk.streakDays += s.length }
  }
  return { firstDay, weeks }
}

export interface TimingRow {
  week: string
  products: number
  basketMedian: number | null       // index, 100 = prețul obișnuit
  realDiscountShare: number | null  // procente
  avgRealStreakDays: number | null
  realStreaks: number
  productDays: number
  realDays: number
}

export function finalizeWeeks(acc: Map<string, WeekAcc>): TimingRow[] {
  return [...acc.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([week, a]) => {
    const med = median(a.ratios)
    return {
      week,
      products: a.products,
      basketMedian: med == null ? null : round2(med * 100),
      realDiscountShare: a.productDays ? round2((a.realDays / a.productDays) * 100) : null,
      avgRealStreakDays: a.streakCount ? round2(a.streakDays / a.streakCount) : null,
      realStreaks: a.streakCount,
      productDays: a.productDays,
      realDays: a.realDays,
    }
  })
}

// =========================================================================================
// SQL
// =========================================================================================

async function loadCategories(): Promise<CategoryRow[]> {
  const { rows } = await pool.query<CategoryRow>('SELECT id, slug, name, parent_id FROM categories')
  return rows
}

interface ProductMeta { id: number; slug: string; name: string; category_id: number }

async function loadProducts(categoryIds: number[]): Promise<ProductMeta[]> {
  const { rows } = await pool.query<ProductMeta>(`
    SELECT p.id::int AS id, p.slug, p.name, p.category_id
    FROM products p
    WHERE p.category_id = ANY($1::int[])
      AND EXISTS (SELECT 1 FROM offers o WHERE o.product_id = p.id)
    ORDER BY p.id
  `, [categoryIds])
  return rows
}

// Seria zilnică (ultimul punct din fiecare zi, ora României) pentru ofertele unor produse, în
// intervalul de zile [from, to). Limitele sunt date ca timestamptz → Postgres citește doar
// partițiile lunare necesare din price_history.
async function loadSeries(products: ProductMeta[], from: string, to: string): Promise<ProductSeries[]> {
  const { rows } = await pool.query<{ offer_id: string; product_id: string; retailer_id: number; retailer_name: string; day: string; price: string; in_stock: boolean }>(`
    SELECT DISTINCT ON (ph.offer_id, day)
           ph.offer_id, o.product_id, o.retailer_id, r.name AS retailer_name,
           to_char((ph.recorded_at AT TIME ZONE '${TZ}')::date, 'YYYY-MM-DD') AS day,
           ph.price, ph.in_stock
    FROM price_history ph
    JOIN offers o ON o.id = ph.offer_id
    JOIN retailers r ON r.id = o.retailer_id
    WHERE o.product_id = ANY($1::bigint[])
      AND ph.recorded_at >= ($2::date::timestamp AT TIME ZONE '${TZ}')
      AND ph.recorded_at <  ($3::date::timestamp AT TIME ZONE '${TZ}')
    ORDER BY ph.offer_id, day, ph.recorded_at DESC
  `, [products.map((p) => p.id), from, to])

  const byProduct = new Map<number, ProductSeries>()
  for (const p of products) byProduct.set(p.id, { productId: p.id, slug: p.slug, name: p.name, categoryId: p.category_id, offers: [] })
  const byOffer = new Map<number, OfferSeries>()
  for (const r of rows) {
    const offerId = Number(r.offer_id)
    let o = byOffer.get(offerId)
    if (!o) {
      o = { offerId, retailerId: r.retailer_id, retailerName: r.retailer_name, series: [] }
      byOffer.set(offerId, o)
      byProduct.get(Number(r.product_id))?.offers.push(o)
    }
    o.series.push({ day: r.day, price: Number(r.price), inStock: r.in_stock })
  }
  // DISTINCT ON + ORDER BY offer, day → seriile sunt deja ordonate după zi
  return [...byProduct.values()].filter((p) => p.offers.length)
}

// Câte produse citim odată din istoric (memorie mică, cereri scurte — site-ul folosește același DB)
const BATCH = 1000

async function forEachProductBatch(products: ProductMeta[], from: string, to: string, fn: (batch: ProductSeries[]) => void) {
  for (let i = 0; i < products.length; i += BATCH) {
    fn(await loadSeries(products.slice(i, i + BATCH), from, to))
  }
}

export interface IndexResult {
  month: string
  status: 'computed' | 'skipped-published' | 'skipped-empty' | 'skipped-future'
  categories: number
  basketSize: number
  medianChangePct: number | null
}

// Ediția lunii `month` (YYYY-MM), comparată cu luna anterioară. O ediție publicată nu se rescrie
// (corecțiile = correction_note în price_index_editions, scrisă de mână). `draft` = published=false
// (o ciornă se poate recalcula; paginile publice arată doar edițiile publicate).
export async function computeMonthlyIndex(month: string, opts: { retro?: boolean; draft?: boolean; log?: (m: string) => void; now?: Date } = {}): Promise<IndexResult> {
  const log = opts.log ?? (() => {})
  const { start, end, prevStart } = monthBounds(month)
  const empty = (status: IndexResult['status']): IndexResult => ({ month, status, categories: 0, basketSize: 0, medianChangePct: null })

  // O lună neîncheiată nu are ediție (cifrele s-ar schimba până la final)
  if (end > todayInTz(opts.now)) return empty('skipped-future')
  const { rows: pub } = await pool.query('SELECT 1 FROM price_index_editions WHERE month = $1 AND published', [start])
  if (pub.length) { log(`Ediția ${month} e publicată — nu se rescrie`); return empty('skipped-published') }

  const all = await loadCategories()
  const eligible = eligibleCategories(all)
  const byId = new Map(all.map((c) => [c.id, c]))
  const products = await loadProducts([...eligible.keys()])
  log(`Indice ${month}: ${products.length} produse în categoriile eligibile`)

  // Fereastra medianei de 30 de zile pentru primele zile ale lunii are nevoie de zilele dinainte
  const from = [prevStart, addDays(start, -(MEDIAN_WINDOW_DAYS - 1))].sort()[0]
  const perCategory = new Map<number, ProductMonth[]>()
  const allEntries: { e: ProductMonth; categoryId: number }[] = []
  await forEachProductBatch(products, from, end, (batch) => {
    for (const p of batch) {
      const e = productMonthEntry(p, month)
      if (e.prev == null && e.cur == null) continue
      allEntries.push({ e, categoryId: p.categoryId })
      // produsul intră în categoria lui și în toți părinții ei (un părinte cuprinde subcategoriile)
      for (const cid of ancestorChain(p.categoryId, byId)) {
        if (!eligible.has(cid)) continue
        const arr = perCategory.get(cid) ?? []
        arr.push(e)
        perCategory.set(cid, arr)
      }
    }
  })

  const rows = [...perCategory.entries()]
    .map(([cid, entries]) => ({ cat: byId.get(cid)!, idx: buildCategoryIndex(entries) }))
    .filter((r) => r.idx.basketSize >= MIN_INDEX_BASKET)
  if (!rows.length) { log(`Indice ${month}: nicio categorie cu coș ≥ ${MIN_INDEX_BASKET} — nu scriem ediția`); return empty('skipped-empty') }

  // Cifrele de ansamblu: doar produsele din categoriile care au trecut pragul (fiecare o singură dată)
  const includedCats = new Set(rows.map((r) => r.cat.id))
  const overallEntries = allEntries
    .filter((x) => ancestorChain(x.categoryId, byId).some((c) => includedCats.has(c)))
    .map((x) => x.e)
  const overall = buildCategoryIndex(overallEntries)

  const retro = opts.retro === true
  const published = opts.draft !== true
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    // re-verificăm în tranzacție (două rulări simultane nu suprascriu o ediție publicată)
    const again = await client.query('SELECT 1 FROM price_index_editions WHERE month = $1 AND published FOR UPDATE', [start])
    if (again.rows.length) { await client.query('ROLLBACK'); return empty('skipped-published') }
    await client.query('DELETE FROM price_index_monthly WHERE month = $1', [start])
    await client.query('DELETE FROM price_index_editions WHERE month = $1', [start])
    for (const { cat, idx } of rows) {
      const parent = cat.parent_id != null ? byId.get(cat.parent_id) : undefined
      await client.query(`
        INSERT INTO price_index_monthly (month, category_id, category_slug, category_name, parent_slug, basket_size,
          median_change_pct, share_down_pct, real_discounts, retailers, cheapest_retailer_id, cheapest_retailer_name,
          cheapest_wins, compared_products, top_drops, retroactive, published, computed_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16,$17, now())
      `, [start, cat.id, cat.slug, cat.name, parent?.slug ?? null, idx.basketSize, idx.medianChangePct, idx.shareDownPct,
          idx.realDiscounts, idx.retailers, idx.cheapest?.retailerId ?? null, idx.cheapest?.retailerName ?? null,
          idx.cheapest?.wins ?? null, idx.comparedProducts, JSON.stringify(idx.topDrops), retro, published])
    }
    await client.query(`
      INSERT INTO price_index_editions (month, basket_size, median_change_pct, categories, retailers, real_discounts, retroactive, published, computed_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8, now())
    `, [start, overall.basketSize, overall.medianChangePct, rows.length, overall.retailers, overall.realDiscounts, retro, published])
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }
  log(`Indice ${month}: ${rows.length} categorii, coș total ${overall.basketSize}, mediana ${overall.medianChangePct ?? '—'}%${retro ? ' (retroactiv)' : ''}${published ? '' : ' (ciornă)'}`)
  return { month, status: 'computed', categories: rows.length, basketSize: overall.basketSize, medianChangePct: overall.medianChangePct }
}

// Seria săptămânală pe tot istoricul, până la ultima săptămână ÎNCHEIATĂ (luni–duminică).
// Nu e o arhivă: se rescrie complet la fiecare rulare (tranzacție — site-ul vede vechiul sau noul).
export async function computeBuyTiming(opts: { log?: (m: string) => void; now?: Date } = {}): Promise<{ categories: number; weeks: number }> {
  const log = opts.log ?? (() => {})
  const until = weekStart(todayInTz(opts.now))
  // Prima zi de istoric: precalculată în offer_price_stats (migrația 033) — MIN pe price_history
  // ar citi tot istoricul.
  const { rows: fr } = await pool.query<{ d: string | null }>(
    `SELECT to_char((MIN(first_recorded_at) AT TIME ZONE '${TZ}')::date, 'YYYY-MM-DD') AS d FROM offer_price_stats`,
  )
  const from = fr[0]?.d
  if (!from || from >= until) { log('Când să cumperi: istoric insuficient'); return { categories: 0, weeks: 0 } }

  const all = await loadCategories()
  const eligible = eligibleCategories(all)
  const byId = new Map(all.map((c) => [c.id, c]))
  const products = await loadProducts([...eligible.keys()])

  const acc = new Map<number, Map<string, WeekAcc>>()
  const since = new Map<number, string>()
  await forEachProductBatch(products, from, until, (batch) => {
    for (const p of batch) {
      const t = productTiming(p, until)
      if (!t.weeks.size) continue
      for (const cid of ancestorChain(p.categoryId, byId)) {
        if (!eligible.has(cid)) continue
        if (t.firstDay && (!since.has(cid) || t.firstDay < since.get(cid)!)) since.set(cid, t.firstDay)
        const weeks = acc.get(cid) ?? new Map<string, WeekAcc>()
        for (const [w, s] of t.weeks) {
          const a = weeks.get(w) ?? { products: 0, ratios: [], productDays: 0, realDays: 0, streakCount: 0, streakDays: 0 }
          a.products++
          if (s.ratio != null) a.ratios.push(s.ratio)
          a.productDays += s.days
          a.realDays += s.realDays
          a.streakCount += s.streakCount
          a.streakDays += s.streakDays
          weeks.set(w, a)
        }
        acc.set(cid, weeks)
      }
    }
  })

  const client = await pool.connect()
  let weeksWritten = 0
  try {
    await client.query('BEGIN')
    await client.query('DELETE FROM category_buy_timing')
    for (const [cid, weeks] of acc) {
      const cat = byId.get(cid)!
      const parent = cat.parent_id != null ? byId.get(cat.parent_id) : undefined
      for (const r of finalizeWeeks(weeks)) {
        await client.query(`
          INSERT INTO category_buy_timing (category_id, week, category_slug, category_name, parent_slug, tracked_since,
            products, basket_median, real_discount_share, product_days, real_days, avg_real_streak_days, real_streaks, computed_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13, now())
        `, [cid, r.week, cat.slug, cat.name, parent?.slug ?? null, since.get(cid)!, r.products, r.basketMedian,
            r.realDiscountShare, r.productDays, r.realDays, r.avgRealStreakDays, r.realStreaks])
        weeksWritten++
      }
    }
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }
  log(`Când să cumperi: ${acc.size} categorii, ${weeksWritten} rânduri săptămânale (istoric ${from} – ${addDays(until, -1)})`)
  return { categories: acc.size, weeks: weeksWritten }
}

// Jobul BullMQ `price-index` (lunar pe 1, plus o trecere săptămânală): ediția lunii încheiate
// (dacă nu e deja publicată — o rulare ratată se recuperează la următoarea trecere) + seria
// „Când să cumperi” recalculată pe tot istoricul.
export async function runPriceIndexJob(log: (m: string) => void = () => {}) {
  const index = await computeMonthlyIndex(previousMonth(), { log })
  const timing = await computeBuyTiming({ log })
  return { index: index.status, month: index.month, categories: index.categories, timingCategories: timing.categories }
}
