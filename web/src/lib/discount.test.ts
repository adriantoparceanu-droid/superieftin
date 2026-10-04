import { test } from 'node:test'
import assert from 'node:assert/strict'
import { calculateDiscount, verdictBadgeText, verdictColor } from './discount'

// Pragurile (5% sub / 5% peste mediana) NU se schimbă în redesign — testul le fixează
test('verdict: pragurile fata de mediana 30 de zile', () => {
  assert.equal(calculateDiscount(940, 1000).verdict, 'real')      // 6% sub
  assert.equal(calculateDiscount(950, 1000).verdict, 'normal')    // exact 5% sub → NU e reducere (SQL: < 0.95)
  assert.equal(calculateDiscount(1050, 1000).verdict, 'normal')   // exact 5% peste
  assert.equal(calculateDiscount(1051, 1000).verdict, 'higher')
  assert.equal(calculateDiscount(1000, null).verdict, 'no-data')
  assert.equal(calculateDiscount(1000, 0).verdict, 'no-data')
})

test('insigna: textele celor 4 stari', () => {
  // „Reducere reală” scris exact așa — garda de reclame îl caută pe /p/
  assert.equal(verdictBadgeText('real', 18), 'Reducere reală −18%')
  assert.equal(verdictBadgeText('real', 16.8), 'Reducere reală −16,8%')
  assert.equal(verdictBadgeText('normal', 1.2), 'Preț obișnuit')
  assert.equal(verdictBadgeText('higher', -7), 'Peste obișnuit +7%')
  assert.equal(verdictBadgeText('no-data', null), 'Monitorizăm prețul')
  assert.equal(calculateDiscount(1100, 1000).labelRo, 'Peste obișnuit +10%')
})

test('insigna: culori pe tokeni (functioneaza si in modul intunecat)', () => {
  assert.match(verdictColor('real'), /bg-red\b/)
  assert.match(verdictColor('normal'), /bg-neutral-tint/)
  assert.match(verdictColor('higher'), /text-amber-ink/)
  assert.match(verdictColor('no-data'), /ring-line-2/)
  for (const v of ['real', 'normal', 'higher', 'no-data'] as const) {
    assert.doesNotMatch(verdictColor(v), /(gray|green|orange)-\d/)
  }
})
