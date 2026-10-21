// Trackerul de evenimente (Black Friday 2026 → /black-friday-2026, migrația 036) — partea PURĂ
// din web: faza evenimentului, frazele-fapt datate, procentele din tabel, punctele graficului,
// rândul „umflat” de pe /p/. Fără DB — testate în event-tracker.test.ts.
//
// Cifrele vin DOAR din tabelele precalculate de worker (worker/src/lib/event-tracker.ts):
// event_daily_stats (agregate zilnice) și event_offer_status (starea de azi a fiecărei oferte).
// Definițiile de mai jos sunt cele ale workerului — modifică-le împreună.
//
// Ton (decizia proprietarului): pozitiv + agregat. Fără clasament de magazine; „umflarea” apare
// doar agregat pe categorie și ca fapt pe pagina produsului. Fără promisiuni (REGULI.md, regula 9).

import { formatRoDate, roCount } from './seo/site'

export const EVENT_REDUCED_MIN_PCT = 5      // redusă: ≥ 5% sub maximul din ultimele 14 zile
export const EVENT_REAL_PCT = 5             // reală: ≥ 5% sub referința înghețată
export const EVENT_INFLATED_MIN_PCT = 10    // umflată: maximul din 14 zile ≥ 10% peste referință
export const EVENT_LOOKBACK_DAYS = 14
export const EVENT_REFERENCE_DAYS = 30
export const EVENT_MIN_REFERENCE_POINTS = 7   // MIN_REFERENCE_POINTS din worker

// Subcategoriile apar în tabel doar cu destule produse urmărite: un procent pe 4 produse nu e
// o concluzie. Părinții (verticalele) apar mereu.
export const SUB_MIN_TRACKED = 30

// Excluderi (REGULI.md regula 8): workerul nu le agregă deloc; aici pentru lista „reduceri reale
// azi” din starea de dinainte de îngheț (aceeași listă ca worker/src/lib/category-texts.ts).
// Evenimentele cu pagină proprie (app/<slug>/page.tsx). Linkul de pe /p/ apare doar spre ele;
// un eveniment nou în price_events fără pagină nu produce linkuri moarte.
export const EVENT_PAGES = ['black-friday-2026']

export const EVENT_EXCLUDED_ROOTS = ['sanatate-naturale']
export const EVENT_EXCLUDED_SLUGS = ['farmacie-veterinara']

export function isEventExcluded(slug: string, parentSlug: string | null): boolean {
  return EVENT_EXCLUDED_ROOTS.includes(slug) || EVENT_EXCLUDED_SLUGS.includes(slug)
    || (parentSlug != null && (EVENT_EXCLUDED_ROOTS.includes(parentSlug) || EVENT_EXCLUDED_SLUGS.includes(parentSlug)))
}

export interface PriceEvent {
  slug: string
  name: string
  freeze_at: string | Date
  starts_at: string | Date
  ends_at: string | Date        // exclusiv
  reference_computed_at: string | Date | null
}

export interface DailyStat {
  day: string                   // YYYY-MM-DD (ora României)
  category_id: number
  level: 'total' | 'root' | 'sub'
  parent_id: number | null
  category_slug: string
  category_name: string
  tracked: number
  reduse: number
  reale: number
  reduse_reale: number
  umflate: number
  real_discount_median_pct: number | null
  stores: number
  computed_at: string | Date
}

export type EventPhase = 'before' | 'live' | 'after'

const ms = (d: string | Date) => new Date(d).getTime()

export function eventPhase(e: Pick<PriceEvent, 'starts_at' | 'ends_at'>, now: Date = new Date()): EventPhase {
  if (now.getTime() < ms(e.starts_at)) return 'before'
  if (now.getTime() < ms(e.ends_at)) return 'live'
  return 'after'
}

// Ultima zi a ferestrei (ends_at e exclusiv): „2 decembrie 2026”
export function lastEventDay(e: Pick<PriceEvent, 'ends_at'>): Date {
  return new Date(ms(e.ends_at) - 1)
}

// Luna referinței: fereastra [freeze − 30 zile, freeze) → luna zilei dinaintea înghețului
// („octombrie” pentru înghețul din 1 noiembrie). Folosită în „mediana din octombrie”.
export function referenceMonth(e: Pick<PriceEvent, 'freeze_at'>): string {
  return new Intl.DateTimeFormat('ro-RO', { month: 'long', timeZone: 'Europe/Bucharest' }).format(new Date(ms(e.freeze_at) - 1))
}

// Ziua „YYYY-MM-DD” ca dată românească: „27 noiembrie 2026”
export function dayLabel(day: string): string {
  return formatRoDate(`${day}T12:00:00Z`)
}

// Procent întreg din parte/întreg, rotunjit (null la întreg 0)
export function share(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 100) : null
}

// Fraza-fapt de sus, datată, cu N și sursa: citabilă de motoare și asistenți AI.
export function headlineSentence(total: Pick<DailyStat, 'day' | 'tracked' | 'reduse' | 'reduse_reale' | 'stores'>, e: Pick<PriceEvent, 'freeze_at'>): string {
  const date = dayLabel(total.day)
  const month = referenceMonth(e)
  const scope = `Am urmărit ${roCount(total.tracked, 'produse', 'produs')} în ${roCount(total.stores, 'magazine', 'magazin')}.`
  if (total.reduse === 0) {
    return `Pe ${date}, niciun produs urmărit nu era redus față de prețul lui maxim din ultimele ${EVENT_LOOKBACK_DAYS} zile. ${scope}`
  }
  if (total.reduse === 1) {
    return `Pe ${date}, un singur produs urmărit era redus, iar reducerea lui ${total.reduse_reale ? 'era' : 'nu era'} `
      + `reală (preț cu cel puțin ${EVENT_REAL_PCT}% sub mediana lui din ${month}). ${scope}`
  }
  const pct = share(total.reduse_reale, total.reduse)!
  return `Pe ${date}, ${pct}% din cele ${roCount(total.reduse, 'produse reduse')} aveau o reducere reală: `
    + `preț cu cel puțin ${EVENT_REAL_PCT}% sub mediana lor din ${month}. ${scope}`
}

// Punctele graficului zilnic: % reduceri reale din produsele reduse, pe rândul „total”
export interface ChartPoint { day: string; pct: number; reduse: number }

export function chartPoints(stats: DailyStat[]): ChartPoint[] {
  return stats
    .filter((s) => s.level === 'total' && s.reduse > 0)
    .map((s) => ({ day: s.day, pct: share(s.reduse_reale, s.reduse)!, reduse: s.reduse }))
    .sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0))
}

// Ultima zi cu agregate și rândurile ei, ordonate: total, apoi părinții (după numărul de produse),
// fiecare urmat de subcategoriile lui cu volum suficient.
export function latestDay(stats: DailyStat[]): string | null {
  return stats.reduce<string | null>((m, s) => (m == null || s.day > m ? s.day : m), null)
}

export interface TableRow extends DailyStat { indent: boolean }

export function tableRows(stats: DailyStat[], day: string): { total: DailyStat | null; rows: TableRow[] } {
  const today = stats.filter((s) => s.day === day)
  const total = today.find((s) => s.level === 'total') ?? null
  const roots = today.filter((s) => s.level === 'root').sort((a, b) => b.tracked - a.tracked || a.category_id - b.category_id)
  const rows: TableRow[] = []
  for (const r of roots) {
    rows.push({ ...r, indent: false })
    const subs = today
      .filter((s) => s.level === 'sub' && s.parent_id === r.category_id && s.tracked >= SUB_MIN_TRACKED)
      // o subcategorie identică cu părintele (singura cu produse) nu adaugă informație
      .filter((s) => s.tracked !== r.tracked || s.reduse !== r.reduse)
      .sort((a, b) => b.tracked - a.tracked || a.category_id - b.category_id)
    for (const s of subs) rows.push({ ...s, indent: true })
  }
  return { total, rows }
}

// --- /p/: „În cele 14 zile dinaintea reducerii, prețul a urcat cu X% peste mediana din octombrie.”

export interface OfferEventStatus {
  event_slug: string
  starts_at: string | Date
  ends_at: string | Date
  freeze_at: string | Date
  day: string                    // ziua calculului (YYYY-MM-DD)
  price: number                  // prețul la calcul
  max_14d: number
  reference_median: number
  inflated: boolean
}

// Procentul cu care maximul din 14 zile a depășit referința, rotunjit în JOS (nu exagerăm)
export function inflationPct(max14d: number, reference: number): number | null {
  if (!(reference > 0) || !(max14d > 0)) return null
  return Math.floor(((max14d / reference) - 1) * 100 + 1e-9)
}

// Rândul se afișează doar dacă: suntem în fereastra evenimentului, calculul e de azi sau de ieri
// (ora României), oferta e tot cea mai ieftină și are ACELAȘI preț ca la calcul (altfel faptul
// poate fi vechi), iar oferta e „umflată” (≥ pragul de 10%).
export function inflationFact(
  s: OfferEventStatus | null,
  currentPrice: number | null,
  today: string,               // YYYY-MM-DD, ora României
  now: Date = new Date(),
): { pct: number; month: string } | null {
  if (!s || !s.inflated || currentPrice == null) return null
  if (eventPhase(s, now) !== 'live') return null
  if (Math.abs(currentPrice - s.price) > 0.005) return null
  const yesterday = new Date(Date.parse(`${today}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10)
  if (s.day !== today && s.day !== yesterday) return null
  const pct = inflationPct(s.max_14d, s.reference_median)
  if (pct == null || pct < EVENT_INFLATED_MIN_PCT) return null
  return { pct, month: referenceMonth(s) }
}

export function inflationSentence(f: { pct: number; month: string }, multipleOffers: boolean): string {
  const base = `În cele ${EVENT_LOOKBACK_DAYS} zile dinaintea reducerii, prețul a urcat cu ${f.pct}% peste mediana din ${f.month}.`
  return multipleOffers ? `La oferta cea mai ieftină: ${base.charAt(0).toLocaleLowerCase('ro-RO')}${base.slice(1)}` : base
}

// --- FAQ (aceleași texte pe pagină și în FAQPage) ---------------------------------------------

export function eventFaq(e: Pick<PriceEvent, 'name' | 'freeze_at' | 'ends_at'>): { q: string; a: string }[] {
  const month = referenceMonth(e)
  const freeze = formatRoDate(e.freeze_at)
  const last = formatRoDate(lastEventDay(e))
  return [
    {
      q: 'Ce înseamnă „reducere reală” în acest tracker?',
      a: `Prețul de azi e cu cel puțin ${EVENT_REAL_PCT}% sub mediana prețurilor aceluiași produs din cele ${EVENT_REFERENCE_DAYS} de zile dinaintea lui ${freeze} (mediana din ${month}), nu față de „prețul vechi” afișat de magazin.`,
    },
    {
      q: `De ce mediana din ${month} și nu mediana ultimelor ${EVENT_REFERENCE_DAYS} de zile?`,
      a: `În timpul campaniilor, mediana mobilă ajunge în câteva zile la prețurile de campanie și nu mai poate spune dacă o reducere e reală. De aceea, pentru ${e.name} folosim o referință înghețată pe ${freeze}, calculată o singură dată și apoi neschimbată.`,
    },
    {
      q: 'Ce e o „reducere umflată”?',
      a: `Un produs redus (cu cel puțin ${EVENT_REDUCED_MIN_PCT}% sub maximul lui din ultimele ${EVENT_LOOKBACK_DAYS} zile) al cărui preț urcase înainte cu cel puțin ${EVENT_INFLATED_MIN_PCT}% peste mediana din ${month}, iar prețul de azi nu e cu cel puțin ${EVENT_REAL_PCT}% sub referință. O arătăm doar agregat, pe categorii, fără clasament de magazine.`,
    },
    {
      q: 'Ce produse intră în calcul?',
      a: `Produsele disponibile acum (în stoc, confirmate în ultimele 3 zile), cu link de afiliere, care au cel puțin ${EVENT_MIN_REFERENCE_POINTS} prețuri înregistrate în cele ${EVENT_REFERENCE_DAYS} de zile dinaintea lui ${freeze}. Un produs vândut de mai multe magazine se numără o dată, după oferta lui cea mai ieftină. Categoria Sănătate & Naturale nu e inclusă.`,
    },
    {
      q: 'Cât timp se actualizează pagina?',
      a: `Cifrele se recalculează zilnic, după verificarea prețurilor, de pe ${freeze} până pe ${last}. După aceea pagina rămâne ca arhivă.`,
    },
  ]
}
