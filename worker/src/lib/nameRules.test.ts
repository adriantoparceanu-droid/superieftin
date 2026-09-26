import { test } from 'node:test'
import assert from 'node:assert/strict'
import { matchNameRule, termsPattern, type NameRule } from './nameRules.js'

const rule = (id: number, terms: string, retailerId: number | null, action: 'map' | 'ignore' = 'map'): NameRule => ({
  id, retailerId, action, categoryId: action === 'map' ? id * 10 : null, categorySlug: action === 'map' ? `c${id}` : null,
  priority: 100, re: new RegExp(termsPattern(terms)!),
})

test('termsPattern: cuvant intreg, fara majuscule si diacritice', () => {
  const re = new RegExp(termsPattern('PC, calculator, hard disk')!)
  assert.ok(re.test('pc office complet optimx'))
  assert.ok(re.test('calculator sistem pc lenovo'))
  assert.ok(re.test('hdd hard disk 2tb'))
  assert.ok(!re.test('placa pcie 4.0'), '„PC” nu trebuie sa prinda „PCIe”')
  assert.equal(termsPattern(' , '), null)
})

test('matchNameRule: regula retailerului bate regula globala; ignore intors ca atare', () => {
  const rules = [rule(1, 'hdd', null), rule(2, 'hdd, ssd', 9), rule(3, 'dulap, rack', 9, 'ignore')]
  assert.equal(matchNameRule(rules, 9, 'HDD Server TOSHIBA MG11 14TB')?.id, 2)
  assert.equal(matchNameRule(rules, 5, 'HDD extern 2TB')?.id, 1)
  assert.equal(matchNameRule(rules, 9, 'Dulap montat pe perete, Extralink, 4U')?.action, 'ignore')
  assert.equal(matchNameRule(rules, 9, 'Televizor LG 55"'), null)
  // diacritice in denumire, termen fara diacritice
  assert.equal(matchNameRule([rule(4, 'casti', null)], 1, 'Căști wireless Sony')?.id, 4)
})
