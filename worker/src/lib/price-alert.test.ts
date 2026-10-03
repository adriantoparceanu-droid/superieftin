// Teste pentru alertele de pret (lib/price-alert.ts). Rulare: cd worker && npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  alertProductUrl, buildAlertMessage, checkTarget, parseAlertStartParam, parseTypedPrice, siteUrl,
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

test('parametru start: cu si fara prag', () => {
  assert.deepEqual(parseAlertStartParam('offer_123_1610'), { offerId: 123, target: 1610 })
  assert.deepEqual(parseAlertStartParam('offer_123'), { offerId: 123, target: null })
  assert.deepEqual(parseAlertStartParam('offer_123_0'), { offerId: 123, target: null })
  assert.equal(parseAlertStartParam('offer_abc'), null)
  assert.equal(parseAlertStartParam('offer_1_2_3'), null)
  assert.equal(parseAlertStartParam(null), null)
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
})
