// Teste pentru regula „cel mai ieftin magazin partener” (lib/best-offer.ts).
// Rulare: cd web && npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pickBestOffer, isEligibleOffer, type OfferCandidate } from './best-offer'
import { OFFER_STALE_DAYS } from './availability'

const NOW = new Date('2026-11-20T12:00:00Z')
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString()

// O ofertă eligibilă; fiecare test o strică pe rând
const offer = (o: Partial<OfferCandidate> = {}): OfferCandidate => ({
  offer_id: '1',
  retailer_name: 'Magazin',
  current_price: 1000,
  affiliate_url: 'https://l.profitshare.ro/l/abc',
  in_stock: true,
  last_checked: hoursAgo(2),
  retailer_paused: false,
  ...o,
})

test('pickBestOffer: lista goală → null', () => {
  assert.equal(pickBestOffer([], NOW), null)
})

test('pickBestOffer: prețul cel mai mic câștigă', () => {
  const r = pickBestOffer([
    offer({ offer_id: '1', current_price: 1200, retailer_name: 'A' }),
    offer({ offer_id: '2', current_price: 999.9, retailer_name: 'B' }),
    offer({ offer_id: '3', current_price: 1000, retailer_name: 'C' }),
  ], NOW)
  assert.equal(r?.offer_id, '2')
  assert.equal(r?.retailer_name, 'B')
  assert.equal(r?.current_price, 999.9)
})

test('pickBestOffer: fără link afiliat e exclusă, chiar dacă e cea mai ieftină', () => {
  const r = pickBestOffer([
    offer({ offer_id: '1', current_price: 500, affiliate_url: null }),
    offer({ offer_id: '2', current_price: 520, affiliate_url: '   ' }),
    offer({ offer_id: '3', current_price: 900 }),
  ], NOW)
  assert.equal(r?.offer_id, '3')
  assert.equal(pickBestOffer([offer({ affiliate_url: null })], NOW), null)
})

test('pickBestOffer: indisponibilă (fără stoc / neconfirmată recent / fără preț) e exclusă', () => {
  const r = pickBestOffer([
    offer({ offer_id: '1', current_price: 100, in_stock: false }),
    offer({ offer_id: '2', current_price: 110, last_checked: hoursAgo(OFFER_STALE_DAYS * 24 + 1) }),
    offer({ offer_id: '3', current_price: 120, last_checked: null }),
    offer({ offer_id: '4', current_price: null }),
    offer({ offer_id: '5', current_price: 800 }),
  ], NOW)
  assert.equal(r?.offer_id, '5')
  // La limita ferestrei (exact OFFER_STALE_DAYS) încă e disponibilă — ca `>=` din SQL
  assert.ok(isEligibleOffer(offer({ last_checked: hoursAgo(OFFER_STALE_DAYS * 24) }), NOW))
})

test('pickBestOffer: magazin pus pe pauză e exclus', () => {
  const r = pickBestOffer([
    offer({ offer_id: '1', current_price: 100, retailer_paused: true }),
    offer({ offer_id: '2', current_price: 300 }),
  ], NOW)
  assert.equal(r?.offer_id, '2')
})

test('pickBestOffer: la preț egal câștigă confirmarea cea mai recentă', () => {
  const r = pickBestOffer([
    offer({ offer_id: '1', last_checked: hoursAgo(20) }),
    offer({ offer_id: '2', last_checked: hoursAgo(1) }),
    offer({ offer_id: '3', last_checked: hoursAgo(5) }),
  ], NOW)
  assert.equal(r?.offer_id, '2')
})

test('pickBestOffer: egalitate totală → id-ul cel mai mic (numeric, nu alfabetic), indiferent de ordine', () => {
  const t = hoursAgo(3)
  const a = offer({ offer_id: '9', last_checked: t })
  const b = offer({ offer_id: '10', last_checked: t })
  assert.equal(pickBestOffer([a, b], NOW)?.offer_id, '9')
  assert.equal(pickBestOffer([b, a], NOW)?.offer_id, '9')
})

test('pickBestOffer: toate ofertele ineligibile → null', () => {
  assert.equal(pickBestOffer([
    offer({ in_stock: false }),
    offer({ retailer_paused: true }),
    offer({ affiliate_url: null }),
  ], NOW), null)
})
