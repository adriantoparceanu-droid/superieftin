// Seria zilnică de prețuri pentru graficul și „Pe scurt despre preț” de pe /p/ — logica pură,
// testată în price-series.test.ts.
//
// De ce o serie „cel mai mic preț pe zi”: istoricul are câte un punct pe zi pentru FIECARE ofertă
// (snapshot zilnic + la fiecare schimbare de preț). Vizitatorul vrea să știe cât a costat produsul,
// adică prețul cel mai mic disponibil în fiecare zi — exact ce compară cu „Vezi oferta” de azi.
// Datele vin din istoricul deja încărcat de pagină (getPriceHistory, 90 de zile): nimic agregat
// în SQL la cerere (regula „Mediana precalculată” din CLAUDE.md).

export interface HistoryPointLite {
  price: number
  recorded_at: string
  offer_id?: string
}

export interface DayPrice {
  day: string    // YYYY-MM-DD, ora României
  price: number
}

const RO_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bucharest', year: 'numeric', month: '2-digit', day: '2-digit' })

// Ziua calendaristică (ora României) a unui moment: „2026-10-04”
export function roDay(d: Date | string): string {
  return RO_DAY.format(new Date(d))
}

// Ziua de după / dinainte (aritmetică pe data calendaristică, fără ore → fără probleme de DST)
export function addDays(day: string, n: number): string {
  const t = Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10)) + n * 86_400_000
  return new Date(t).toISOString().slice(0, 10)
}

// Câte zile calendaristice între două zile „YYYY-MM-DD” (b - a)
export function daysBetween(a: string, b: string): number {
  const ta = Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))
  const tb = Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10))
  return Math.round((tb - ta) / 86_400_000)
}

export interface SeriesOptions {
  // Ofertele disponibile acum: dacă există, seria le folosește DOAR pe ele (prețul unui magazin
  // care nu mai are produsul nu e un preț la care îl poți cumpăra). Gol / null → toate.
  offerIds?: Iterable<string> | null
  // Prețul cel mai mic disponibil acum. Dat → seria se termină AZI cu acest preț (adevărul de
  // azi, chiar dacă snapshot-ul zilei n-a rulat încă). null → seria se oprește la ultima zi cu date.
  todayPrice?: number | null
  now?: Date
}

// Cel mai mic preț pe zi. Între două înregistrări ale unei oferte prețul ei rămâne cel cunoscut
// (graficul e în trepte: prețurile se schimbă în salturi).
export function dailyLowSeries(points: HistoryPointLite[], opts: SeriesOptions = {}): DayPrice[] {
  const valid = points.filter((p) => Number.isFinite(p.price) && p.price > 0 && p.recorded_at)
  const wanted = new Set(opts.offerIds ?? [])
  const filtered = wanted.size ? valid.filter((p) => p.offer_id != null && wanted.has(p.offer_id)) : valid
  const use = filtered.length ? filtered : valid

  // Pe ofertă: ziua → ultimul preț al zilei (istoricul vine sortat crescător după dată)
  const byOffer = new Map<string, Map<string, number>>()
  let first: string | null = null
  let last: string | null = null
  for (const p of use) {
    const day = roDay(p.recorded_at)
    const key = p.offer_id ?? '_'
    let m = byOffer.get(key)
    if (!m) { m = new Map(); byOffer.set(key, m) }
    m.set(day, p.price)
    if (first == null || day < first) first = day
    if (last == null || day > last) last = day
  }

  const today = roDay(opts.now ?? new Date())
  const hasToday = opts.todayPrice != null && opts.todayPrice > 0
  if (first == null) return hasToday ? [{ day: today, price: opts.todayPrice! }] : []
  const end = hasToday && today > last! ? today : last!

  const out: DayPrice[] = []
  const known = new Map<string, number>()   // ultimul preț cunoscut al fiecărei oferte
  for (let day = first; day <= end; day = addDays(day, 1)) {
    for (const [key, m] of byOffer) {
      const v = m.get(day)
      if (v != null) known.set(key, v)
    }
    if (known.size) out.push({ day, price: Math.min(...known.values()) })
  }
  if (hasToday && out.length && out[out.length - 1].day === today) out[out.length - 1].price = opts.todayPrice!
  return out
}
