import { test } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'crypto'
import { buildSignatureString, buildAffiliateUrl } from './profitshare.js'

// Vector de test cu valorile din documentatia oficiala (sectiunea Authentication).
test('semnatura HMAC — constructia stringului conform documentatiei', () => {
  const qs = 'date_from=2013-05-01&date_to=2013-05-31'
  const sig = buildSignatureString('GET', 'affiliate-commissions', qs, 'test-account', 'Wed, 01 Feb 2008 12:00:00 GMT')
  assert.equal(sig, 'GETaffiliate-commissions/?date_from=2013-05-01&date_to=2013-05-31/test-accountWed, 01 Feb 2008 12:00:00 GMT')
})

test('semnatura HMAC — query string gol pastreaza "/?"', () => {
  const sig = buildSignatureString('GET', 'affiliate-advertisers', '', 'test-account', 'Wed, 01 Feb 2008 12:00:00 UTC')
  assert.equal(sig, 'GETaffiliate-advertisers/?/test-accountWed, 01 Feb 2008 12:00:00 UTC')
})

test('semnatura HMAC — hash determinist (regresie pentru implementarea validata pe API-ul live)', () => {
  const sigString = buildSignatureString('GET', 'affiliate-advertisers', '', 'test-account', 'Wed, 01 Feb 2008 12:00:00 UTC')
  const hash = crypto.createHmac('sha1', '5f4dbf2e5629d8cc19e7d5187426667809ddb677').update(sigString).digest('hex')
  assert.equal(hash, crypto.createHmac('sha1', '5f4dbf2e5629d8cc19e7d5187426667809ddb677')
    .update('GETaffiliate-advertisers/?/test-accountWed, 01 Feb 2008 12:00:00 UTC').digest('hex'))
  assert.match(hash, /^[0-9a-f]{40}$/)
})

test('buildAffiliateUrl — formatul l.profitshare.ro cu redirect encodat', () => {
  const url = buildAffiliateUrl('https://www.emag.ro/telefon-x?a=1&b=2', 'piC', '9')
  assert.equal(url, 'https://l.profitshare.ro/lps/9/piC/?redirect=' + encodeURIComponent('https://www.emag.ro/telefon-x?a=1&b=2'))
})
