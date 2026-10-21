import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  addDays, weekStart, monthBounds, previousMonth, parseMonth, median, offerRealDays, streaks,
  productMonthEntry, buildCategoryIndex, eligibleCategories, ancestorChain, productTiming, finalizeWeeks,
  type DayPoint, type ProductSeries, type ProductMonth, type WeekAcc,
} from './price-index.js'

// O serie zilnică: n zile consecutive de la `from`, cu prețul dat de fn(i)
function daily(from: string, n: number, fn: (i: number) => number, inStock = true): DayPoint[] {
  return Array.from({ length: n }, (_, i) => ({ day: addDays(from, i), price: fn(i), inStock }))
}

test('date: zile, săptămâni, luni', () => {
  assert.equal(addDays('2026-02-28', 1), '2026-03-01')
  assert.equal(addDays('2026-10-01', -1), '2026-09-30')
  assert.equal(weekStart('2026-10-21'), '2026-10-19')   // miercuri → luni
  assert.equal(weekStart('2026-10-25'), '2026-10-19')   // duminică → aceeași săptămână
  assert.equal(weekStart('2026-10-19'), '2026-10-19')
  assert.deepEqual(monthBounds('2026-09'), { start: '2026-09-01', end: '2026-10-01', prevStart: '2026-08-01' })
  assert.deepEqual(monthBounds('2026-01'), { start: '2026-01-01', end: '2026-02-01', prevStart: '2025-12-01' })
  assert.deepEqual(monthBounds('2026-12'), { start: '2026-12-01', end: '2027-01-01', prevStart: '2026-11-01' })
  // 1 noiembrie 05:00 ora României = 31 octombrie 03:00 UTC → luna încheiată e octombrie
  assert.equal(previousMonth(new Date('2026-11-01T03:00:00Z')), '2026-10')
  assert.equal(previousMonth(new Date('2026-10-21T12:00:00Z')), '2026-09')
  assert.equal(parseMonth('2026-07'), '2026-07')
  assert.equal(parseMonth('2026-7'), null)
  assert.equal(parseMonth('2026-13'), null)
})

test('median = PERCENTILE_CONT(0.5)', () => {
  assert.equal(median([]), null)
  assert.equal(median([3]), 3)
  assert.equal(median([4, 1, 3]), 3)
  assert.equal(median([1, 2, 3, 10]), 2.5)
})

test('offerRealDays: regula de pe site (< mediana 30 de zile × 0,95, minim 2 puncte)', () => {
  // 20 de zile la 100, apoi 94 (6% sub) și 96 (4% sub)
  const s = [...daily('2026-09-01', 20, () => 100), { day: '2026-09-21', price: 94, inStock: true }, { day: '2026-09-22', price: 96, inStock: true }]
  const real = offerRealDays(s)
  assert.deepEqual([...real], ['2026-09-21'])
  // exact 5% sub (95) NU e reducere reală (strict mai mic, ca în discount.ts)
  assert.equal(offerRealDays([...daily('2026-09-01', 10, () => 100), { day: '2026-09-11', price: 95, inStock: true }]).size, 0)
  // un singur punct în fereastră → fără verdict
  assert.equal(offerRealDays([{ day: '2026-09-01', price: 50, inStock: true }]).size, 0)
  // fără stoc → nu contează ca reducere (dar punctul intră în mediană)
  assert.equal(offerRealDays([...daily('2026-09-01', 10, () => 100), { day: '2026-09-11', price: 50, inStock: false }]).size, 0)
  // fereastra e de 30 de zile: prețurile vechi de 100 ies din fereastră, 90 devine „obișnuit”
  const long = [...daily('2026-06-01', 10, () => 100), ...daily('2026-07-15', 31, () => 90)]
  const r2 = offerRealDays(long)
  assert.ok(!r2.has(addDays('2026-07-15', 30)))
})

test('streaks: zile consecutive', () => {
  assert.deepEqual(streaks(['2026-09-03', '2026-09-01', '2026-09-02', '2026-09-05']), [
    { start: '2026-09-01', length: 3 }, { start: '2026-09-05', length: 1 },
  ])
  assert.deepEqual(streaks([]), [])
})

function product(id: number, offers: { retailerId: number; series: DayPoint[] }[], categoryId = 10): ProductSeries {
  return {
    productId: id, slug: `p-${id}`, name: `Produs ${id}`, categoryId,
    offers: offers.map((o, i) => ({ offerId: id * 10 + i, retailerId: o.retailerId, retailerName: `R${o.retailerId}`, series: o.series })),
  }
}

test('productMonthEntry: minimul pe oferte al medianei lunare în stoc', () => {
  const p = product(1, [
    { retailerId: 1, series: [...daily('2026-08-01', 31, () => 1000), ...daily('2026-09-01', 30, () => 900)] },
    { retailerId: 2, series: [...daily('2026-08-01', 31, () => 950), ...daily('2026-09-01', 30, (i) => (i < 10 ? 2000 : 980))] },
  ])
  const e = productMonthEntry(p, '2026-09')
  assert.equal(e.prev, 950)
  assert.equal(e.cur, 900)
  assert.equal(e.retailerPrices.length, 2)
  // zilele fără stoc nu intră în prețul lunar
  const q = product(2, [{ retailerId: 1, series: [...daily('2026-08-01', 31, () => 100), ...daily('2026-09-01', 30, () => 1, false)] }])
  const eq = productMonthEntry(q, '2026-09')
  assert.equal(eq.prev, 100)
  assert.equal(eq.cur, null)
})

test('buildCategoryIndex: coș stabil, mediana variațiilor, magazinul cel mai ieftin', () => {
  const mk = (id: number, prev: number | null, cur: number | null, prices: [number, number][] = [], real = false): ProductMonth => ({
    productId: id, slug: `p-${id}`, name: `P${id}`, prev, cur, real,
    retailerPrices: prices.map(([r, price]) => ({ retailerId: r, retailerName: `R${r}`, price })),
  })
  const entries = [
    mk(1, 100, 90, [[1, 90], [2, 95]], true),   // −10%
    mk(2, 100, 100, [[1, 100], [2, 110]]),      // 0%
    mk(3, 100, 105, [[2, 105], [1, 120]]),      // +5%
    mk(4, 100, 20, [[1, 20], [2, 30]]),         // −80% → în mediană, dar nu la „scăderi” (implauzibil)
    mk(5, 100, 97, [[1, 97], [2, 99]]),         // −3%
    mk(6, null, 50, [[1, 50]], true),           // nou în luna asta → în afara coșului, dar reducerea contează
    mk(7, 100, null),                           // dispărut → în afara coșului
  ]
  const idx = buildCategoryIndex(entries)
  assert.equal(idx.basketSize, 5)
  assert.equal(idx.medianChangePct, -3)
  assert.equal(idx.shareDownPct, 60)
  assert.equal(idx.realDiscounts, 2)
  assert.equal(idx.retailers, 2)
  assert.equal(idx.comparedProducts, 5)
  assert.deepEqual(idx.cheapest, { retailerId: 1, retailerName: 'R1', wins: 4 })
  assert.deepEqual(idx.topDrops.map((d) => d.product_id), [1, 5])
  // egalitate de „victorii” → niciun magazin numit
  const tie = buildCategoryIndex([
    mk(1, 1, 1, [[1, 1], [2, 2]]), mk(2, 1, 1, [[1, 1], [2, 2]]), mk(3, 1, 1, [[1, 1], [2, 2]]),
    mk(4, 1, 1, [[2, 1], [1, 2]]), mk(5, 1, 1, [[2, 1], [1, 2]]), mk(6, 1, 1, [[2, 1], [1, 2]]),
  ])
  assert.equal(tie.cheapest, null)
  // prea puține produse comparabile
  assert.equal(buildCategoryIndex([mk(1, 1, 1, [[1, 1], [2, 2]])]).cheapest, null)
})

test('eligibleCategories: fără Sănătate & Naturale și farmacie veterinară (cu subcategorii)', () => {
  const cats = [
    { id: 1, slug: 'laptopuri-calculatoare', name: 'L', parent_id: null },
    { id: 2, slug: 'laptopuri', name: 'Laptopuri', parent_id: 1 },
    { id: 3, slug: 'sanatate-naturale', name: 'S', parent_id: null },
    { id: 4, slug: 'suplimente', name: 'Sup', parent_id: 3 },
    { id: 5, slug: 'animale', name: 'A', parent_id: null },
    { id: 6, slug: 'farmacie-veterinara', name: 'F', parent_id: 5 },
    { id: 7, slug: 'castroane', name: 'C', parent_id: 5 },
  ]
  assert.deepEqual([...eligibleCategories(cats).keys()].sort(), [1, 2, 5, 7])
  const byId = new Map(cats.map((c) => [c.id, c]))
  assert.deepEqual(ancestorChain(2, byId), [2, 1])
  // ciclu accidental în DB → nu se blochează
  const cyc = new Map([[1, { id: 1, slug: 'a', name: 'a', parent_id: 2 }], [2, { id: 2, slug: 'b', name: 'b', parent_id: 1 }]])
  assert.deepEqual(ancestorChain(1, cyc), [1, 2])
})

test('productTiming + finalizeWeeks: nivelul față de prețul obișnuit și seriile de reduceri', () => {
  // 3 săptămâni la 100, apoi o săptămână la 90 (luni 2026-09-28 … duminică 2026-10-04)
  const series = [...daily('2026-09-07', 21, () => 100), ...daily('2026-09-28', 7, () => 90)]
  const t = productTiming(product(1, [{ retailerId: 1, series }]), '2026-10-05')
  assert.equal(t.firstDay, '2026-09-07')
  assert.equal(t.weeks.size, 4)
  const last = t.weeks.get('2026-09-28')!
  assert.equal(last.ratio, 0.9)
  assert.equal(last.days, 7)
  // 90 < 100 × 0,95 la început; mediana se apropie de 90 abia după ~3 săptămâni → toate 7 zilele reale
  assert.equal(last.realDays, 7)
  assert.equal(last.streakCount, 1)
  assert.equal(last.streakDays, 7)
  // `until` taie zilele de după; sub 4 săptămâni de date nu avem „preț obișnuit” (ratio null)
  const short = productTiming(product(1, [{ retailerId: 1, series }]), '2026-09-28')
  assert.equal(short.weeks.size, 3)
  assert.equal(short.weeks.get('2026-09-21')!.ratio, null)

  const acc = new Map<string, WeekAcc>([
    ['2026-09-28', { products: 4, ratios: [0.9, 1, 1.1], productDays: 21, realDays: 7, streakCount: 2, streakDays: 9 }],
    ['2026-09-21', { products: 1, ratios: [1], productDays: 7, realDays: 0, streakCount: 0, streakDays: 0 }],
  ])
  assert.deepEqual(finalizeWeeks(acc), [
    { week: '2026-09-21', products: 1, basketMedian: 100, realDiscountShare: 0, avgRealStreakDays: null, realStreaks: 0, productDays: 7, realDays: 0 },
    { week: '2026-09-28', products: 4, basketMedian: 100, realDiscountShare: 33.33, avgRealStreakDays: 4.5, realStreaks: 2, productDays: 21, realDays: 7 },
  ])
})
