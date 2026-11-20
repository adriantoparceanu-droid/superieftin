// Teste pentru verificarea săptămânală a articolelor (lib/guide-health.ts) — fără DB.
// Rulare: cd worker && npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  parseTitleBudget, extractMarkerRefs, checkGuide, formatTelegramSummary, formatTextReport,
  type GuideHealthInput, type GuideHealthProduct,
} from './guide-health.js'

test('parseTitleBudget: formele uzuale', () => {
  assert.equal(parseTitleBudget('Cele mai bune telefoane sub 1.500 de lei'), 1500)
  assert.equal(parseTitleBudget('Telefoane sub 1500 lei în 2026'), 1500)
  assert.equal(parseTitleBudget('Laptopuri sub 1.500 lei'), 1500)
  assert.equal(parseTitleBudget('Laptopuri SUB 3 000 LEI'), 3000)
  assert.equal(parseTitleBudget('Căști sub 300 de lei: ce merită'), 300)
  assert.equal(parseTitleBudget('Televizoare sub 2.500 RON'), 2500)
  assert.equal(parseTitleBudget('Monitoare sub 1.200 de lei'), 1200)
  assert.equal(parseTitleBudget('Tablete până în 1.000 de lei'), 1000)
  assert.equal(parseTitleBudget('Tablete pana la 1000 lei'), 1000)
  assert.equal(parseTitleBudget('Robot de bucătărie sub 1.299,99 lei'), 1299)
})

test('parseTitleBudget: fără buget → null', () => {
  assert.equal(parseTitleBudget('iPhone 16 vs Samsung S25: pe care îl alegi?'), null)
  assert.equal(parseTitleBudget('Cum alegi un televizor sub 55 inch'), null)
  assert.equal(parseTitleBudget('Submarine 1500 lei'), null) // „sub” trebuie să fie cuvânt separat
  assert.equal(parseTitleBudget('Telefoane sub 1500'), null)  // fără „lei” nu e buget
})

test('extractMarkerRefs: oferte, pret, comparatie, unice, în ordine', () => {
  const body = [
    'Intro',
    '{{oferte:samsung-galaxy-a17}}',
    'Text {{pret:123}} în frază',
    '{{comparatie: samsung-galaxy-a17 , xiaomi-redmi-15c }}',
    '{{istoric-pret:456}}',
    'fără marcaj {{',
  ].join('\n')
  assert.deepEqual(extractMarkerRefs(body), ['samsung-galaxy-a17', '123', 'xiaomi-redmi-15c', '456'])
  assert.deepEqual(extractMarkerRefs('nimic aici'), [])
})

const now = new Date('2026-11-20T08:00:00Z')
const prod = (o: Partial<GuideHealthProduct>): GuideHealthProduct => ({
  ref: 'p', productId: 1, slug: 'p', name: 'Produs', bestPrice: 1000, retailer: 'Vexio', ...o,
})
const guide = (o: Partial<GuideHealthInput>): GuideHealthInput => ({
  id: 1, slug: 'g', title: 'Cele mai bune telefoane sub 1.500 de lei', updatedAt: new Date('2026-11-01T00:00:00Z'), products: [], ...o,
})

test('checkGuide: articol sănătos → fără probleme', () => {
  assert.deepEqual(checkGuide(guide({ products: [prod({})] }), now).problems, [])
})

test('checkGuide: produs fără ofertă disponibilă cu afiliat', () => {
  const r = checkGuide(guide({ products: [prod({ slug: 'a', name: 'A', bestPrice: null })] }), now)
  assert.deepEqual(r.problems, [{ kind: 'fara-oferta', ref: 'p', slug: 'a', name: 'A' }])
})

test('checkGuide: produs inexistent', () => {
  const r = checkGuide(guide({ products: [prod({ ref: 'vechi', productId: null, slug: null, name: null, bestPrice: null })] }), now)
  assert.deepEqual(r.problems, [{ kind: 'produs-lipsa', ref: 'vechi' }])
})

test('checkGuide: preț peste bugetul din titlu (egal cu bugetul = OK)', () => {
  const r = checkGuide(guide({ products: [prod({ slug: 'ok', bestPrice: 1500 }), prod({ slug: 'scump', name: 'Scump', bestPrice: 1599.9 })] }), now)
  assert.deepEqual(r.problems, [{ kind: 'peste-buget', slug: 'scump', name: 'Scump', price: 1599.9, budget: 1500, retailer: 'Vexio' }])
  // fără buget în titlu, prețul nu contează
  assert.deepEqual(checkGuide(guide({ title: 'Cum alegi un telefon', products: [prod({ bestPrice: 9999 })] }), now).problems, [])
})

test('checkGuide: neactualizat > 90 de zile (exact 90 = OK)', () => {
  const at90 = new Date(now.getTime() - 90 * 86400000)
  assert.deepEqual(checkGuide(guide({ updatedAt: at90 }), now).problems, [])
  const at91 = new Date(now.getTime() - 91 * 86400000)
  assert.deepEqual(checkGuide(guide({ updatedAt: at91 }), now).problems, [{ kind: 'neactualizat', days: 91 }])
})

test('formatTelegramSummary: null fără probleme; altfel rezumat HTML escapat', () => {
  const ok = checkGuide(guide({ products: [prod({})] }), now)
  assert.equal(formatTelegramSummary([ok], 1), null)
  const bad = checkGuide(guide({ title: 'Căști <ieftine> sub 300 de lei', products: [prod({ name: 'X & Y', bestPrice: null })] }), now)
  const msg = formatTelegramSummary([ok, bad], 2)
  assert.ok(msg)
  assert.match(msg, /1 din 2 publicate au probleme/)
  assert.match(msg, /Căști &lt;ieftine&gt;/)
  assert.match(msg, /X &amp; Y — nicio ofertă disponibilă cu link afiliat/)
  assert.ok(msg.length < 4096)
})

test('formatTelegramSummary: mesaj lung tăiat sub limita Telegram', () => {
  const many = Array.from({ length: 200 }, (_, i) => checkGuide(guide({ id: i, slug: `g${i}`, products: [prod({ name: 'Produs cu nume lung '.repeat(3), bestPrice: null })] }), now))
  const msg = formatTelegramSummary(many, 200)!
  assert.ok(msg.length < 4096)
  assert.match(msg, /și încă \d+ articole/)
})

test('formatTextReport', () => {
  assert.equal(formatTextReport([]), 'Niciun articol publicat.')
  assert.match(formatTextReport([checkGuide(guide({}), now)]), /Nicio problemă găsită/)
})
