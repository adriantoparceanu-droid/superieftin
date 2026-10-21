// Raport DOAR-CITIRE: cate pagini /p/ sunt indexabile cu regula veche (5 oct. 2026) fata de
// regula noua „are poveste” (21 oct. 2026), defalcat pe motive si pe categoria-parinte, plus cate
// variante trimit canonical spre o pagina principala (migratia 035).
//
// De ce: planul „Observatorul reducerilor reale” cere cifra exacta de pagini indexabile pe
// productie, prezentata proprietarului (docs/plans/2026-10-21-observator-repozitionare-design.md).
//
// Utilizare:
//   cd worker && npm run seo:index-report
//   prod: docker compose exec -T worker node worker/dist/scripts/seo-index-report.js
//
// Nu scrie nimic. Regula e copia din lib/product-index.ts (paritate testata cu web); istoricul
// = MIN(offer_price_stats.first_recorded_at), ca in sitemap (PRODUCT_INDEXABLE_SQL).
// O singura citire pe tot catalogul (subinterogari pe index, fara agregare pe price_history).

import pool from '../lib/db.js'
import { ALERT_OFFER_AVAILABLE_SQL } from '../lib/alert-sql.js'
import { productIndexDecision, oldIndexable, type ProductNoindexReason } from '../lib/product-index.js'

interface Row {
  id: string
  canonical_product_id: string | null
  category_id: number | null
  category_slug: string | null
  category_visible: boolean | null
  parent_slug: string | null
  parent_visible: boolean | null
  root_name: string | null
  available_offers: number
  available_stores: number
  price_changes_60d: number
  history_start: Date | null
}

async function main(): Promise<void> {
  const { rows } = await pool.query<Row>(`
    SELECT p.id::text, p.canonical_product_id::text,
           p.category_id, c.slug AS category_slug, c.is_visible AS category_visible,
           pc.slug AS parent_slug, pc.is_visible AS parent_visible,
           COALESCE(pc.name, c.name) AS root_name,
           COALESCE(av.offers, 0) AS available_offers,
           COALESCE(av.stores, 0) AS available_stores,
           COALESCE(av.changes, 0) AS price_changes_60d,
           (SELECT min(s.first_recorded_at) FROM offers o JOIN offer_price_stats s ON s.offer_id = o.id
            WHERE o.product_id = p.id) AS history_start
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    LEFT JOIN categories pc ON pc.id = c.parent_id
    LEFT JOIN LATERAL (
      SELECT count(*)::int AS offers, count(DISTINCT o.retailer_id)::int AS stores,
             COALESCE(sum(s.price_changes_60d), 0)::int AS changes
      FROM offers o
      JOIN retailers r ON r.id = o.retailer_id
      LEFT JOIN offer_price_stats s ON s.offer_id = o.id
      WHERE o.product_id = p.id AND ${ALERT_OFFER_AVAILABLE_SQL}
    ) av ON true
  `)

  const now = new Date()
  const decisions = new Map<string, { oldOk: boolean; newOk: boolean; reasons: ProductNoindexReason[]; root: string }>()
  for (const r of rows) {
    const d = productIndexDecision({
      availableOffers: r.available_offers,
      historyStart: r.history_start,
      categoryId: r.category_id,
      categorySlug: r.category_slug,
      categoryVisible: r.category_visible,
      parentSlug: r.parent_slug,
      parentVisible: r.parent_visible,
      availableStores: r.available_stores,
      priceChanges60d: r.price_changes_60d,
    }, now)
    decisions.set(r.id, { oldOk: oldIndexable(d), newOk: d.indexable, reasons: d.reasons, root: r.root_name ?? '(fara categorie)' })
  }

  // Variantele: indexabile pe cont propriu + principala indexabila → canonical spre principala
  // si scoase din sitemap (aceeasi regula ca pagina /p/ si getAllProductSlugs)
  const canonicalized = new Set<string>()
  for (const r of rows) {
    if (!r.canonical_product_id) continue
    const self = decisions.get(r.id)!
    const target = decisions.get(r.canonical_product_id)
    if (self.newOk && target?.newOk) canonicalized.add(r.id)
  }
  const withCanonicalColumn = rows.filter((r) => r.canonical_product_id).length

  const count = (f: (d: { oldOk: boolean; newOk: boolean }, id: string) => boolean) =>
    [...decisions].filter(([id, d]) => f(d, id)).length
  const oldTotal = count((d) => d.oldOk)
  const newTotal = count((d) => d.newOk)
  const finalTotal = count((d, id) => d.newOk && !canonicalized.has(id))

  console.log(`Raport index /p/ — ${now.toISOString()} (doar citire)`)
  console.log(`Produse in DB: ${rows.length}`)
  console.log(`Indexabile, regula veche (1–4):                 ${oldTotal}`)
  console.log(`Indexabile, regula noua (1–5, „are poveste”):   ${newTotal}`)
  console.log(`  din care variante cu canonical spre principala: ${canonicalized.size}  (coloana setata pe ${withCanonicalColumn} produse)`)
  console.log(`In sitemap dupa regula noua + canonical:        ${finalTotal}`)
  console.log(`Pierdute fata de regula veche:                  ${oldTotal - finalTotal}`)

  // Motive: un produs poate avea mai multe; „doar fara-poveste” = exact cele scoase de regula noua
  const reasonCounts = new Map<string, number>()
  let onlyStory = 0
  for (const d of decisions.values()) {
    for (const r of d.reasons) reasonCounts.set(r, (reasonCounts.get(r) ?? 0) + 1)
    if (d.oldOk && !d.newOk) onlyStory++
  }
  console.log('\nMotive de noindex (un produs poate avea mai multe):')
  for (const [r, n] of [...reasonCounts].sort((a, b) => b[1] - a[1])) console.log(`  ${r.padEnd(18)} ${n}`)
  console.log(`  → scoase DOAR de „fara-poveste” (indexabile ieri): ${onlyStory}`)

  // Pe categoria-parinte (radacina arborelui)
  const byRoot = new Map<string, { old: number; neu: number; canon: number; fin: number }>()
  for (const [id, d] of decisions) {
    const b = byRoot.get(d.root) ?? { old: 0, neu: 0, canon: 0, fin: 0 }
    if (d.oldOk) b.old++
    if (d.newOk) b.neu++
    if (canonicalized.has(id)) b.canon++
    if (d.newOk && !canonicalized.has(id)) b.fin++
    byRoot.set(d.root, b)
  }
  console.log('\nPe categoria-parinte:            veche   noua  canonical  sitemap')
  for (const [root, b] of [...byRoot].filter(([, b]) => b.old || b.neu).sort((a, b) => b[1].old - a[1].old)) {
    console.log(`  ${root.slice(0, 30).padEnd(30)} ${String(b.old).padStart(6)} ${String(b.neu).padStart(6)} ${String(b.canon).padStart(10)} ${String(b.fin).padStart(8)}`)
  }
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1 })
  .finally(() => pool.end())
