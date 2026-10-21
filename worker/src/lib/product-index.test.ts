// Paritate: regula de indexare /p/ din worker (lib/product-index.ts, folosita de seo:index-report)
// trebuie sa dea aceleasi decizii ca web/src/lib/seo/product-index.ts. Rulare: cd worker && npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as worker from './product-index.js'

const webPath = new URL('../../../web/src/lib/seo/product-index.ts', import.meta.url).href
const web = await import(webPath) as typeof worker

const NOW = new Date('2026-10-21T12:00:00Z')
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString()

test('product-index: aceleasi praguri ca in web', () => {
  assert.equal(worker.PRODUCT_INDEX_MIN_HISTORY_DAYS, web.PRODUCT_INDEX_MIN_HISTORY_DAYS)
  assert.equal(worker.PRODUCT_INDEX_MIN_STORES, web.PRODUCT_INDEX_MIN_STORES)
  assert.equal(worker.PRODUCT_INDEX_MIN_PRICE_CHANGES, web.PRODUCT_INDEX_MIN_PRICE_CHANGES)
  assert.deepEqual(worker.NOINDEX_PRODUCT_ROOTS, web.NOINDEX_PRODUCT_ROOTS)
})

test('product-index: aceleasi decizii ca in web pe o grila de cazuri', () => {
  let n = 0
  for (const availableOffers of [0, 1, 3])
    for (const historyStart of [null, daysAgo(5), daysAgo(30), daysAgo(90)])
      for (const cat of [
        { categoryId: null, categorySlug: null, categoryVisible: null, parentSlug: null, parentVisible: null },
        { categoryId: 1, categorySlug: 'laptopuri', categoryVisible: true, parentSlug: 'laptopuri-calculatoare', parentVisible: true },
        { categoryId: 2, categorySlug: 'tv-audio', categoryVisible: true, parentSlug: null, parentVisible: null },
        { categoryId: 3, categorySlug: 'laptopuri', categoryVisible: false, parentSlug: 'laptopuri-calculatoare', parentVisible: true },
        { categoryId: 4, categorySlug: 'suplimente', categoryVisible: true, parentSlug: 'sanatate-naturale', parentVisible: false },
      ])
        for (const availableStores of [0, 1, 2, 4])
          for (const priceChanges60d of [0, 2, 3, 9]) {
            const input = { availableOffers, historyStart, ...cat, availableStores, priceChanges60d }
            assert.deepEqual(worker.productIndexDecision(input, NOW), web.productIndexDecision(input, NOW), JSON.stringify(input))
            n++
          }
  assert.ok(n > 900)
})

test('product-index: regula veche (1–4) ignora doar „fara-poveste”', () => {
  const base = {
    availableOffers: 1, historyStart: daysAgo(60), categoryId: 1, categorySlug: 'laptopuri', categoryVisible: true,
    parentSlug: 'laptopuri-calculatoare', parentVisible: true, availableStores: 1, priceChanges60d: 0,
  }
  const d = worker.productIndexDecision(base, NOW)
  assert.deepEqual(d.reasons, ['fara-poveste'])
  assert.equal(worker.oldIndexable(d), true)
  assert.equal(worker.oldIndexable(worker.productIndexDecision({ ...base, historyStart: daysAgo(3) }, NOW)), false)
})
