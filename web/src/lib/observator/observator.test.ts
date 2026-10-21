// Teste pentru textele și regulile observatorului (/indice, /cand-sa-cumperi). Rulare: cd web && npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  parseMonthParam, monthSlug, monthLabel, previousMonthOf, signedPct, plainPct, changeVerb, editionFact,
  groupIndexRows, cheapestText, timingEligible, timingSummary, topRealWeeks, lowestLevelWeeks, weekLabel,
  trackedSincePhrase, seasonalityAllowed, timingFact, datasetLd, faqPageLd,
  type Edition, type IndexRow, type TimingWeek,
} from './observator'
import { buildLlmsTxt } from '../seo/llms'
import { SITE_URL } from '../seo/site'

test('luni: parametrul din URL, etichete, luna anterioară', () => {
  assert.equal(parseMonthParam('2026-09'), '2026-09-01')
  assert.equal(parseMonthParam('2026-9'), null)
  assert.equal(parseMonthParam('2026-13'), null)
  assert.equal(parseMonthParam('2026-09-01'), null)
  assert.equal(parseMonthParam('../x'), null)
  assert.equal(monthSlug('2026-09-01'), '2026-09')
  assert.equal(monthLabel('2026-09-01'), 'septembrie 2026')
  assert.equal(previousMonthOf('2026-01-01'), '2025-12-01')
  assert.equal(previousMonthOf('2026-10-01'), '2026-09-01')
})

test('procente și verbe', () => {
  assert.equal(signedPct(-3.24), '−3,2%')
  assert.equal(signedPct(0.66), '+0,7%')
  assert.equal(signedPct(0.01), '0%')
  assert.equal(signedPct(null), '—')
  assert.equal(plainPct(33.33), '33,3%')
  assert.equal(changeVerb(-3.24), 'a scăzut cu 3,2%')
  assert.equal(changeVerb(1.1), 'a crescut cu 1,1%')
  assert.equal(changeVerb(0.02), 'a rămas neschimbat')
  assert.equal(changeVerb(0, 'f'), 'a rămas neschimbată')
})

const edition: Edition = {
  month: '2026-09-01', basket_size: 506, median_change_pct: -1.25, categories: 6, retailers: 1,
  real_discounts: 59, retroactive: true, correction_note: null, computed_at: '2026-10-21T19:48:07.000Z',
}

test('editionFact: frază datată, cu N, sursă, fără promisiuni', () => {
  const f = editionFact(edition)
  assert.match(f, /^În septembrie 2026, prețul tipic al celor 506 produse din coșul stabil \(6 categorii, 1 magazin\) a scăzut cu 1,3% față de august 2026/)
  assert.match(f, /retroactiv pe 21 octombrie 2026/)
  assert.match(f, /superieftin\.ro/)
  assert.doesNotMatch(f, /va |garant|economis/i)
  assert.match(editionFact({ ...edition, retroactive: false, basket_size: 120 }), /celor 120 de produse.*făcut pe 21 octombrie/)
})

const row = (slug: string, parent: string | null, basket: number, extra: Partial<IndexRow> = {}): IndexRow => ({
  category_slug: slug, category_name: slug, parent_slug: parent, basket_size: basket, median_change_pct: 0,
  share_down_pct: 0, real_discounts: 0, retailers: 1, cheapest_retailer_name: null, cheapest_wins: null,
  compared_products: null, top_drops: [], ...extra,
})

test('groupIndexRows: părinte cu o singură subcategorie identică apare o dată', () => {
  const g = groupIndexRows([
    row('laptopuri-calculatoare', null, 95), row('laptopuri', 'laptopuri-calculatoare', 95),
    row('tv-audio', null, 300), row('televizoare', 'tv-audio', 200), row('boxe', 'tv-audio', 100),
    row('orfan', 'parinte-lipsa', 40),
  ])
  assert.deepEqual(g.map((x) => [x.root.category_slug, x.children.map((c) => c.category_slug)]), [
    ['tv-audio', ['televizoare', 'boxe']],
    ['laptopuri', []],
    ['orfan', []],
  ])
})

test('cheapestText', () => {
  assert.equal(cheapestText(row('a', null, 50)), null)
  assert.equal(cheapestText(row('a', null, 50, { cheapest_retailer_name: 'evomag', cheapest_wins: 41, compared_products: 60 })),
    'evomag: cel mai mic preț lunar la 41 din 60 de produse comparabile')
})

const week = (w: string, products: number, extra: Partial<TimingWeek> = {}): TimingWeek => ({
  week: w, products, basket_median: 100, real_discount_share: 0, product_days: products * 7, real_days: 0,
  avg_real_streak_days: null, real_streaks: 0, ...extra,
})

test('timingEligible: ≥ 50 de produse în ultima săptămână și ≥ 4 săptămâni cu ≥ 50', () => {
  const ok = [week('2026-09-07', 60), week('2026-09-14', 70), week('2026-09-21', 20), week('2026-09-28', 55), week('2026-10-05', 80)]
  assert.equal(timingEligible(ok), true)
  assert.equal(timingEligible(ok.slice(0, 4).concat(week('2026-10-05', 49))), false)  // ultima săptămână prea mică
  assert.equal(timingEligible([week('2026-09-28', 500), week('2026-10-05', 500)]), false) // prea puține săptămâni
  assert.equal(timingEligible([]), false)
})

test('timingSummary + topuri', () => {
  const weeks = [
    week('2026-09-07', 100, { product_days: 700, real_days: 70, real_discount_share: 10, real_streaks: 10, avg_real_streak_days: 2, basket_median: 98 }),
    week('2026-09-14', 100, { product_days: 700, real_days: 7, real_discount_share: 1, real_streaks: 5, avg_real_streak_days: 5, basket_median: 100 }),
    week('2026-09-21', 10, { product_days: 70, real_days: 35, real_discount_share: 50, basket_median: 90 }),  // prea puține produse
  ]
  const s = timingSummary(weeks)
  assert.equal(Math.round(s.realShare! * 100) / 100, Math.round((112 / 1470) * 10000) / 100)
  assert.equal(s.avgStreak, 3)
  assert.equal(s.streaks, 15)
  assert.deepEqual(topRealWeeks(weeks).map((w) => w.week), ['2026-09-07', '2026-09-14'])
  assert.deepEqual(lowestLevelWeeks(weeks).map((w) => w.week), ['2026-09-07'])
})

test('„Când să cumperi”: fără sezonalitate sub 12 luni, fraza datată', () => {
  assert.equal(weekLabel('2026-09-28'), '28 sept. – 4 oct. 2026')
  assert.equal(trackedSincePhrase('2026-06-11'), 'de la 11 iunie 2026, de când urmărim categoria')
  assert.equal(seasonalityAllowed('2026-06-11', new Date('2026-10-21T00:00:00Z')), false)
  assert.equal(seasonalityAllowed('2026-06-11', new Date('2027-06-12T00:00:00Z')), true)
  const f = timingFact('laptopuri', '2026-06-11', { realShare: 3.29, avgStreak: 1.4, streaks: 93, weeks: 12, maxProducts: 200 }, '2026-10-21T19:00:00Z', 113)
  assert.match(f, /^De la 11 iunie 2026, de când urmărim categoria, 3,3% din zilele-produs la laptopuri au avut o reducere reală/)
  assert.match(f, /în medie 1,4 zile/)
  assert.match(f, /113 produse.*21 octombrie 2026\.$/)
  assert.doesNotMatch(f, /în fiecare an|de obicei în|va scădea/)
  assert.match(timingFact('x', '2026-06-11', { realShare: 1, avgStreak: 1, streaks: 1, weeks: 5, maxProducts: 60 }, '2026-10-21T19:00:00Z', 60), /1 zi\./)
})

test('JSON-LD: Dataset și FAQPage', () => {
  const d = datasetLd({ name: 'N', description: 'D', path: '/indice', dateModified: '2026-10-21T00:00:00Z', temporalCoverage: '2026-08/2026-09', variableMeasured: ['v'] })
  assert.equal(d['@type'], 'Dataset')
  assert.equal(d.url, `${SITE_URL}/indice`)
  assert.deepEqual(d.creator, { '@id': `${SITE_URL}/#organization` })
  assert.equal(faqPageLd([]), null)
  assert.equal(faqPageLd([{ q: 'Q', a: 'A' }])!.mainEntity[0].acceptedAnswer.text, 'A')
})

test('llms.txt: secțiunea Observator cu linkuri și ultima ediție', () => {
  const base = { facts: null, guides: [], categories: [], landings: [] }
  const without = buildLlmsTxt(base)
  assert.match(without, /## Observatorul reducerilor reale/)
  assert.match(without, new RegExp(`${SITE_URL}/black-friday-2026`))
  assert.match(without, new RegExp(`${SITE_URL}/indice\\)`))
  assert.match(without, new RegExp(`${SITE_URL}/cand-sa-cumperi\\)`))
  const withData = buildLlmsTxt({ ...base, observator: { latestEdition: edition, timing: [{ slug: 'laptopuri', name: 'Laptopuri' }] } })
  assert.match(withData, new RegExp(`\\[septembrie 2026\\]\\(${SITE_URL}/indice/2026-09\\)`))
  assert.match(withData, /a scăzut cu 1,3%/)
  assert.match(withData, new RegExp(`\\[Laptopuri\\]\\(${SITE_URL}/cand-sa-cumperi/laptopuri\\)`))
})
