import { test } from 'node:test'
import assert from 'node:assert/strict'
import { listingView, otherStoresText, storesText } from './listing-product'

test('lista: verdictul din pret + mediana (aceleasi praguri ca /p/)', () => {
  assert.equal(listingView({ current_price: 940, median_price: 1000 }).info.verdict, 'real')
  assert.equal(listingView({ current_price: 950, median_price: 1000 }).info.verdict, 'normal')   // exact 5% → nu
  assert.equal(listingView({ current_price: 1100, median_price: 1000 }).info.verdict, 'higher')
  assert.equal(listingView({ current_price: 1000, median_price: null }).info.verdict, 'no-data')
})

test('lista: mediana formatata (intreg sau exact 2 zecimale)', () => {
  assert.equal(listingView({ current_price: 1, median_price: 1469 }).median, '1.469')
  assert.equal(listingView({ current_price: 1, median_price: 3755.2 }).median, '3.755,20')
  assert.equal(listingView({ current_price: 1, median_price: null }).median, null)
})

test('lista: mini-termometrul doar cu min, max, mediana si pret', () => {
  assert.equal(listingView({ current_price: 900, median_price: 1000 }).thermo, null)
  assert.equal(listingView({ current_price: 900, median_price: 1000, min_30d: null, max_30d: 1100 }).thermo, null)
  const t = listingView({ current_price: 900, median_price: 1000, min_30d: 880, max_30d: 1100 }).thermo
  assert.ok(t)
  assert.ok(t.today < t.median, 'pretul sub mediana sta in stanga liniutei')
  assert.ok(t.realEnd < t.median)
  for (const v of [t.today, t.median, t.realEnd]) assert.ok(v >= 0 && v <= 100)
})

test('lista: magazinele', () => {
  assert.equal(otherStoresText(null), null)
  assert.equal(otherStoresText(1), null)
  assert.equal(otherStoresText(2), 'încă un magazin')
  assert.equal(otherStoresText(4), 'încă 3 magazine')
  assert.equal(otherStoresText(21), 'încă 20 de magazine')
  assert.equal(storesText(1), null)
  assert.equal(storesText(3), '3 magazine')
  assert.equal(listingView({ current_price: 1, median_price: 1, store_count: 0 }).stores, null)
})
