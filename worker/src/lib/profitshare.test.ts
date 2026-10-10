import { test } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'crypto'
import { buildSignatureString, buildAffiliateUrl, advertiserCommission, advertiserStatus, activeAdvertiserIds, type PsAdvertiser } from './profitshare.js'

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

// Forma reala a campului commissions (verificata pe API-ul live, advertiser eMAG).
const emagAdv: PsAdvertiser = {
  id: '35', name: 'eMAG.ro', logo: '', category: 'Retail', url: 'https://www.emag.ro/',
  advertiser_identifier: '9', affiliate_identifier: 'piC',
  commissions: { '0': { type: 'CPS', value: '1.00% - 20.00%' }, affiliate_statuses: { active: 'yes', approved: 'yes' } },
}

test('advertiserCommission — ia maximul din intervalul de procente', () => {
  assert.equal(advertiserCommission(emagAdv), 20)
  assert.equal(advertiserCommission({ ...emagAdv, commissions: { '0': { value: '5%' } } }), 5)
  assert.equal(advertiserCommission({ ...emagAdv, commissions: undefined }), null)
})

test('advertiserStatus — active doar daca esti aprobat in program', () => {
  assert.equal(advertiserStatus(emagAdv), 'active')
  assert.equal(advertiserStatus({ ...emagAdv, commissions: { affiliate_statuses: { active: 'yes', approved: 'no' } } }), 'inactive')
  assert.equal(advertiserStatus({ ...emagAdv, commissions: {} }), 'inactive')
})

test('activeAdvertiserIds — un singur raspuns „aprobat + activ” ajunge (API instabil, 10 oct. 2026)', () => {
  const inactive = { ...emagAdv, commissions: { affiliate_statuses: { active: 'no', approved: 'yes' } } }
  const fara = { ...emagAdv, commissions: {} }   // un server omite uneori complet campul
  assert.deepEqual([...activeAdvertiserIds([[inactive], [fara], [emagAdv]])], [String(emagAdv.id)])
  assert.equal(activeAdvertiserIds([[inactive], [fara]]).size, 0)
  assert.equal(activeAdvertiserIds([]).size, 0)
})
