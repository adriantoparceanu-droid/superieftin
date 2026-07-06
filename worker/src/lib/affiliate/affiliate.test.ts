import { test } from 'node:test'
import assert from 'node:assert/strict'
import { extractDomain } from './domain.js'
import { AffiliateResolver } from './resolver.js'
import type { AffiliateProvider, AffiliateAdvertiser } from './types.js'

// --- extractDomain -----------------------------------------------------------

test('extractDomain — normalizeaza nume si URL-uri la domeniul inregistrabil', () => {
  assert.equal(extractDomain('eMAG.ro'), 'emag.ro')
  assert.equal(extractDomain('https://www.emag.ro/produs/x?ref=1'), 'emag.ro')
  assert.equal(extractDomain('//profitshare.ro/lps/x'), 'profitshare.ro')
  assert.equal(extractDomain('Karcher.com/ro/ro'), 'karcher.com')
  assert.equal(extractDomain('produs.shop.altex.ro'), 'altex.ro')
  assert.equal(extractDomain('https://shop.example.com.ro/x'), 'example.com.ro')
  assert.equal(extractDomain(''), null)
  assert.equal(extractDomain('localhost'), null)
})

// --- AffiliateResolver -------------------------------------------------------

// Providere fictive: buildLink returneaza un string deterministic, fara apeluri externe.
function fakeProvider(network: string): AffiliateProvider {
  return {
    network,
    async syncAdvertisers() { return [] },
    buildLink: (url, adv) => `${network}:${adv.externalId}:${url}`,
  }
}

function adv(over: Partial<AffiliateAdvertiser>): AffiliateAdvertiser {
  return {
    network: 'profitshare', externalId: '1', name: 'X', domain: 'emag.ro',
    advertiserHash: 'a', affiliateHash: 'b', commission: null, status: 'active', ...over,
  }
}

test('resolve — comisionul mai mare castiga intre retele', () => {
  const r = new AffiliateResolver([fakeProvider('profitshare'), fakeProvider('2performant')])
  r.setAdvertisers([
    adv({ network: 'profitshare', externalId: 'ps', commission: 3 }),
    adv({ network: '2performant', externalId: '2p', commission: 5 }),
  ])
  const res = r.resolve('https://www.emag.ro/p/1')
  assert.equal(res?.network, '2performant')
  assert.equal(res?.commission, 5)
  assert.equal(res?.affiliateUrl, '2performant:2p:https://www.emag.ro/p/1')
})

test('resolve — comision egal/necunoscut => ordinea de prioritate', () => {
  const r = new AffiliateResolver(
    [fakeProvider('profitshare'), fakeProvider('2performant')],
    ['2performant', 'profitshare'],
  )
  r.setAdvertisers([
    adv({ network: 'profitshare', externalId: 'ps', commission: null }),
    adv({ network: '2performant', externalId: '2p', commission: null }),
  ])
  assert.equal(r.resolve('https://emag.ro/x')?.network, '2performant')
})

test('resolve — domeniu necunoscut => null (neafiliat)', () => {
  const r = new AffiliateResolver([fakeProvider('profitshare')])
  r.setAdvertisers([adv({ domain: 'emag.ro' })])
  assert.equal(r.resolve('https://altceva.ro/x'), null)
})

test('resolve — ignora advertiserii inactivi si retelele neinregistrate', () => {
  const r = new AffiliateResolver([fakeProvider('profitshare')])
  r.setAdvertisers([
    adv({ network: 'profitshare', externalId: 'ps', status: 'inactive' }),
    adv({ network: '2performant', externalId: '2p', commission: 9 }), // retea neinregistrata
  ])
  // ambii candidati pică => null
  assert.equal(r.resolve('https://emag.ro/x'), null)
})
