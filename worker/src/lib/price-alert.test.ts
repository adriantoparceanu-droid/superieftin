// Teste pentru alertele de pret (lib/price-alert.ts). Rulare: cd worker && npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  alertProductUrl, buildAlertMessage, checkTarget, parseAlertStartParam, parseTypedPrice, pickTriggerOffer, siteUrl,
} from './price-alert.js'

test('link alerta: /p/ al produsului cu UTM, nu /go/ si nu magazinul', () => {
  const u = new URL(alertProductUrl('https://www.superieftin.ro/', 'televizor-lg-55', 'telegram'))
  assert.equal(u.origin + u.pathname, 'https://www.superieftin.ro/p/televizor-lg-55')
  assert.equal(u.searchParams.get('utm_source'), 'alerta')
  assert.equal(u.searchParams.get('utm_medium'), 'telegram')
  assert.equal(u.searchParams.get('utm_campaign'), 'alerta_pret')
  assert.equal(new URL(alertProductUrl('https://x.ro', 'a', 'email')).searchParams.get('utm_medium'), 'email')
})

test('domeniu: SITE_URL (env-ul workerului in compose), apoi NEXT_PUBLIC_SITE_URL, apoi www', () => {
  assert.equal(siteUrl({ SITE_URL: 'https://www.superieftin.ro/' }), 'https://www.superieftin.ro')
  assert.equal(siteUrl({ NEXT_PUBLIC_SITE_URL: 'https://a.ro' }), 'https://a.ro')
  assert.equal(siteUrl({}), 'https://www.superieftin.ro')
})

test('parametru start: produs (formatul actual) si oferta (linkuri vechi), cu si fara prag', () => {
  assert.deepEqual(parseAlertStartParam('prod_35087_1610'), { productId: 35087, offerId: null, target: 1610 })
  assert.deepEqual(parseAlertStartParam('prod_35087'), { productId: 35087, offerId: null, target: null })
  assert.deepEqual(parseAlertStartParam('offer_123_1610'), { productId: null, offerId: 123, target: 1610 })
  assert.deepEqual(parseAlertStartParam('offer_123'), { productId: null, offerId: 123, target: null })
  assert.deepEqual(parseAlertStartParam('offer_123_0'), { productId: null, offerId: 123, target: null })
  assert.equal(parseAlertStartParam('offer_abc'), null)
  assert.equal(parseAlertStartParam('prod_1_2_3'), null)
  assert.equal(parseAlertStartParam('produs_1'), null)
  assert.equal(parseAlertStartParam(null), null)
})

test('alerta pe produs: pleaca la ORICE magazin disponibil la sau sub prag, cel mai ieftin castiga', () => {
  const offers = [
    { offerId: 1, price: 1700, retailerName: 'eMAG', available: true },      // peste prag
    { offerId: 2, price: 1590, retailerName: 'evomag', available: true },
    { offerId: 3, price: 1500, retailerName: 'CITGrup', available: false },  // fara stoc → ignorata
    { offerId: 4, price: 1600, retailerName: 'ForIT', available: true },     // exact pragul → valid
  ]
  assert.deepEqual(pickTriggerOffer(offers, 1600), offers[1])
  assert.deepEqual(pickTriggerOffer(offers.filter(o => o.offerId !== 2), 1600), offers[3])   // „la” prag
  assert.equal(pickTriggerOffer([offers[0], offers[2]], 1600), null)  // doar peste prag / indisponibila
  assert.equal(pickTriggerOffer(null, 1600), null)
  // la pret egal: oferta cu id mai mic (rezultat stabil intre rulari)
  const tie = [{ offerId: 9, price: 100, retailerName: 'A', available: true }, { offerId: 5, price: 100, retailerName: 'B', available: true }]
  assert.equal(pickTriggerOffer(tie, 100)?.offerId, 5)
})

test('prag: trebuie sa fie sub pretul de azi', () => {
  assert.equal(checkTarget(1610, 1699.99), 'ok')
  assert.equal(checkTarget(1700, 1699.99), 'not-below-current')
  assert.equal(checkTarget(1699.99, 1699.99), 'not-below-current')
  assert.equal(checkTarget(5000, null), 'ok')
  assert.equal(checkTarget(0, 100), 'invalid')
  assert.equal(checkTarget(NaN, 100), 'invalid')
  assert.equal(checkTarget(200000, null), 'invalid')
})

test('suma tastata', () => {
  assert.equal(parseTypedPrice('800'), 800)
  assert.equal(parseTypedPrice('1.299,90'), 1299.9)
  assert.equal(parseTypedPrice('1299.9'), 1299.9)
  assert.equal(parseTypedPrice('1299,9'), 1299.9)
  assert.equal(parseTypedPrice('1 299'), 1299)
  assert.ok(Number.isNaN(parseTypedPrice('1,2,3')))
})

test('mesaj: HTML escapat, link /p/, fara promisiuni de reducere', () => {
  const msg = buildAlertMessage({
    alertId: 17,
    rearmPrice: 1658.3,
    productName: 'Cablu <USB> & incarcator',
    retailerName: 'eMAG',
    currentPrice: 1599.99,
    targetPrice: 1610,
    url: 'https://www.superieftin.ro/p/cablu?utm_source=alerta&utm_medium=telegram',
  })
  assert.match(msg, /Cablu &lt;USB&gt; &amp; incarcator/)
  assert.match(msg, /href="https:\/\/www\.superieftin\.ro\/p\/cablu\?utm_source=alerta&amp;utm_medium=telegram"/)
  assert.match(msg, /1\.599,99 RON/)
  assert.doesNotMatch(msg, /\/go\//)
  assert.doesNotMatch(msg, /reducere|%|garant/i)
  // re-armare: alerta ramane activa, cu pragul de re-armare si comanda de oprire
  assert.match(msg, /rămâne activă/)
  assert.match(msg, /1\.658,30 RON/)
  assert.match(msg, /\/sterge 17/)
})
