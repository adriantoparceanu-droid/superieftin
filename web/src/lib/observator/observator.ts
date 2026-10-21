// Observatorul reducerilor reale: textele și regulile paginilor /indice și /cand-sa-cumperi.
// Pure (fără DB) — testate în observator.test.ts. Cifrele le calculează workerul
// (worker/src/lib/price-index.ts, migrația 037); aici doar le transformăm în fraze.
//
// Reguli (REGULI.md regula 9 + designul din 2026-10-21):
// - fiecare pagină începe cu o frază-fapt DATATĂ, cu sursa și numărul de produse;
// - fără promisiuni („va scădea”, „economisești”), fără prețuri scrise de mână;
// - sub 12 luni de date NU afirmăm sezonalitate anuală („în fiecare noiembrie…”) — spunem doar ce
//   s-a întâmplat în perioada urmărită, de la data primei înregistrări (ca historyPartialSince
//   din lib/seo/product-facts.ts pentru produse).

import { SITE_NAME, SITE_URL, absUrl, formatRoDate, roCount } from '../seo/site'

// Pagina „Când să cumperi <categorie>” există doar cu date suficiente: cel puțin 50 de produse în
// ultima săptămână încheiată și cel puțin 4 săptămâni cu ≥ 50 de produse. Altfel pagina NU există
// (404, nici măcar noindex — designul, §3).
export const MIN_TIMING_PRODUCTS = 50
export const MIN_TIMING_WEEKS = 4
// Sub atâtea zile de istoric nu vorbim de tipare anuale
export const SEASONALITY_MIN_DAYS = 365
// Același prag ca în worker (MIN_INDEX_BASKET) — doar pentru textul metodologiei
export const MIN_INDEX_BASKET = 30

// --- Luni -----------------------------------------------------------------------------------

// Parametrul din URL /indice/2026-09 → '2026-09-01' (sau null: alt format → 404)
export function parseMonthParam(s: string): string | null {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(s)
  return m ? `${m[1]}-${m[2]}-01` : null
}

// '2026-09-01' (sau Date) → '2026-09' (segmentul de URL)
export function monthSlug(month: string | Date): string {
  const iso = typeof month === 'string' ? month : month.toISOString()
  return iso.slice(0, 7)
}

const MONTH_FMT = new Intl.DateTimeFormat('ro-RO', { month: 'long', year: 'numeric', timeZone: 'UTC' })

// '2026-09-01' → „septembrie 2026”
export function monthLabel(month: string): string {
  return MONTH_FMT.format(new Date(`${monthSlug(month)}-01T00:00:00Z`))
}

// '2026-09-01' → '2026-08-01'
export function previousMonthOf(month: string): string {
  const [y, m] = monthSlug(month).split('-').map(Number)
  return m === 1 ? `${y - 1}-12-01` : `${y}-${String(m - 1).padStart(2, '0')}-01`
}

// --- Numere ---------------------------------------------------------------------------------

// Procent cu semn, format românesc: −3,2% / +1,1% / 0%
export function signedPct(n: number | null, digits = 1): string {
  if (n == null) return '—'
  const r = Number(n.toFixed(digits))
  if (r === 0) return '0%'
  const abs = Math.abs(r).toLocaleString('ro-RO', { maximumFractionDigits: digits })
  return `${r < 0 ? '−' : '+'}${abs}%`
}

export function plainPct(n: number | null, digits = 1): string {
  if (n == null) return '—'
  return `${Number(n.toFixed(digits)).toLocaleString('ro-RO', { maximumFractionDigits: digits })}%`
}

// „a scăzut cu 3,2%” / „a crescut cu 1,1%” / „a rămas neschimbat” (sub 0,05 puncte)
export function changeVerb(pct: number | null, gender: 'm' | 'f' = 'm'): string {
  if (pct == null) return gender === 'f' ? 'nu a putut fi calculată' : 'nu a putut fi calculat'
  if (Math.abs(pct) < 0.05) return gender === 'f' ? 'a rămas neschimbată' : 'a rămas neschimbat'
  return pct < 0 ? `a scăzut cu ${plainPct(-pct)}` : `a crescut cu ${plainPct(pct)}`
}

// --- Ediția lunară ----------------------------------------------------------------------------

export interface Edition {
  month: string                     // '2026-09-01'
  basket_size: number
  median_change_pct: number | null
  categories: number
  retailers: number
  real_discounts: number
  retroactive: boolean
  correction_note: string | null
  computed_at: string               // ISO
}

// Fraza-fapt din capul paginii (citabilă de motoarele de căutare și de asistenții AI)
export function editionFact(e: Edition): string {
  const prev = monthLabel(previousMonthOf(e.month))
  return `În ${monthLabel(e.month)}, prețul tipic al celor ${roCount(e.basket_size, 'produse', 'produs')} din coșul stabil ` +
    `(${roCount(e.categories, 'categorii', 'categorie')}, ${roCount(e.retailers, 'magazine', 'magazin')}) ${changeVerb(e.median_change_pct)} față de ${prev} ` +
    `(mediana variațiilor pe produs). Calcul ${SITE_NAME} din prețurile zilnice înregistrate, ${e.retroactive ? 'făcut retroactiv' : 'făcut'} pe ${formatRoDate(e.computed_at)}.`
}

export function editionTitle(month: string): string {
  return `Indicele prețurilor — ${monthLabel(month)}`
}

// --- Rândurile pe categorie ----------------------------------------------------------------------

export interface IndexRow {
  category_slug: string
  category_name: string
  parent_slug: string | null
  basket_size: number
  median_change_pct: number | null
  share_down_pct: number | null
  real_discounts: number
  retailers: number
  cheapest_retailer_name: string | null
  cheapest_wins: number | null
  compared_products: number | null
  top_drops: { product_id: number; slug: string; name: string; pct: number }[]
}

// Rădăcinile cu subcategoriile lor dedesubt. Un părinte care are o SINGURĂ subcategorie cu același
// coș (toate produsele lui sunt în ea) apare o singură dată, ca subcategoria — altfel tabelul ar
// avea două rânduri identice.
export function groupIndexRows<T extends IndexRow>(rows: T[]): { root: T; children: T[] }[] {
  const bySlug = new Map(rows.map((r) => [r.category_slug, r]))
  const roots = rows.filter((r) => !r.parent_slug || !bySlug.has(r.parent_slug))
  const out: { root: T; children: T[] }[] = []
  for (const root of roots.sort((a, b) => b.basket_size - a.basket_size || a.category_name.localeCompare(b.category_name, 'ro'))) {
    const children = rows.filter((r) => r.parent_slug === root.category_slug).sort((a, b) => b.basket_size - a.basket_size)
    if (children.length === 1 && children[0].basket_size === root.basket_size) out.push({ root: children[0], children: [] })
    else out.push({ root, children })
  }
  return out
}

// „Cel mai mic preț lunar la 41 din 60 de produse comparabile”
export function cheapestText(r: IndexRow): string | null {
  if (!r.cheapest_retailer_name || !r.cheapest_wins || !r.compared_products) return null
  return `${r.cheapest_retailer_name}: cel mai mic preț lunar la ${r.cheapest_wins} din ${roCount(r.compared_products, 'produse comparabile', 'produs comparabil')}`
}

// --- „Când să cumperi” ---------------------------------------------------------------------------

export interface TimingWeek {
  week: string                      // luni, '2026-09-28'
  products: number
  basket_median: number | null      // 100 = prețul obișnuit al produselor
  real_discount_share: number | null
  product_days: number
  real_days: number
  avg_real_streak_days: number | null
  real_streaks: number
}

// Există pagina? (vezi MIN_TIMING_PRODUCTS / MIN_TIMING_WEEKS). `weeks` ordonate după săptămână.
export function timingEligible(weeks: Pick<TimingWeek, 'products'>[]): boolean {
  if (!weeks.length) return false
  const last = weeks[weeks.length - 1]
  return last.products >= MIN_TIMING_PRODUCTS && weeks.filter((w) => w.products >= MIN_TIMING_PRODUCTS).length >= MIN_TIMING_WEEKS
}

// Săptămânile „cu date suficiente” (aceeași limită ca pragul paginii) — restul nu intră în topuri
export function solidWeeks<T extends Pick<TimingWeek, 'products'>>(weeks: T[]): T[] {
  return weeks.filter((w) => w.products >= MIN_TIMING_PRODUCTS)
}

export interface TimingSummary {
  realShare: number | null          // % din zilele-produs cu reducere reală, pe toată perioada
  avgStreak: number | null          // durata medie a unei reduceri reale (zile)
  streaks: number
  weeks: number
  maxProducts: number
}

export function timingSummary(weeks: TimingWeek[]): TimingSummary {
  const pd = weeks.reduce((s, w) => s + w.product_days, 0)
  const rd = weeks.reduce((s, w) => s + w.real_days, 0)
  const streaks = weeks.reduce((s, w) => s + w.real_streaks, 0)
  const streakDays = weeks.reduce((s, w) => s + (w.avg_real_streak_days ?? 0) * w.real_streaks, 0)
  return {
    realShare: pd ? (rd / pd) * 100 : null,
    avgStreak: streaks ? streakDays / streaks : null,
    streaks,
    weeks: weeks.length,
    maxProducts: weeks.reduce((m, w) => Math.max(m, w.products), 0),
  }
}

// Cele mai multe reduceri reale (procent din zilele-produs), doar săptămânile cu date suficiente
export function topRealWeeks<T extends TimingWeek>(weeks: T[], n = 3): T[] {
  return solidWeeks(weeks)
    .filter((w) => (w.real_discount_share ?? 0) > 0)
    .sort((a, b) => (b.real_discount_share ?? 0) - (a.real_discount_share ?? 0) || a.week.localeCompare(b.week))
    .slice(0, n)
}

// Prețurile cele mai joase față de obișnuit (nivel < 100), doar săptămânile cu date suficiente
export function lowestLevelWeeks<T extends TimingWeek>(weeks: T[], n = 3): T[] {
  return solidWeeks(weeks)
    .filter((w) => w.basket_median != null && w.basket_median < 99.95)
    .sort((a, b) => a.basket_median! - b.basket_median! || a.week.localeCompare(b.week))
    .slice(0, n)
}

const DAY_MONTH = new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const DAY_MONTH_YEAR = new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

function addDaysIso(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

// '2026-09-28' → „28 sept. – 4 oct. 2026”
export function weekLabel(week: string): string {
  const start = new Date(`${week}T00:00:00Z`)
  const end = new Date(`${addDaysIso(week, 6)}T00:00:00Z`)
  return `${DAY_MONTH.format(start)} – ${DAY_MONTH_YEAR.format(end)}`
}

// '2026-06-11' → „11 iunie 2026”
export function trackedSinceDate(trackedSince: string): string {
  return formatRoDate(`${trackedSince.slice(0, 10)}T12:00:00Z`)
}

// „de la 11 iunie 2026, de când urmărim categoria”
export function trackedSincePhrase(trackedSince: string, what = 'categoria'): string {
  return `de la ${trackedSinceDate(trackedSince)}, de când urmărim ${what}`
}

export function seasonalityAllowed(trackedSince: string, now: Date = new Date()): boolean {
  const t = new Date(`${trackedSince.slice(0, 10)}T00:00:00Z`).getTime()
  return Number.isFinite(t) && now.getTime() - t >= SEASONALITY_MIN_DAYS * 86_400_000
}

// Fraza-fapt de pe /cand-sa-cumperi/<categorie>
export function timingFact(name: string, trackedSince: string, s: TimingSummary, computedAt: string, lastProducts: number): string {
  const since = trackedSincePhrase(trackedSince)
  const share = s.realShare == null ? '' : `, ${plainPct(s.realShare)} din zilele-produs la ${name} au avut o reducere reală (preț cu cel puțin 5% sub mediana pe 30 de zile)`
  const streak = s.avgStreak == null ? '' : `; o reducere reală a durat în medie ${s.avgStreak.toLocaleString('ro-RO', { maximumFractionDigits: 1 })} ${s.avgStreak < 1.05 ? 'zi' : 'zile'}`
  const head = since.charAt(0).toUpperCase() + since.slice(1)
  return `${head}${share}${streak}. Calcul ${SITE_NAME} din prețurile zilnice pentru ${roCount(lastProducts, 'produse', 'produs')} (ultima săptămână încheiată), actualizat pe ${formatRoDate(computedAt)}.`
}

// --- JSON-LD ---------------------------------------------------------------------------------

export function faqPageLd(items: { q: string; a: string }[]) {
  if (!items.length) return null
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  }
}

// Dataset (schema.org) — Google Dataset Search + asistenții AI: ce măsurăm, pe ce perioadă, cine.
export function datasetLd(d: {
  name: string
  description: string
  path: string
  dateModified: string
  temporalCoverage: string            // „2026-06-11/2026-10-18” sau „2026-09”
  variableMeasured: string[]
  keywords?: string[]
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: d.name,
    description: d.description,
    url: absUrl(d.path),
    inLanguage: 'ro-RO',
    isAccessibleForFree: true,
    dateModified: d.dateModified,
    temporalCoverage: d.temporalCoverage,
    spatialCoverage: { '@type': 'Place', name: 'România' },
    variableMeasured: d.variableMeasured,
    ...(d.keywords?.length ? { keywords: d.keywords } : {}),
    creator: { '@id': `${SITE_URL}/#organization` },
    publisher: { '@id': `${SITE_URL}/#organization` },
    measurementTechnique: 'Prețuri zilnice din feed-urile magazinelor și scanări periodice; mediana pe 30 de zile pe ofertă; coș stabil de produse.',
  }
}
