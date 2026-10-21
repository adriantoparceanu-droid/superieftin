// Cand e INDEXABILA o pagina de produs /p/<slug> (decizia proprietarului, 5 oct. 2026).
//
// De ce: auditul din docs/seo/2026-10-05-audit-scadere-gsc.md (varianta B) — site-ul a fost
// retrogradat probabil de „August 2026 Spam Update” (prea multe pagini de afiliere subtiri).
// Lasam in index doar paginile care au valoare proprie: un istoric de pret care conteaza
// (mediana pe 30 de zile are sens) si un loc clar in catalog.
//
// Indexabila doar daca TOATE sunt adevarate:
//   1. are cel putin o oferta disponibila (regula existenta — lib/availability.ts);
//   2. il urmarim de cel putin PRODUCT_INDEX_MIN_HISTORY_DAYS zile (prima inregistrare din
//      istoric, pe oricare oferta — aceeasi data pe care pagina o scrie „de cand urmarim produsul”);
//   3. are categorie mapata si vizibila (si parintele ei, daca exista, e vizibil);
//   4. NU e in arborele Sanatate & Naturale (YMYL; exclus deja si din reclame);
//   5. „are poveste” (planul Observatorului, 21 oct. 2026 — docs/plans/2026-10-21-observator-*):
//      se vinde in cel putin PRODUCT_INDEX_MIN_STORES magazine diferite cu oferta disponibila
//      (comparatia are sens) SAU suma schimbarilor de pret pe 60 de zile a ofertelor DISPONIBILE
//      e cel putin PRODUCT_INDEX_MIN_PRICE_CHANGES (istoricul are sens). Un produs dintr-un singur
//      magazin cu pretul neschimbat de doua luni e doar o copie a feed-ului — exact tipul de
//      pagina pe care l-a penalizat August 2026 Spam Update.
//      De ce SUMA, nu maximul: cu un singur magazin cele doua sunt egale daca are o oferta; cand
//      acelasi magazin are mai multe oferte (ex. variante de stoc CITGrup), fiecare miscare de pret
//      vizibila pe pagina face parte din poveste. Doar ofertele disponibile: o oferta disparuta nu
//      mai apare pe pagina, deci istoria ei nu e o poveste pe care vizitatorul o vede.
// Altfel pagina ramane pe site, complet functionala (pret, oferte, alerta), dar cu
// `noindex, follow` si fara loc in sitemap. Canonical-ul ramane cel propriu.
//
// Aceeasi regula e scrisa in SQL pentru sitemap (PRODUCT_INDEXABLE_SQL, folosit in
// getAllProductSlugs) — modifica-le impreuna.

import { OFFER_AVAILABLE_SQL } from '../availability'

export const PRODUCT_INDEX_MIN_HISTORY_DAYS = 30

// Radacinile de categorii ale caror produse nu se indexeaza (slug-ul radacinii; subcategoriile
// lor sunt excluse prin parent_slug). Categoriile /c/ din Sanatate & Naturale raman indexabile —
// regula priveste doar paginile de produs.
export const NOINDEX_PRODUCT_ROOTS = ['sanatate-naturale']

// Pragurile conditiei 5 („are poveste”)
export const PRODUCT_INDEX_MIN_STORES = 2
export const PRODUCT_INDEX_MIN_PRICE_CHANGES = 3

export interface ProductIndexInput {
  availableOffers: number                  // cate oferte disponibile are acum
  historyStart: string | Date | null       // prima inregistrare din istoric (getHistoryStart); null = fara istoric
  categoryId: number | null
  categorySlug: string | null
  categoryVisible: boolean | null
  parentSlug: string | null                // null = categoria e radacina
  parentVisible: boolean | null
  availableStores: number                  // magazine distincte cu oferta disponibila
  priceChanges60d: number                  // suma offer_price_stats.price_changes_60d pe ofertele disponibile
}

export type ProductNoindexReason =
  'fara-oferta' | 'istoric-scurt' | 'fara-categorie' | 'categorie-ascunsa' | 'sanatate' | 'fara-poveste'

export interface ProductIndexDecision {
  indexable: boolean
  reasons: ProductNoindexReason[]          // gol cand e indexabila
}

const DAY_MS = 86_400_000

// true daca prima inregistrare e cu cel putin `days` zile in urma fata de `now`
export function hasHistoryDays(historyStart: string | Date | null, now: Date, days = PRODUCT_INDEX_MIN_HISTORY_DAYS): boolean {
  if (!historyStart) return false
  const t = new Date(historyStart).getTime()
  if (Number.isNaN(t)) return false
  return now.getTime() - t >= days * DAY_MS
}

// Conditia 5: macar doua magazine SAU macar trei schimbari de pret in 60 de zile
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
    // Parintele conteaza doar daca exista (categoria radacina are parentSlug null)
    if (p.categoryVisible !== true || (p.parentSlug != null && p.parentVisible !== true)) reasons.push('categorie-ascunsa')
    if (NOINDEX_PRODUCT_ROOTS.includes(p.categorySlug) || NOINDEX_PRODUCT_ROOTS.includes(p.parentSlug ?? '')) reasons.push('sanatate')
  }
  // Fara oferta disponibila nu exista nici magazine, nici schimbari — motivul real e 'fara-oferta',
  // nu-l dublam cu 'fara-poveste' (rapoartele pe motive ar umfla artificial categoria noua).
  if (p.availableOffers > 0 && !hasStory(p.availableStores, p.priceChanges60d)) reasons.push('fara-poveste')
  return { indexable: reasons.length === 0, reasons }
}

// Varianta SQL a conditiilor 2–5, pentru alias-urile p (products), c (categoria produsului,
// INNER JOIN) si pc (parintele, LEFT JOIN). Conditia 1 (oferta disponibila) ramane in
// JOIN-ul pe offers cu OFFER_AVAILABLE_SQL.
//
// Istoricul vine din offer_price_stats.first_recorded_at (migratia 033, precalculat de worker)
// — NU agregam price_history la cerere (regula CPU din CLAUDE.md). Minimul e pe TOATE ofertele
// produsului (si cele indisponibile), ca pe pagina (getHistoryStart).
// Conditia 5 numara magazinele si aduna price_changes_60d (migratia 035) doar pe ofertele
// disponibile — aceeasi regula ca hasStory(). Subinterogarea isi foloseste propriul alias `o`
// (OFFER_AVAILABLE_SQL e scris pe `o`), care il ascunde pe cel din query-ul exterior.
// Alias-urile sunt parametri ca regula sa poata fi aplicata si paginii principale a unui grup
// de variante (CANONICAL_TARGET_INDEXABLE_SQL).
function productIndexableSql(p: string, c: string, pc: string): string {
  const roots = `ARRAY[${NOINDEX_PRODUCT_ROOTS.map((s) => `'${s}'`).join(',')}]::text[]`
  return `(
    ${c}.is_visible AND (${pc}.id IS NULL OR ${pc}.is_visible)
    AND ${c}.slug <> ALL (${roots})
    AND COALESCE(${pc}.slug, '') <> ALL (${roots})
    AND (SELECT min(s.first_recorded_at) FROM offers o2 JOIN offer_price_stats s ON s.offer_id = o2.id
         WHERE o2.product_id = ${p}.id) <= now() - INTERVAL '${PRODUCT_INDEX_MIN_HISTORY_DAYS} days'
    AND (SELECT count(DISTINCT o.retailer_id) >= ${PRODUCT_INDEX_MIN_STORES}
                OR COALESCE(sum(s5.price_changes_60d), 0) >= ${PRODUCT_INDEX_MIN_PRICE_CHANGES}
         FROM offers o LEFT JOIN offer_price_stats s5 ON s5.offer_id = o.id
         WHERE o.product_id = ${p}.id AND ${OFFER_AVAILABLE_SQL})
  )`
}

export const PRODUCT_INDEXABLE_SQL = productIndexableSql('p', 'c', 'pc')

// Canonical pe variante (migratia 035): products.canonical_product_id e scris de worker
// (worker/src/lib/product-variants.ts) = pagina principala a grupului. Il folosim DOAR daca
// principala e ea insasi indexabila acum (toate cele 5 conditii + oferta disponibila);
// altfel fiecare varianta isi pastreaza decizia proprie. Fragment pentru alias-ul p.
export const CANONICAL_TARGET_INDEXABLE_SQL = `(
    p.canonical_product_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM products cp
      JOIN categories cc ON cc.id = cp.category_id
      LEFT JOIN categories cpc ON cpc.id = cc.parent_id
      WHERE cp.id = p.canonical_product_id
        AND EXISTS (SELECT 1 FROM offers o WHERE o.product_id = cp.id AND ${OFFER_AVAILABLE_SQL})
        AND ${productIndexableSql('cp', 'cc', 'cpc')}
    )
  )`
