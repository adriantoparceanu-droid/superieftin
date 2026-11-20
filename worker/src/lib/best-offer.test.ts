// Teste pentru regula „cel mai ieftin magazin partener” (lib/best-offer.ts) — fără DB.
// Rulare: cd worker && npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  pickBestOffer, isEligibleOffer, isRealDiscount, withinBudget, compareCandidates,
  type OfferCandidate,
} from './best-offer.js'

const offer = (o: Partial<OfferCandidate> & { offerId: number }): OfferCandidate => ({
  price: 100, available: true, affiliateUrl: 'https://l.profitshare.ro/l/x', lastChecked: '2026-11-20T04:00:00Z', ...o,
})

test('pickBestOffer: listă goală → null', () => {
  assert.equal(pickBestOffer([]), null)
})

test('pickBestOffer: cea mai ieftină ofertă eligibilă câștigă', () => {
  const best = pickBestOffer([offer({ offerId: 1, price: 120 }), offer({ offerId: 2, price: 99.99 }), offer({ offerId: 3, price: 150 })])
  assert.equal(best?.offerId, 2)
})

test('pickBestOffer: oferta fără link afiliat e exclusă, chiar dacă e mai ieftină', () => {
  const best = pickBestOffer([offer({ offerId: 1, price: 50, affiliateUrl: null }), offer({ offerId: 2, price: 80, affiliateUrl: '  ' }), offer({ offerId: 3, price: 90 })])
  assert.equal(best?.offerId, 3)
})

test('pickBestOffer: oferta indisponibilă (fără stoc / veche / magazin pe pauză) e exclusă', () => {
  const best = pickBestOffer([offer({ offerId: 1, price: 50, available: false }), offer({ offerId: 2, price: 70 })])
  assert.equal(best?.offerId, 2)
  assert.equal(pickBestOffer([offer({ offerId: 1, available: false })]), null)
})

test('pickBestOffer: fără preț sau preț 0 → exclusă', () => {
  assert.equal(pickBestOffer([offer({ offerId: 1, price: null }), offer({ offerId: 2, price: 0 })]), null)
})

test('pickBestOffer: la egalitate de preț câștigă oferta confirmată cel mai recent', () => {
  const best = pickBestOffer([
    offer({ offerId: 1, price: 100, lastChecked: '2026-11-19T04:00:00Z' }),
    offer({ offerId: 2, price: 100, lastChecked: new Date('2026-11-20T05:00:00Z') }),
    offer({ offerId: 3, price: 100, lastChecked: null }),
  ])
  assert.equal(best?.offerId, 2)
})

test('pickBestOffer: egalitate completă → id-ul mai mic (stabil, indiferent de ordine)', () => {
  const a = offer({ offerId: 7 }), b = offer({ offerId: 4 })
  assert.equal(pickBestOffer([a, b])?.offerId, 4)
  assert.equal(pickBestOffer([b, a])?.offerId, 4)
})

test('isEligibleOffer', () => {
  assert.equal(isEligibleOffer(offer({ offerId: 1 })), true)
  assert.equal(isEligibleOffer(offer({ offerId: 1, price: Number.NaN })), false)
})

test('isRealDiscount: strict sub mediana × 0,95', () => {
  assert.equal(isRealDiscount(940, 1000), true)
  assert.equal(isRealDiscount(950, 1000), false) // exact la prag → nu (regula site-ului e „<”)
  assert.equal(isRealDiscount(900, null), false)
  assert.equal(isRealDiscount(null, 1000), false)
  assert.equal(isRealDiscount(900, 0), false)
})

test('withinBudget', () => {
  assert.equal(withinBudget(1500, 1500), true)
  assert.equal(withinBudget(1500.01, 1500), false)
  assert.equal(withinBudget(99999, undefined), true)
  assert.equal(withinBudget(null, null), true)
  assert.equal(withinBudget(null, 1500), false)
})

test('compareCandidates: magazine desc, apoi preț asc, apoi slug', () => {
  const rows = [
    { slug: 'c', bestPrice: 500, storeCount: 1 },
    { slug: 'b', bestPrice: 900, storeCount: 3 },
    { slug: 'a', bestPrice: 700, storeCount: 3 },
    { slug: 'd', bestPrice: 700, storeCount: 3 },
  ]
  assert.deepEqual(rows.sort(compareCandidates).map((r) => r.slug), ['a', 'd', 'b', 'c'])
})
