// Teste pentru digestul de alerte pe email (lib/email/digest.ts). Rulare: cd worker && npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nextDigestAllowedAt, planDigest, type DigestCandidate } from './digest.js'

const NOW = Date.parse('2026-10-03T12:00:00Z')
let nextId = 1
function cand(subscriberId: number, product: string, over: Partial<DigestCandidate> = {}): DigestCandidate {
  return {
    alertId: nextId++, subscriberId, email: `a${subscriberId}@exemplu.ro`, lastDigestAt: null,
    productName: product, productSlug: product.toLowerCase(), targetPrice: 1000, offerId: 1, price: 950,
    retailerName: 'eMAG', ...over,
  }
}

test('mai multe produse ale aceluiasi abonat → UN singur email', () => {
  const plan = planDigest([cand(1, 'Laptop'), cand(1, 'Telefon'), cand(1, 'Casti')], NOW, 24)
  assert.equal(plan.batches.length, 1)
  assert.deepEqual(plan.batches[0].items.map((i) => i.productName), ['Casti', 'Laptop', 'Telefon'])
  assert.equal(plan.batches[0].alertIds.length, 3)
  assert.equal(plan.deferred.length, 0)
})

test('abonati diferiti → emailuri separate, fiecare cu produsele lui', () => {
  const plan = planDigest([cand(1, 'Laptop'), cand(2, 'Laptop'), cand(1, 'Telefon')], NOW, 24)
  assert.equal(plan.batches.length, 2)
  const b1 = plan.batches.find((b) => b.subscriberId === 1)!
  const b2 = plan.batches.find((b) => b.subscriberId === 2)!
  assert.deepEqual(b1.items.map((i) => i.productName), ['Laptop', 'Telefon'])
  assert.equal(b1.email, 'a1@exemplu.ro')
  assert.deepEqual(b2.items.map((i) => i.productName), ['Laptop'])
})

test('plafon zilnic: abonatul care a primit un email acum 5 ore e amanat (alertele raman active)', () => {
  const recent = new Date(NOW - 5 * 3600 * 1000).toISOString()
  const plan = planDigest([cand(1, 'Laptop', { lastDigestAt: recent }), cand(1, 'Telefon', { lastDigestAt: recent }), cand(2, 'Mouse')], NOW, 24)
  assert.deepEqual(plan.batches.map((b) => b.subscriberId), [2])
  assert.deepEqual(plan.deferred.map((d) => d.productName).sort(), ['Laptop', 'Telefon'])
})

test('re-programare: alertele amanate intra in digestul urmator, dupa ce trece fereastra', () => {
  const last = new Date(NOW - 5 * 3600 * 1000).toISOString()
  const pending = [cand(1, 'Laptop', { lastDigestAt: last }), cand(1, 'Telefon', { lastDigestAt: last })]
  assert.equal(planDigest(pending, NOW, 24).batches.length, 0)
  // 19 ore mai tarziu (24 h de la ultimul email): aceleasi alerte, inca sub prag → un singur email cu ambele
  const later = NOW + 19 * 3600 * 1000
  const plan = planDigest(pending, later, 24)
  assert.equal(plan.batches.length, 1)
  assert.equal(plan.batches[0].items.length, 2)
  assert.equal(plan.batches[0].previousDigestAt, last)
  assert.deepEqual(nextDigestAllowedAt(last, 24), new Date(Date.parse(last) + 24 * 3600 * 1000))
})

test('plafon configurabil: 0 ore = fara plafon; 48 ore = amanat si dupa o zi', () => {
  const dayAgo = new Date(NOW - 25 * 3600 * 1000).toISOString()
  assert.equal(planDigest([cand(1, 'A', { lastDigestAt: dayAgo })], NOW, 24).batches.length, 1)
  assert.equal(planDigest([cand(1, 'A', { lastDigestAt: dayAgo })], NOW, 48).batches.length, 0)
  const justNow = new Date(NOW - 1000).toISOString()
  assert.equal(planDigest([cand(1, 'A', { lastDigestAt: justNow })], NOW, 0).batches.length, 1)
})

test('doua alerte pe acelasi produs → un rand (pretul cel mai mic), ambele alerte se opresc', () => {
  const plan = planDigest([cand(1, 'Laptop', { price: 990 }), cand(1, 'Laptop', { price: 940, retailerName: 'evomag' })], NOW, 24)
  assert.equal(plan.batches[0].items.length, 1)
  assert.equal(plan.batches[0].items[0].retailerName, 'evomag')
  assert.equal(plan.batches[0].alertIds.length, 2)
})

test('fara candidati → nimic de trimis', () => {
  assert.deepEqual(planDigest([], NOW, 24), { batches: [], deferred: [] })
})
