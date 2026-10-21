// Teste pentru partea pură a trackerului de evenimente (lib/event-tracker.ts) + JSON-LD-ul nou
// (Dataset, FAQPage) și rândul „umflat” din „Pe scurt despre preț”. Rulare: cd web && npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  eventPhase, referenceMonth, headlineSentence, share, chartPoints, latestDay, tableRows, inflationPct,
  inflationFact, inflationSentence, eventFaq, isEventExcluded, lastEventDay, SUB_MIN_TRACKED,
  type DailyStat, type OfferEventStatus,
} from './event-tracker'
import { datasetLd, faqPageLd, ldScript } from './seo/jsonld'
import { priceFactRows, factText } from './seo/product-facts'
import { formatRoDate } from './seo/site'

const BF = {
  slug: 'black-friday-2026',
  name: 'Black Friday 2026',
  freeze_at: '2026-10-31T22:00:00.000Z',     // 1 nov. 2026, 00:00 ora României
  starts_at: '2026-10-31T22:00:00.000Z',
  ends_at: '2026-12-02T22:00:00.000Z',       // exclusiv → ultima zi 2 dec.
  reference_computed_at: null,
}

function stat(p: Partial<DailyStat>): DailyStat {
  return {
    day: '2026-11-27', category_id: 0, level: 'total', parent_id: null, category_slug: 'toate',
    category_name: 'Toate categoriile', tracked: 0, reduse: 0, reale: 0, reduse_reale: 0, umflate: 0,
    real_discount_median_pct: null, stores: 0, computed_at: '2026-11-27T05:00:00Z', ...p,
  }
}

test('eventPhase + ultima zi + luna referinței', () => {
  assert.equal(eventPhase(BF, new Date('2026-10-21T12:00:00Z')), 'before')
  assert.equal(eventPhase(BF, new Date('2026-11-01T08:00:00Z')), 'live')
  assert.equal(eventPhase(BF, new Date('2026-12-02T21:00:00Z')), 'live')
  assert.equal(eventPhase(BF, new Date('2026-12-03T08:00:00Z')), 'after')
  assert.equal(formatRoDate(lastEventDay(BF)), '2 decembrie 2026')
  assert.equal(formatRoDate(BF.freeze_at), '1 noiembrie 2026')
  assert.equal(referenceMonth(BF), 'octombrie')
})

test('headlineSentence: datată, cu N, procent din reduse, fără promisiuni', () => {
  const s = headlineSentence(stat({ tracked: 9876, reduse: 1204, reduse_reale: 458, stores: 9 }), BF)
  assert.equal(s, 'Pe 27 noiembrie 2026, 38% din cele 1.204 produse reduse aveau o reducere reală: preț cu cel puțin 5% sub mediana lor din octombrie. Am urmărit 9.876 de produse în 9 magazine.')
  assert.doesNotMatch(s, /garantat|economisești|cel mai mic preț/i)
  const none = headlineSentence(stat({ tracked: 50, reduse: 0, stores: 3 }), BF)
  assert.equal(none, 'Pe 27 noiembrie 2026, niciun produs urmărit nu era redus față de prețul lui maxim din ultimele 14 zile. Am urmărit 50 de produse în 3 magazine.')
  const one = headlineSentence(stat({ tracked: 5, reduse: 1, reduse_reale: 1, stores: 1 }), BF)
  assert.match(one, /un singur produs urmărit era redus, iar reducerea lui era reală/)
})

test('share, chartPoints (doar total, ordonat, fără zile fără reduceri), latestDay', () => {
  assert.equal(share(1, 3), 33)
  assert.equal(share(1, 0), null)
  const stats = [
    stat({ day: '2026-11-03', reduse: 10, reduse_reale: 5 }),
    stat({ day: '2026-11-01', reduse: 4, reduse_reale: 1 }),
    stat({ day: '2026-11-02', reduse: 0 }),
    stat({ day: '2026-11-03', category_id: 26, level: 'root', reduse: 3, reduse_reale: 3 }),
  ]
  assert.deepEqual(chartPoints(stats), [
    { day: '2026-11-01', pct: 25, reduse: 4 },
    { day: '2026-11-03', pct: 50, reduse: 10 },
  ])
  assert.equal(latestDay(stats), '2026-11-03')
  assert.equal(latestDay([]), null)
})

test('tableRows: părinți după volum, subcategorii doar cu volum și diferite de părinte', () => {
  const day = '2026-11-27'
  const stats = [
    stat({}),
    stat({ category_id: 26, level: 'root', category_slug: 'telefoane-accesorii', tracked: 100, reduse: 20 }),
    stat({ category_id: 6, level: 'sub', parent_id: 26, tracked: 100, reduse: 20 }),            // = părintele → ascunsă
    stat({ category_id: 28, level: 'root', category_slug: 'tv-audio', tracked: 300, reduse: 40 }),
    stat({ category_id: 24, level: 'sub', parent_id: 28, tracked: 250, reduse: 30 }),
    stat({ category_id: 25, level: 'sub', parent_id: 28, tracked: SUB_MIN_TRACKED - 1, reduse: 10 }), // prea mică
    stat({ day: '2026-11-26', category_id: 27, level: 'root', tracked: 999 }),                    // altă zi
  ]
  const { total, rows } = tableRows(stats, day)
  assert.equal(total?.category_id, 0)
  assert.deepEqual(rows.map((r) => [r.category_id, r.indent]), [[28, false], [24, true], [26, false]])
})

test('inflationFact: doar în fereastră, calcul proaspăt, același preț, ≥ 10%', () => {
  const s: OfferEventStatus = {
    event_slug: 'black-friday-2026', starts_at: BF.starts_at, ends_at: BF.ends_at, freeze_at: BF.freeze_at,
    day: '2026-11-27', price: 1050, max_14d: 1189, reference_median: 1000, inflated: true,
  }
  const now = new Date('2026-11-27T10:00:00Z')
  assert.deepEqual(inflationFact(s, 1050, '2026-11-27', now), { pct: 18, month: 'octombrie' })
  assert.deepEqual(inflationFact(s, 1050, '2026-11-28', new Date('2026-11-28T10:00:00Z')), { pct: 18, month: 'octombrie' }) // de ieri
  assert.equal(inflationFact(s, 1050, '2026-11-29', new Date('2026-11-29T10:00:00Z')), null)   // calcul vechi
  assert.equal(inflationFact(s, 1049, '2026-11-27', now), null)                                // prețul s-a schimbat
  assert.equal(inflationFact({ ...s, inflated: false }, 1050, '2026-11-27', now), null)
  assert.equal(inflationFact(s, 1050, '2026-12-05', new Date('2026-12-05T10:00:00Z')), null)   // după fereastră
  assert.equal(inflationFact(null, 1050, '2026-11-27', now), null)
  assert.equal(inflationPct(1100, 1000), 10)
  assert.equal(inflationPct(1099.99, 1000), 9)      // rotunjit în jos: nu exagerăm
  assert.equal(inflationPct(1000, 0), null)
  assert.equal(
    inflationSentence({ pct: 18, month: 'octombrie' }, false),
    'În cele 14 zile dinaintea reducerii, prețul a urcat cu 18% peste mediana din octombrie.',
  )
  assert.match(inflationSentence({ pct: 18, month: 'octombrie' }, true), /^La oferta cea mai ieftină: în cele 14 zile/)
})

test('priceFactRows: rândul din tracker apare doar când e dat, după poziția prețului', () => {
  const base = {
    series: [{ day: '2026-11-20', price: 1200 }, { day: '2026-11-27', price: 1050 }],
    todayPrice: 1050, offerPrices: [1050], now: new Date('2026-11-27T10:00:00Z'),
    trackedSince: '2026-06-01T10:00:00Z',
  }
  const without = priceFactRows(base)
  const withRow = priceFactRows({ ...base, eventInflation: 'În cele 14 zile dinaintea reducerii, prețul a urcat cu 18% peste mediana din octombrie.' })
  assert.equal(withRow.length, without.length + 1)
  assert.equal(factText(withRow[1]), 'În cele 14 zile dinaintea reducerii, prețul a urcat cu 18% peste mediana din octombrie.')
})

test('excluderi: Sănătate & Naturale (cu subcategorii) și farmacie-veterinara', () => {
  assert.equal(isEventExcluded('sanatate-naturale', null), true)
  assert.equal(isEventExcluded('vitamine', 'sanatate-naturale'), true)
  assert.equal(isEventExcluded('farmacie-veterinara', 'animale-de-companie'), true)
  assert.equal(isEventExcluded('laptopuri', 'laptopuri-calculatoare'), false)
})

test('JSON-LD: FAQPage și Dataset parsabile, fără /go/', () => {
  const faq = eventFaq(BF)
  assert.ok(faq.length >= 4)
  const f = JSON.parse(ldScript(faqPageLd(faq)))
  assert.equal(f['@type'], 'FAQPage')
  assert.equal(f.mainEntity.length, faq.length)
  assert.equal(faqPageLd([{ q: ' ', a: 'x' }]), null)
  for (const item of faq) assert.doesNotMatch(item.a, /garantat|economisești|\d+ lei/i)

  const d = JSON.parse(ldScript(datasetLd({
    name: 'Black Friday 2026', description: 'x', path: '/black-friday-2026',
    temporalCoverage: '2026-11-01/2026-11-27', dateModified: '2026-11-27T05:00:00.000Z', variableMeasured: ['a'],
  })))
  assert.equal(d['@type'], 'Dataset')
  assert.match(d.url, /\/black-friday-2026$/)
  assert.equal(d.temporalCoverage, '2026-11-01/2026-11-27')
  assert.doesNotMatch(JSON.stringify(d), /\/go\//)
})
