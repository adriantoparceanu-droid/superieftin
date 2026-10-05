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
//   4. NU e in arborele Sanatate & Naturale (YMYL; exclus deja si din reclame).
// Altfel pagina ramane pe site, complet functionala (pret, oferte, alerta), dar cu
// `noindex, follow` si fara loc in sitemap. Canonical-ul ramane cel propriu.
//
// Aceeasi regula e scrisa in SQL pentru sitemap (PRODUCT_INDEXABLE_SQL, folosit in
// getAllProductSlugs) — modifica-le impreuna.

export const PRODUCT_INDEX_MIN_HISTORY_DAYS = 30

// Radacinile de categorii ale caror produse nu se indexeaza (slug-ul radacinii; subcategoriile
// lor sunt excluse prin parent_slug). Categoriile /c/ din Sanatate & Naturale raman indexabile —
// regula priveste doar paginile de produs.
export const NOINDEX_PRODUCT_ROOTS = ['sanatate-naturale']

export interface ProductIndexInput {
  availableOffers: number                  // cate oferte disponibile are acum
  historyStart: string | Date | null       // prima inregistrare din istoric (getHistoryStart); null = fara istoric
  categoryId: number | null
  categorySlug: string | null
  categoryVisible: boolean | null
  parentSlug: string | null                // null = categoria e radacina
  parentVisible: boolean | null
}

export type ProductNoindexReason = 'fara-oferta' | 'istoric-scurt' | 'fara-categorie' | 'categorie-ascunsa' | 'sanatate'

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
  return { indexable: reasons.length === 0, reasons }
}

// Varianta SQL a conditiilor 2–4, pentru alias-urile p (products), c (categoria produsului,
// INNER JOIN) si pc (parintele, LEFT JOIN). Conditia 1 (oferta disponibila) ramane in
// JOIN-ul pe offers cu OFFER_AVAILABLE_SQL.
//
// Istoricul vine din offer_price_stats.first_recorded_at (migratia 033, precalculat de worker)
// — NU agregam price_history la cerere (regula CPU din CLAUDE.md). Minimul e pe TOATE ofertele
// produsului (si cele indisponibile), ca pe pagina (getHistoryStart).
export const PRODUCT_INDEXABLE_SQL = `(
    c.is_visible AND (pc.id IS NULL OR pc.is_visible)
    AND c.slug <> ALL (ARRAY[${NOINDEX_PRODUCT_ROOTS.map((s) => `'${s}'`).join(',')}]::text[])
    AND COALESCE(pc.slug, '') <> ALL (ARRAY[${NOINDEX_PRODUCT_ROOTS.map((s) => `'${s}'`).join(',')}]::text[])
    AND (SELECT min(s.first_recorded_at) FROM offers o2 JOIN offer_price_stats s ON s.offer_id = o2.id
         WHERE o2.product_id = p.id) <= now() - INTERVAL '${PRODUCT_INDEX_MIN_HISTORY_DAYS} days'
  )`
