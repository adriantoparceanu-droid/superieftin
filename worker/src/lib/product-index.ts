// Copie a regulii de indexare a paginilor /p/ din web/src/lib/seo/product-index.ts, pentru
// raportul doar-citire `npm run seo:index-report` (worker/src/scripts/seo-index-report.ts).
// Workerul nu poate importa cod din web la build (rootDir = src), deci regula e dublata —
// testul de paritate (product-index.test.ts) o compara cu cea din web pe o grila de cazuri.
// MODIFICA-LE IMPREUNA.
//
// Conditii (toate): 1. oferta disponibila; 2. istoric ≥ 30 de zile; 3. categorie mapata si
// vizibila (si parintele); 4. nu Sanatate & Naturale; 5. „are poveste” (21 oct. 2026):
// ≥ 2 magazine cu oferta disponibila SAU ≥ 3 schimbari de pret in 60 de zile (suma pe ofertele
// disponibile, offer_price_stats.price_changes_60d).

export const PRODUCT_INDEX_MIN_HISTORY_DAYS = 30
export const NOINDEX_PRODUCT_ROOTS = ['sanatate-naturale']
export const PRODUCT_INDEX_MIN_STORES = 2
export const PRODUCT_INDEX_MIN_PRICE_CHANGES = 3

export interface ProductIndexInput {
  availableOffers: number
  historyStart: string | Date | null
  categoryId: number | null
  categorySlug: string | null
  categoryVisible: boolean | null
  parentSlug: string | null
  parentVisible: boolean | null
  availableStores: number
  priceChanges60d: number
}

export type ProductNoindexReason =
  'fara-oferta' | 'istoric-scurt' | 'fara-categorie' | 'categorie-ascunsa' | 'sanatate' | 'fara-poveste'

export interface ProductIndexDecision {
  indexable: boolean
  reasons: ProductNoindexReason[]
}

const DAY_MS = 86_400_000

export function hasHistoryDays(historyStart: string | Date | null, now: Date, days = PRODUCT_INDEX_MIN_HISTORY_DAYS): boolean {
  if (!historyStart) return false
  const t = new Date(historyStart).getTime()
  if (Number.isNaN(t)) return false
  return now.getTime() - t >= days * DAY_MS
}

export function hasStory(availableStores: number, priceChanges60d: number): boolean {
  return availableStores >= PRODUCT_INDEX_MIN_STORES || priceChanges60d >= PRODUCT_INDEX_MIN_PRICE_CHANGES
}

export function productIndexDecision(p: ProductIndexInput, now: Date = new Date()): ProductIndexDecision {
  const reasons: ProductNoindexReason[] = []
  if (p.availableOffers <= 0) reasons.push('fara-oferta')
  if (!hasHistoryDays(p.historyStart, now)) reasons.push('istoric-scurt')
  if (p.categoryId == null || !p.categorySlug) {
    reasons.push('fara-categorie')
  } else {
    if (p.categoryVisible !== true || (p.parentSlug != null && p.parentVisible !== true)) reasons.push('categorie-ascunsa')
    if (NOINDEX_PRODUCT_ROOTS.includes(p.categorySlug) || NOINDEX_PRODUCT_ROOTS.includes(p.parentSlug ?? '')) reasons.push('sanatate')
  }
  if (p.availableOffers > 0 && !hasStory(p.availableStores, p.priceChanges60d)) reasons.push('fara-poveste')
  return { indexable: reasons.length === 0, reasons }
}

// Regula de dinainte de 21 oct. 2026 (conditiile 1–4) — doar pentru comparatia din raport
export function oldIndexable(d: ProductIndexDecision): boolean {
  return d.reasons.every((r) => r === 'fara-poveste')
}
