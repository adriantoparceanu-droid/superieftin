// Teste pentru regula de indexare a paginilor de produs (lib/seo/product-index.ts, decizia
// SEO din 5 oct. 2026). Rulare: cd web && npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  productIndexDecision, hasHistoryDays, hasStory, PRODUCT_INDEX_MIN_HISTORY_DAYS, PRODUCT_INDEXABLE_SQL,
  PRODUCT_INDEX_MIN_STORES, PRODUCT_INDEX_MIN_PRICE_CHANGES, CANONICAL_TARGET_INDEXABLE_SQL,
  type ProductIndexInput,
} from './product-index'

const NOW = new Date('2026-10-05T12:00:00Z')
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString()

// Produs „bun”: oferta disponibila, urmarit de 60 de zile, subcategorie vizibila sub parinte vizibil
const ok: ProductIndexInput = {
  availableOffers: 2,
  historyStart: daysAgo(60),
  categoryId: 7,
  categorySlug: 'laptopuri',
  categoryVisible: true,
  parentSlug: 'laptopuri-calculatoare',
  parentVisible: true,
  availableStores: 2,
  priceChanges60d: 0,
}

test('produs-index: toate conditiile → indexabil, fara motive', () => {
  assert.deepEqual(productIndexDecision(ok, NOW), { indexable: true, reasons: [] })
})

test('produs-index: 1. fara oferta disponibila → noindex', () => {
  // Fara oferta nu adaugam si 'fara-poveste' (motivul real e lipsa ofertei)
  assert.deepEqual(productIndexDecision({ ...ok, availableOffers: 0, availableStores: 0 }, NOW), { indexable: false, reasons: ['fara-oferta'] })
})

test('produs-index: 2. istoric sub 30 de zile → noindex; exact 30 de zile → indexabil', () => {
  assert.deepEqual(productIndexDecision({ ...ok, historyStart: daysAgo(2) }, NOW).reasons, ['istoric-scurt'])
  assert.deepEqual(productIndexDecision({ ...ok, historyStart: daysAgo(29.9) }, NOW).reasons, ['istoric-scurt'])
  assert.equal(productIndexDecision({ ...ok, historyStart: daysAgo(30) }, NOW).indexable, true)
  assert.equal(PRODUCT_INDEX_MIN_HISTORY_DAYS, 30)
})

test('produs-index: 2. fara istoric sau data invalida → noindex', () => {
  assert.deepEqual(productIndexDecision({ ...ok, historyStart: null }, NOW).reasons, ['istoric-scurt'])
  assert.equal(hasHistoryDays('nu-e-data', NOW), false)
  // Accepta si Date, si textul din Postgres (::text)
  assert.equal(hasHistoryDays(new Date(daysAgo(45)), NOW), true)
  assert.equal(hasHistoryDays('2026-08-01 10:00:00+03', NOW), true)
})

test('produs-index: 3. nemapat (fara categorie) → noindex', () => {
  const d = productIndexDecision({ ...ok, categoryId: null, categorySlug: null, categoryVisible: null, parentSlug: null, parentVisible: null }, NOW)
  assert.deepEqual(d, { indexable: false, reasons: ['fara-categorie'] })
})

test('produs-index: 3. categorie ascunsa sau parinte ascuns → noindex', () => {
  assert.deepEqual(productIndexDecision({ ...ok, categoryVisible: false }, NOW).reasons, ['categorie-ascunsa'])
  assert.deepEqual(productIndexDecision({ ...ok, parentVisible: false }, NOW).reasons, ['categorie-ascunsa'])
})

test('produs-index: 3. categorie radacina vizibila (fara parinte) → indexabil', () => {
  const root = { ...ok, categorySlug: 'tv-audio', parentSlug: null, parentVisible: null }
  assert.equal(productIndexDecision(root, NOW).indexable, true)
})

test('produs-index: 4. Sanatate & Naturale (radacina sau subcategorie) → noindex', () => {
  assert.deepEqual(productIndexDecision({ ...ok, categorySlug: 'sanatate-naturale', parentSlug: null, parentVisible: null }, NOW).reasons, ['sanatate'])
  assert.deepEqual(productIndexDecision({ ...ok, categorySlug: 'suplimente-alimentare', parentSlug: 'sanatate-naturale' }, NOW).reasons, ['sanatate'])
})

test('produs-index: combinatii → toate motivele, in ordine', () => {
  const d = productIndexDecision({
    ...ok, availableOffers: 0, availableStores: 0, historyStart: daysAgo(3),
    categorySlug: 'ceaiuri-infuzii', parentSlug: 'sanatate-naturale', parentVisible: false,
  }, NOW)
  assert.deepEqual(d, { indexable: false, reasons: ['fara-oferta', 'istoric-scurt', 'categorie-ascunsa', 'sanatate'] })
  // Produs nou si nemapat (ex. Petmart nou fara mapare)
  assert.deepEqual(
    productIndexDecision({ ...ok, historyStart: daysAgo(1), categoryId: null, categorySlug: null }, NOW).reasons,
    ['istoric-scurt', 'fara-categorie'],
  )
})

test('produs-index: 5. „are poveste” — 2 magazine SAU 3 schimbari de pret pe 60 de zile', () => {
  assert.equal(PRODUCT_INDEX_MIN_STORES, 2)
  assert.equal(PRODUCT_INDEX_MIN_PRICE_CHANGES, 3)
  // un singur magazin, pret neschimbat → noindex cu motivul nou
  assert.deepEqual(productIndexDecision({ ...ok, availableStores: 1, priceChanges60d: 0 }, NOW), { indexable: false, reasons: ['fara-poveste'] })
  assert.deepEqual(productIndexDecision({ ...ok, availableStores: 1, priceChanges60d: 2 }, NOW).reasons, ['fara-poveste'])
  // un singur magazin, dar pretul s-a miscat de 3 ori → indexabil
  assert.equal(productIndexDecision({ ...ok, availableStores: 1, priceChanges60d: 3 }, NOW).indexable, true)
  // doua magazine, pret neschimbat → indexabil
  assert.equal(productIndexDecision({ ...ok, availableStores: 2, priceChanges60d: 0 }, NOW).indexable, true)
  assert.equal(hasStory(0, 0), false)
  assert.equal(hasStory(3, 0), true)
  assert.equal(hasStory(1, 10), true)
})

test('produs-index: 5. „fara-poveste” se cumuleaza cu celelalte motive, la final', () => {
  const d = productIndexDecision({ ...ok, historyStart: daysAgo(5), availableStores: 1, priceChanges60d: 1 }, NOW)
  assert.deepEqual(d.reasons, ['istoric-scurt', 'fara-poveste'])
})

test('produs-index: varianta SQL contine aceleasi conditii (sitemap)', () => {
  assert.match(PRODUCT_INDEXABLE_SQL, /c\.is_visible/)
  assert.match(PRODUCT_INDEXABLE_SQL, /pc\.id IS NULL OR pc\.is_visible/)
  assert.match(PRODUCT_INDEXABLE_SQL, /'sanatate-naturale'/)
  assert.match(PRODUCT_INDEXABLE_SQL, /first_recorded_at/)
  assert.match(PRODUCT_INDEXABLE_SQL, /INTERVAL '30 days'/)
  assert.doesNotMatch(PRODUCT_INDEXABLE_SQL, /price_history/)   // regula CPU: fara agregare pe istoric
  // conditia 5: magazine distincte + suma schimbarilor, doar pe ofertele disponibile
  assert.match(PRODUCT_INDEXABLE_SQL, /count\(DISTINCT o\.retailer_id\) >= 2/)
  assert.match(PRODUCT_INDEXABLE_SQL, /sum\(s5\.price_changes_60d\), 0\) >= 3/)
  assert.match(PRODUCT_INDEXABLE_SQL, /o\.in_stock = true/)
})

test('produs-index: canonical spre principala doar daca principala e indexabila (SQL)', () => {
  assert.match(CANONICAL_TARGET_INDEXABLE_SQL, /p\.canonical_product_id IS NOT NULL/)
  // aceeasi regula aplicata pe alias-urile principalei
  assert.match(CANONICAL_TARGET_INDEXABLE_SQL, /cc\.is_visible AND \(cpc\.id IS NULL OR cpc\.is_visible\)/)
  assert.match(CANONICAL_TARGET_INDEXABLE_SQL, /o2\.product_id = cp\.id/)
  assert.match(CANONICAL_TARGET_INDEXABLE_SQL, /o\.product_id = cp\.id AND \(o\.in_stock = true/)
  assert.doesNotMatch(CANONICAL_TARGET_INDEXABLE_SQL, /price_history/)
})
