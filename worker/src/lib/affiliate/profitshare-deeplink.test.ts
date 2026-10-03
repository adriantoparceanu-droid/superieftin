import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pickLinkConfig, findLinkConfig, buildDeepLink, type PsLinkConfig } from './profitshare-deeplink.js'
import type { PsAdvertiser } from '../profitshare.js'

// withSubId REAL din web (ce face /go cu linkul). Import dinamic cu cale calculata, ca tsc-ul
// worker-ului (rootDir = src) sa nu-l includa in build; tsx il incarca la rulare.
const subidPath = new URL('../../../../web/src/lib/subid.ts', import.meta.url).href
const { withSubId, detectNetwork } = await import(subidPath) as {
  withSubId: (url: string, network: 'profitshare' | '2performant' | null, clickId: string) => string
  detectNetwork: (url: string) => 'profitshare' | '2performant' | null
}

const EMAG: PsLinkConfig = { advertiserId: '35', advertiserName: 'eMAG.ro', advertiserHash: '9', affiliateHash: 'FdB' }

function adv(over: Partial<PsAdvertiser> & { statuses?: { active?: string; approved?: string } | null } = {}): PsAdvertiser {
  const { statuses = { active: 'yes', approved: 'yes' }, ...rest } = over
  return {
    id: '35', name: 'eMAG.ro', logo: '', category: 'Retail', url: 'https://www.emag.ro/',
    advertiser_identifier: '9', affiliate_identifier: 'FdB',
    commissions: statuses ? { '0': { value: '1.00% - 20.00%' }, affiliate_statuses: statuses } : {},
    ...rest,
  }
}

// Decodeaza parametrul redirect exact cum o face un server (URLSearchParams).
const redirectOf = (link: string) => new URL(link).searchParams.get('redirect')

test('buildDeepLink — formatul exact al linkurilor eMAG existente (lps/9/<cod>/?redirect=)', () => {
  const p = 'https://www.emag.ro/telefon-mobil-poco-f7-pro-12gb-ram-512gb-5g-blue-62321/pd/DRDD0D3BM/'
  assert.equal(buildDeepLink(p, EMAG, 'emag.ro'),
    'https://l.profitshare.ro/lps/9/FdB/?redirect=https%3A%2F%2Fwww.emag.ro%2Ftelefon-mobil-poco-f7-pro-12gb-ram-512gb-5g-blue-62321%2Fpd%2FDRDD0D3BM%2F')
})

test('buildDeepLink — parametrii produsului raman in redirect, nu devin parametri Profitshare', () => {
  const p = 'https://www.emag.ro/laptop-x/pd/DABC/?ref=hp_prod&X-Search-Id=1&a=b=c'
  const link = buildDeepLink(p, EMAG, 'emag.ro')
  const u = new URL(link)
  assert.deepEqual([...u.searchParams.keys()], ['redirect'])
  assert.equal(redirectOf(link), p)
  assert.ok(!link.slice(link.indexOf('?') + 1).includes('&'), 'niciun & necodat in query')
})

test('buildDeepLink — diacritice brute se encodeaza UTF-8, %XX existente nu se dubleaza', () => {
  const brut = buildDeepLink('https://www.emag.ro/căști-wireless/pd/D1/', EMAG, 'emag.ro')
  assert.equal(redirectOf(brut), 'https://www.emag.ro/c%C4%83%C8%99ti-wireless/pd/D1/')
  const deja = buildDeepLink('https://www.emag.ro/c%C4%83%C8%99ti-wireless/pd/D1/', EMAG, 'emag.ro')
  assert.equal(deja, brut)
  assert.ok(!deja.includes('%2525'), 'fara encodare dubla')
})

test('buildDeepLink — fragmentul #... e scos, spatiile encodate', () => {
  const link = buildDeepLink('  https://www.emag.ro/tv x/pd/D2/?a=1#reviews  ', EMAG, 'emag.ro')
  assert.equal(redirectOf(link), 'https://www.emag.ro/tv%20x/pd/D2/?a=1')
  assert.ok(!link.includes('#'))
})

test('buildDeepLink — refuza URL-uri invalide sau de pe alt domeniu (nu inventeaza)', () => {
  assert.throws(() => buildDeepLink('nu-e-url', EMAG, 'emag.ro'), /invalid/)
  assert.throws(() => buildDeepLink('javascript:alert(1)', EMAG, 'emag.ro'), /non-http/)
  assert.throws(() => buildDeepLink('https://www.altex.ro/x', EMAG, 'emag.ro'), /nu e pe emag\.ro/)
  assert.throws(() => buildDeepLink('https://emag.ro.evil.com/x', EMAG, 'emag.ro'), /nu e pe emag\.ro/)
})

test('compatibil cu withSubId din web: &hash=<click_id> devine parametru separat, redirect intact', () => {
  const p = 'https://www.emag.ro/căști/pd/D1/?ref=a&b=2'
  const link = buildDeepLink(p, EMAG, 'emag.ro')
  assert.equal(detectNetwork(link), 'profitshare')
  const withId = withSubId(link, detectNetwork(link), 'abc123xyz789')
  assert.equal(withId, link + '&hash=abc123xyz789')
  const u = new URL(withId)
  assert.equal(u.searchParams.get('hash'), 'abc123xyz789')
  assert.equal(u.searchParams.get('redirect'), new URL(p).href)
})

test('pickLinkConfig — eMAG aprobat + activ → codurile din API', () => {
  assert.deepEqual(pickLinkConfig([adv({ id: '1', name: 'Altul', url: 'https://altex.ro' }), adv()], 'emag.ro'), EMAG)
})

test('pickLinkConfig — neaprobat, inactiv, fara statusuri sau coduri invalide → null', () => {
  assert.equal(pickLinkConfig([adv({ statuses: { active: 'no', approved: 'yes' } })], 'emag.ro'), null)
  assert.equal(pickLinkConfig([adv({ statuses: { active: 'yes', approved: 'no' } })], 'emag.ro'), null)
  assert.equal(pickLinkConfig([adv({ statuses: null })], 'emag.ro'), null)
  assert.equal(pickLinkConfig([adv({ affiliate_identifier: '' })], 'emag.ro'), null)
  assert.equal(pickLinkConfig([adv({ advertiser_identifier: '9/x?' })], 'emag.ro'), null)
  assert.equal(pickLinkConfig([], 'emag.ro'), null)
})

test('findLinkConfig — reincearca: primul server zice „inactiv”, al doilea „activ”', async () => {
  const answers = [[adv({ statuses: { active: 'no', approved: 'yes' } })], [adv({ affiliate_identifier: '6E5' })]]
  let calls = 0
  const res = await findLinkConfig('emag.ro', 4, async () => answers[calls++])
  assert.equal(calls, 2)
  assert.equal(res.attempts, 2)
  assert.equal(res.config?.affiliateHash, '6E5')
})

test('findLinkConfig — mereu inactiv / API cazut → null cu motiv clar', async () => {
  const res = await findLinkConfig('emag.ro', 3, async () => [adv({ statuses: { active: 'no', approved: 'yes' } })])
  assert.equal(res.config, null)
  assert.equal(res.attempts, 3)
  assert.match(res.reason ?? '', /eMAG\.ro.*active=no/)

  const down = await findLinkConfig('emag.ro', 2, async () => { throw new Error('timeout') })
  assert.equal(down.config, null)
  assert.match(down.reason ?? '', /API Profitshare: timeout/)
})
