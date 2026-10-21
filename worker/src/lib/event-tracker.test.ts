// Teste pentru trackerul de evenimente (lib/event-tracker.ts) — doar funcțiile pure, fără DB.
// Rulare: cd worker && npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  classifyOffer, eventPhase, bucharestDay, median, pickProductOffers, aggregateStats, classifyAll,
  TOTAL_CATEGORY_ID, type CategoryNode, type TrackedOffer,
} from './event-tracker.js'

test('classifyOffer: reducere reală (preț ≤ referință × 0,95)', () => {
  // max 14 zile 1000, azi 900 (−10% față de max), referința 1000 → redusă și reală
  assert.deepEqual(classifyOffer(900, 1000, 1000), { reduced: true, real: true, inflated: false })
  // exact la prag: 950 = 1000 × 0,95 → reală (≤, nu <)
  assert.equal(classifyOffer(950, 1000, 1000).real, true)
  assert.equal(classifyOffer(950.01, 1000, 1000).real, false)
})

test('classifyOffer: umflată = redusă, nereală, max 14 zile ≥ referință × 1,10', () => {
  // referința 1000, prețul a urcat la 1200, „reducerea” la 1050: −12,5% față de max, dar peste referință
  assert.deepEqual(classifyOffer(1050, 1200, 1000), { reduced: true, real: false, inflated: true })
  // urcare de exact 10% → umflată
  assert.equal(classifyOffer(1000, 1100, 1000).inflated, true)
  // urcare de doar 9% → redusă, nereală, dar NU umflată
  assert.deepEqual(classifyOffer(1000, 1090, 1000), { reduced: true, real: false, inflated: false })
  // reală nu e niciodată umflată, chiar dacă a urcat înainte
  assert.deepEqual(classifyOffer(900, 1300, 1000), { reduced: true, real: true, inflated: false })
})

test('classifyOffer: nereducată (sub 5% față de maxim)', () => {
  assert.deepEqual(classifyOffer(980, 1000, 1000), { reduced: false, real: false, inflated: false })
  // preț stabil sub referință: reală, dar nu „redusă” (nu e o scădere recentă)
  assert.deepEqual(classifyOffer(800, 800, 1000), { reduced: false, real: true, inflated: false })
  // maximul din istoric mai mic decât prețul de azi (scumpire azi) → maximul = prețul de azi
  assert.deepEqual(classifyOffer(1100, 1000, 1000), { reduced: false, real: false, inflated: false })
})

test('eventPhase: before / live / after, ends_at exclusiv', () => {
  const e = {
    freeze_at: new Date('2026-10-31T22:00:00Z'),
    starts_at: new Date('2026-10-31T22:00:00Z'),
    ends_at: new Date('2026-12-02T22:00:00Z'),
  }
  assert.equal(eventPhase(e, new Date('2026-10-31T21:59:59Z')), 'before')
  assert.equal(eventPhase(e, new Date('2026-10-31T22:00:00Z')), 'live')
  assert.equal(eventPhase(e, new Date('2026-12-02T21:59:59Z')), 'live')
  assert.equal(eventPhase(e, new Date('2026-12-02T22:00:00Z')), 'after')
})

test('bucharestDay: ziua din România, nu UTC', () => {
  assert.equal(bucharestDay(new Date('2026-10-31T22:30:00Z')), '2026-11-01')
  assert.equal(bucharestDay(new Date('2026-11-01T21:59:00Z')), '2026-11-01')
})

test('median', () => {
  assert.equal(median([]), null)
  assert.equal(median([3, 1, 2]), 2)
  assert.equal(median([4, 1, 3, 2]), 2.5)
})

test('pickProductOffers: cea mai ieftină ofertă per produs, egalitate → id mic', () => {
  const picked = pickProductOffers([
    { productId: '1', offerId: '11', price: 100 },
    { productId: '1', offerId: '10', price: 100 },
    { productId: '1', offerId: '12', price: 90 },
    { productId: '2', offerId: '9', price: 50 },
    { productId: '2', offerId: '8', price: 50 },
  ])
  assert.deepEqual(picked.map((o) => o.offerId).sort(), ['12', '8'])
})

test('aggregateStats: total + părinte + subcategorie, produs numărat o dată, magazine distincte', () => {
  const cats = new Map<number, CategoryNode>([
    [1, { id: 1, slug: 'telefoane-accesorii', name: 'Telefoane & Accesorii', parentId: null }],
    [2, { id: 2, slug: 'telefoane-mobile', name: 'Telefoane Mobile', parentId: 1 }],
    [3, { id: 3, slug: 'tv-audio', name: 'TV & Audio', parentId: null }],
  ])
  const o = (offerId: string, productId: string, retailerId: number, categoryId: number, price: number, max14d: number, reference: number): TrackedOffer =>
    ({ offerId, productId, retailerId, categoryId, price, max14d, reference })
  const offers = classifyAll([
    // produsul A: 2 magazine; cea mai ieftină ofertă (900 vs ref 1000) e reală
    o('1', 'A', 10, 2, 900, 1000, 1000),
    o('2', 'A', 11, 2, 1050, 1200, 1000),
    // produsul B: umflat (urcat la 1200, „redus” la 1100, referința 1000)
    o('3', 'B', 10, 2, 1100, 1200, 1000),
    // produsul C (direct pe părinte): nereducat
    o('4', 'C', 12, 1, 500, 500, 500),
    // produsul D (TV): redus și real, −20% față de referință
    o('5', 'D', 10, 3, 800, 1000, 1000),
    // categorie necunoscută (exclusă) → ignorat
    o('6', 'E', 13, 99, 10, 100, 100),
  ])
  const rows = aggregateStats(offers, cats)
  const by = new Map(rows.map((r) => [r.categoryId, r]))

  const total = by.get(TOTAL_CATEGORY_ID)!
  assert.equal(total.level, 'total')
  assert.equal(total.tracked, 4)
  assert.equal(total.reduse, 3)          // A, B, D
  assert.equal(total.reale, 2)           // A, D
  assert.equal(total.reduseReale, 2)
  assert.equal(total.umflate, 1)         // B
  assert.equal(total.stores, 3)          // 10, 11, 12 (13 e exclus)
  assert.equal(total.realDiscountMedianPct, 15)   // mediana(10%, 20%)

  const phones = by.get(1)!
  assert.equal(phones.level, 'root')
  assert.equal(phones.tracked, 3)        // A, B, C
  assert.equal(phones.umflate, 1)
  const mobile = by.get(2)!
  assert.equal(mobile.level, 'sub')
  assert.equal(mobile.parentId, 1)
  assert.equal(mobile.tracked, 2)
  assert.equal(mobile.stores, 2)
  assert.equal(mobile.realDiscountMedianPct, 10)
  assert.equal(by.get(3)!.reduseReale, 1)
  assert.equal(by.has(99), false)
})
