// Teste pentru Admin → Cercetare (lib/admin/research-filters.ts). Rulare: cd web && npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  parseTheme, parseBudget, parseSort, parseRealOnly, parseResearchParams, researchHref,
  researchOrderBy, discountVsMedian, isRealDiscount, RESEARCH_SORTS, MAX_BUDGET,
} from './research-filters'

test('parseTheme: doar slug-uri valide', () => {
  assert.equal(parseTheme('laptopuri'), 'laptopuri')
  assert.equal(parseTheme(' Telefoane-Mobile '), 'telefoane-mobile')
  assert.equal(parseTheme(['tv-audio', 'x']), 'tv-audio')
  assert.equal(parseTheme(''), null)
  assert.equal(parseTheme("x' OR 1=1"), null)
  assert.equal(parseTheme('-incepe-cu-cratima'), null)
  assert.equal(parseTheme(undefined), null)
})

test('parseBudget: formate romanesti si zecimale', () => {
  assert.equal(parseBudget('1500'), 1500)
  assert.equal(parseBudget('1.500'), 1500)
  assert.equal(parseBudget('1 500'), 1500)
  assert.equal(parseBudget('1.500,50'), 1500.5)
  assert.equal(parseBudget('1500,5'), 1500.5)
  assert.equal(parseBudget('1500.5'), 1500.5)
  assert.equal(parseBudget('2000 lei'), 2000)
  assert.equal(parseBudget('1.234.567'), MAX_BUDGET)
})

test('parseBudget: gol, zero, negativ sau text → fara filtru', () => {
  for (const v of ['', '  ', '0', '-100', 'abc', '1e5', '12,5,3', undefined, null]) {
    assert.equal(parseBudget(v), null, String(v))
  }
})

test('parseSort + parseRealOnly', () => {
  for (const s of RESEARCH_SORTS) assert.equal(parseSort(s), s)
  assert.equal(parseSort('drop table'), 'reducere')
  assert.equal(parseSort(undefined), 'reducere')
  assert.equal(parseRealOnly('1'), true)
  assert.equal(parseRealOnly(['1']), true)
  assert.equal(parseRealOnly('on'), false)
  assert.equal(parseRealOnly(undefined), false)
})

test('parseResearchParams: valori implicite', () => {
  assert.deepEqual(parseResearchParams({}), { tema: null, buget: null, reale: false, toate: false, sort: 'reducere', pagina: 1 })
  assert.deepEqual(
    parseResearchParams({ tema: 'laptopuri', buget: '3000', reale: '1', sort: 'pret', pagina: '3' }),
    { tema: 'laptopuri', buget: 3000, reale: true, toate: false, sort: 'pret', pagina: 3 },
  )
})

test('researchHref: implicitele lipsesc, filtrul nou reseteaza pagina', () => {
  const base = parseResearchParams({})
  assert.equal(researchHref(base), '/admin/cercetare')
  const cur = parseResearchParams({ tema: 'laptopuri', buget: '3000', reale: '1', sort: 'pret', pagina: '3' })
  assert.equal(researchHref(cur), '/admin/cercetare?tema=laptopuri&buget=3000&reale=1&sort=pret&pagina=3')
  assert.equal(researchHref(cur, { pagina: 4 }), '/admin/cercetare?tema=laptopuri&buget=3000&reale=1&sort=pret&pagina=4')
  assert.equal(researchHref(cur, { sort: 'magazine' }), '/admin/cercetare?tema=laptopuri&buget=3000&reale=1&sort=magazine')
  assert.equal(researchHref(cur, { tema: null, reale: false }), '/admin/cercetare?buget=3000&sort=pret')
})

test('toate=1: arata si produsele medicale din arborii de sanatate; implicit lipseste din URL', () => {
  const cur = parseResearchParams({ tema: 'sanatate-naturale', toate: '1' })
  assert.equal(cur.toate, true)
  assert.equal(researchHref(cur), '/admin/cercetare?tema=sanatate-naturale&toate=1')
  assert.equal(researchHref(cur, { toate: false }), '/admin/cercetare?tema=sanatate-naturale')
  assert.equal(parseResearchParams({ toate: 'on' }).toate, false)
})

test('researchOrderBy: lista fixa, ordine stabila', () => {
  for (const s of RESEARCH_SORTS) assert.match(researchOrderBy(s), /product_id ASC$/)
  assert.match(researchOrderBy('reducere'), /^discount_pct DESC NULLS LAST/)
  assert.match(researchOrderBy('pret'), /^best_price ASC/)
  assert.match(researchOrderBy('magazine'), /^stores DESC/)
  assert.match(researchOrderBy('schimbari'), /^price_changes_60d DESC/)
})

test('discountVsMedian + isRealDiscount: regula site-ului (≥ 5% sub mediana)', () => {
  assert.equal(discountVsMedian(900, 1000), 10)
  assert.equal(discountVsMedian(1100, 1000), -10)
  assert.equal(discountVsMedian(900, null), null)
  assert.equal(discountVsMedian(900, 0), null)
  assert.equal(isRealDiscount(940, 1000), true)
  assert.equal(isRealDiscount(950, 1000), false)   // fix 5% nu e strict sub mediana × 0,95
  assert.equal(isRealDiscount(960, 1000), false)
  assert.equal(isRealDiscount(900, null), false)
})
