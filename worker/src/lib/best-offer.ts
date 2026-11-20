// „Cel mai ieftin magazin partener” — regula blogului de recomandări (reorganizarea din 20 nov. 2026,
// docs/plans/2026-11-20-reorganizare-blog-design.md). Un produs dintr-un articol are UN buton, spre
// oferta aleasă de pickBestOffer. Aceeași regulă e în web/src/lib/best-offer.ts — modifică-le împreună.
//
// Regula:
//   1. doar oferte DISPONIBILE (ca OFFER_AVAILABLE_SQL din web: în stoc, confirmate în ultimele
//      3 zile, magazin nepus pe pauză) — în worker: ALERT_OFFER_AVAILABLE_SQL din alert-sql.ts;
//   2. doar oferte cu link afiliat (fără link = click fără comision);
//   3. prețul cel mai mic câștigă; la egalitate, oferta confirmată cel mai recent (last_checked).
//
// Modulul e PUR (fără DB) — testat în best-offer.test.ts. Query-urile stau în best-offer-query.ts.

export interface OfferCandidate {
  offerId: number
  price: number | null
  available: boolean
  affiliateUrl: string | null
  lastChecked: Date | string | null
}

const time = (d: Date | string | null): number => {
  if (d == null) return -Infinity
  const t = (d instanceof Date ? d : new Date(d)).getTime()
  return Number.isNaN(t) ? -Infinity : t
}

// Oferta care poate primi butonul: disponibilă, cu preț pozitiv și link afiliat nevid.
export function isEligibleOffer(o: OfferCandidate): boolean {
  return o.available && o.price != null && Number.isFinite(o.price) && o.price > 0
    && typeof o.affiliateUrl === 'string' && o.affiliateUrl.trim() !== ''
}

// Cea mai ieftină ofertă eligibilă; la egalitate de preț, cea confirmată cel mai recent; dacă și
// asta e egală, id-ul mai mic (rezultat stabil). Nicio ofertă eligibilă → null.
export function pickBestOffer<T extends OfferCandidate>(offers: readonly T[]): T | null {
  let best: T | null = null
  for (const o of offers) {
    if (!isEligibleOffer(o)) continue
    if (!best) { best = o; continue }
    const dp = (o.price as number) - (best.price as number)
    if (dp < 0) { best = o; continue }
    if (dp > 0) continue
    const dt = time(o.lastChecked) - time(best.lastChecked)
    if (dt > 0 || (dt === 0 && o.offerId < best.offerId)) best = o
  }
  return best
}

// Reducere reală = regula site-ului: prețul de azi STRICT sub mediana pe 30 de zile × 0,95.
// Fără mediană (istoric prea scurt) → nu afirmăm reducere.
export const REAL_DISCOUNT_FACTOR = 0.95

export function isRealDiscount(price: number | null, median30d: number | null): boolean {
  if (price == null || median30d == null || !(median30d > 0)) return false
  return price < median30d * REAL_DISCOUNT_FACTOR
}

// Filtrul de buget din `npm run cercetare -- --buget=N`: prețul cel mai bun ≤ buget.
// Fără buget → orice preț trece.
export function withinBudget(price: number | null, budget: number | null | undefined): boolean {
  if (budget == null) return true
  return price != null && price <= budget
}

// Ordinea implicită a candidaților la cercetare: întâi produsele vândute de mai multe magazine
// (comparabile, „au poveste”), apoi cele mai ieftine; la egalitate, după slug (stabil).
export interface RankedCandidate {
  slug: string
  bestPrice: number
  storeCount: number
}

export function compareCandidates(a: RankedCandidate, b: RankedCandidate): number {
  return (b.storeCount - a.storeCount) || (a.bestPrice - b.bestPrice) || a.slug.localeCompare(b.slug)
}
