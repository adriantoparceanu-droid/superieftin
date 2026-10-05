// Teste pentru garda zilnica (ads-guard) si pentru exceptia ingusta pauseOnly (regula 4).
// Fara retea si fara cont Google: paginile, contul, pauza si Telegram sunt simulate.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { stringify } from 'yaml'
import type { Campaign, CampaignFile, Guardrails } from './schema.js'
import { assertPauseOnly, guardPauseIsReal, pauseOnly, type AdsConfig } from '../google-ads.js'
import { runAdsGuard, targetsFromYaml, targetsFromRows, mergeTargets, pauseOps, type GuardTarget } from './guard.js'
import type { Fetcher } from './validate.js'

const CID = '2760086909'
const CFG: AdsConfig = { clientId: 'x', clientSecret: 'x', refreshToken: 'x', customerId: CID, env: 'test' }
const G = { excluded_categories: ['sanatate-naturale'] } as Guardrails

const pause = (resourceName = `customers/${CID}/adGroups/123`) => ({
  adGroupOperation: { update: { resourceName, status: 'PAUSED' }, updateMask: 'status' },
})

// --- pauseOnly: refuza orice nu e o pauza curata -----------------------------------------------------

test('pauseOnly acceptă doar pauze curate (grup, campanie, anunț)', () => {
  assert.doesNotThrow(() => assertPauseOnly(CID, [pause()]))
  assert.doesNotThrow(() => assertPauseOnly(CID, [
    { campaignOperation: { update: { resourceName: `customers/${CID}/campaigns/9`, status: 'PAUSED' }, updateMask: 'status' } },
    { adGroupAdOperation: { update: { resourceName: `customers/${CID}/adGroupAds/1~2`, status: 'PAUSED' }, updateMask: 'status' } },
  ]))
})

test('pauseOnly refuză activarea, create, remove, alte câmpuri, alt cont, alte resurse', () => {
  const refuses = (ops: unknown[], re: RegExp) => assert.throws(() => assertPauseOnly(CID, ops), re)
  refuses([], /nicio operație/)
  // activare / alt status
  refuses([{ adGroupOperation: { update: { resourceName: `customers/${CID}/adGroups/1`, status: 'ENABLED' }, updateMask: 'status' } }], /DOAR PAUSED/)
  refuses([{ adGroupOperation: { update: { resourceName: `customers/${CID}/adGroups/1`, status: 'REMOVED' }, updateMask: 'status' } }], /DOAR PAUSED/)
  // create / remove / create + update
  refuses([{ adGroupOperation: { create: { name: 'x', status: 'PAUSED' } } }], /doar \{ update, updateMask \}/)
  refuses([{ adGroupOperation: { remove: `customers/${CID}/adGroups/1` } }], /doar \{ update, updateMask \}/)
  refuses([{ adGroupOperation: { update: { resourceName: `customers/${CID}/adGroups/1`, status: 'PAUSED' }, updateMask: 'status', create: {} } }], /doar \{ update, updateMask \}/)
  // alte campuri in update / in updateMask (ex. buget, CPC)
  refuses([{ adGroupOperation: { update: { resourceName: `customers/${CID}/adGroups/1`, status: 'PAUSED', cpcBidMicros: '9000000' }, updateMask: 'status' } }], /doar resourceName și status/)
  refuses([{ adGroupOperation: { update: { resourceName: `customers/${CID}/adGroups/1`, status: 'PAUSED' }, updateMask: 'status,cpc_bid_micros' } }], /updateMask/)
  // resurse nepermise (buget, cuvinte cheie, extensii, obiective)
  refuses([{ campaignBudgetOperation: { update: { resourceName: `customers/${CID}/campaignBudgets/1`, status: 'PAUSED' }, updateMask: 'status' } }], /nu e permis/)
  refuses([{ adGroupCriterionOperation: { update: { resourceName: `customers/${CID}/adGroupCriteria/1~2`, status: 'PAUSED' }, updateMask: 'status' } }], /nu e permis/)
  // doua tipuri intr-o operatie, resourceName gresit, alt cont
  refuses([{ ...pause(), campaignOperation: pause().adGroupOperation }], /exact un tip/)
  refuses([pause(`customers/${CID}/campaigns/1`)], /resourceName invalid/)
  refuses([pause(`customers/1111111111/adGroups/1`)], /alt cont/)
  // o singura operatie proasta intr-un lot → tot lotul refuzat
  refuses([pause(), { adGroupOperation: { update: { resourceName: `customers/${CID}/adGroups/2`, status: 'ENABLED' }, updateMask: 'status' } }], /#1 refuzată/)
})

test('pauseOnly refuză ÎNAINTE de orice cerere (nu atinge rețeaua)', async () => {
  const orig = globalThis.fetch
  let called = 0
  globalThis.fetch = (async () => { called++; throw new Error('nu trebuia apelat') }) as typeof fetch
  try {
    await assert.rejects(pauseOnly(CFG, [{ adGroupOperation: { create: { status: 'ENABLED' } } }], {}), /refuzată/)
    assert.equal(called, 0)
  } finally { globalThis.fetch = orig }
})

test('pauza e reală doar în prod sau cu ADS_GUARD_REAL_PAUSE=1', () => {
  assert.equal(guardPauseIsReal('test', {}), false)
  assert.equal(guardPauseIsReal('test', { ADS_GUARD_REAL_PAUSE: '0' }), false)
  assert.equal(guardPauseIsReal('test', { ADS_GUARD_REAL_PAUSE: 'true' }), false)
  assert.equal(guardPauseIsReal('test', { ADS_GUARD_REAL_PAUSE: '1' }), true)
  assert.equal(guardPauseIsReal('prod', {}), true)
})

test('pauseOnly trimite validate_only fără flag și cerere reală cu flag', async () => {
  const orig = globalThis.fetch
  const bodies: any[] = []
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    if (String(url).includes('oauth2')) return new Response(JSON.stringify({ access_token: 't', expires_in: 3600 }), { status: 200 })
    bodies.push(JSON.parse(String(init?.body)))
    return new Response('{}', { status: 200 })
  }) as typeof fetch
  try {
    assert.equal((await pauseOnly(CFG, [pause()], {})).validateOnly, true)
    assert.equal((await pauseOnly(CFG, [pause()], { ADS_GUARD_REAL_PAUSE: '1' })).validateOnly, false)
    assert.equal(bodies[0].validateOnly, true)
    assert.equal(bodies[1].validateOnly, false)
    assert.deepEqual(bodies[1].mutateOperations, [pause()])
  } finally { globalThis.fetch = orig }
})

// --- Garda --------------------------------------------------------------------------------------------

const URL_P = 'https://www.superieftin.ro/p/telefon-test'
function campFile(id: string | null, headlines = ['Samsung Galaxy Test 256GB', 'Istoric de preț pe 90 de zile']): CampaignFile {
  const c = {
    name: 'SE | Search | Test', id: null, status: 'PAUSED', daily_budget: 8, bidding: { strategy: 'MANUAL_CPC', max_cpc: 0.35 },
    ad_groups: [{ name: 'Grup test', id, final_url: URL_P, keywords: { exact: ['x'] },
      ads: [{ type: 'RSA', id: null, headlines, descriptions: ['Comparăm cu mediana pe 30 de zile.'] }] }],
  } as unknown as Campaign
  return { file: '/tmp/t.yaml', rel: 'ads/campaigns/t.yaml', slug: 't', raw: stringify({ campaign: c }), campaign: c }
}

function productHtml(opts: { inStock?: boolean; noindex?: boolean; discount?: string | null } = {}) {
  const { inStock = true, noindex = false, discount = null } = opts
  return `<html><head>${noindex ? '<meta name="robots" content="noindex">' : ''}
<script type="application/ld+json">${JSON.stringify({ '@type': 'Product', name: 'Samsung Galaxy Test', category: 'telefoane-mobile',
    offers: { '@type': 'Offer', price: 100, availability: `https://schema.org/${inStock ? 'InStock' : 'OutOfStock'}` } })}</script></head>
<body><h1>Samsung Galaxy Test 256GB</h1>${discount ? `<p>Reducere reală: ${discount} % sub mediana de 30 de zile</p>` : ''}</body></html>`
}
const fetcherFor = (status: number, body: string): Fetcher & { calls: number } => {
  const f = (async () => { f.calls++; return { status, body } }) as unknown as Fetcher & { calls: number }
  f.calls = 0
  return f
}

function spies() {
  const s = { paused: [] as unknown[][], notified: [] as string[] }
  return {
    s,
    pause: async (_c: AdsConfig, ops: unknown[]) => { s.paused.push(ops); return { validateOnly: false } },
    notify: async (t: string) => { s.notified.push(t); return true },
  }
}

test('garda: fără ID-uri în YAML și fără grupuri active în cont → nu face nimic (nicio pagină, nicio pauză)', async () => {
  const f = fetcherFor(200, productHtml())
  const { s, pause, notify } = spies()
  const r = await runAdsGuard({ files: [campFile(null)], guardrails: G, cfg: CFG, readAccount: async () => [], fetcher: f, pause, notify, retryDelayMs: 0, log: () => {} })
  assert.equal(r.checked, 0)
  assert.equal(f.calls, 0)
  assert.equal(s.paused.length, 0)
  assert.equal(s.notified.length, 0)
})

test('garda: landing bun → nicio pauză, nicio alertă', async () => {
  const { s, pause, notify } = spies()
  const r = await runAdsGuard({ files: [campFile('123')], guardrails: G, cfg: null, fetcher: fetcherFor(200, productHtml()), pause, notify, retryDelayMs: 0, log: () => {} })
  assert.equal(r.checked, 1)
  assert.equal(r.failing, 0)
  assert.equal(s.paused.length + s.notified.length, 0)
})

test('garda: landing invalid (404 / fără stoc / noindex fără stoc) → pauză DOAR pentru grup + alertă', async () => {
  for (const [status, body, re] of [
    [404, '', /404/],
    [200, productHtml({ inStock: false }), /nicio ofertă în stoc/],
    [200, productHtml({ noindex: true, inStock: false }), /noindex/],
  ] as const) {
    const { s, pause, notify } = spies()
    const acc: GuardTarget[] = [{ source: 'cont', campaignName: 'SE | Search | Test', adGroupId: '123', adGroupName: 'Grup test', urls: [URL_P], texts: ['Samsung Galaxy Test'] }]
    const f = fetcherFor(status, body)
    const r = await runAdsGuard({ files: [], guardrails: G, cfg: CFG, readAccount: async () => acc, fetcher: f, pause, notify, retryDelayMs: 0, log: () => {} })
    assert.equal(r.failing, 1)
    assert.equal(r.paused, 1)
    assert.deepEqual(s.paused, [[pause_(`customers/${CID}/adGroups/123`)]])
    assert.doesNotThrow(() => assertPauseOnly(CID, s.paused[0]))   // exact ce accepta pauseOnly
    assert.equal(s.notified.length, 1)
    assert.match(s.notified[0], re)
    assert.match(s.notified[0], /puse pe PAUZĂ/)
    assert.ok(f.calls >= 2, 'pagina care pică se re-verifică o dată')
  }
})
// Decizia SEO din 5 oct. 2026: /p/ e noindex si pentru produsele urmarite de sub 30 de zile
// (ex. Petmart, campania PET). Pagina 200 + JSON-LD InStock = landing valid pentru reclama.
test('garda: produs noindex dar în stoc (istoric < 30 de zile) → nicio pauză, nicio alertă', async () => {
  const { s, pause, notify } = spies()
  const acc: GuardTarget[] = [{ source: 'cont', campaignName: 'SE | Search | Test', adGroupId: '123', adGroupName: 'Grup test', urls: [URL_P], texts: ['Samsung Galaxy Test'] }]
  const r = await runAdsGuard({ files: [], guardrails: G, cfg: CFG, readAccount: async () => acc, fetcher: fetcherFor(200, productHtml({ noindex: true })), pause, notify, retryDelayMs: 0, log: () => {} })
  assert.equal(r.checked, 1)
  assert.equal(r.failing, 0)
  assert.equal(s.paused.length + s.notified.length, 0)
})

test('garda: produs noindex fără nicio ofertă (fără JSON-LD Product) → pauză', async () => {
  const { s, pause, notify } = spies()
  const acc: GuardTarget[] = [{ source: 'cont', campaignName: 'SE | Search | Test', adGroupId: '123', adGroupName: 'Grup test', urls: [URL_P], texts: ['Samsung Galaxy Test'] }]
  const body = '<html><head><meta name="robots" content="noindex, follow"></head><body><h1>Samsung Galaxy Test</h1></body></html>'
  const r = await runAdsGuard({ files: [], guardrails: G, cfg: CFG, readAccount: async () => acc, fetcher: fetcherFor(200, body), pause, notify, retryDelayMs: 0, log: () => {} })
  assert.equal(r.failing, 1)
  assert.equal(s.paused.length, 1)
  assert.match(s.notified[0], /noindex/)
})

const pause_ = (rn: string) => ({ adGroupOperation: { update: { resourceName: rn, status: 'PAUSED' }, updateMask: 'status' } })

test('garda: text care vorbește de reducere + insigna dispărută → pauză; cu insignă → OK', async () => {
  const files = [campFile('123', ['Samsung Galaxy Test', 'Galaxy Test sub mediană'])]
  const a = spies()
  const r1 = await runAdsGuard({ files, guardrails: G, cfg: null, fetcher: fetcherFor(200, productHtml({ discount: null })), pause: a.pause, notify: a.notify, retryDelayMs: 0, log: () => {} })
  assert.equal(r1.failing, 1)
  assert.match(a.s.notified[0], /nu mai afișează „Reducere reală”/)
  // fara acces la cont nu se poate pune pauza → alerta cere pauza manuala
  assert.equal(a.s.paused.length, 0)
  assert.match(a.s.notified[0], /pauză manual/)
  const b = spies()
  const r2 = await runAdsGuard({ files, guardrails: G, cfg: null, fetcher: fetcherFor(200, productHtml({ discount: '12,5' })), pause: b.pause, notify: b.notify, retryDelayMs: 0, log: () => {} })
  assert.equal(r2.failing, 0)
})

test('garda: fără ADS_GUARD_REAL_PAUSE pauza e doar validată, iar alerta cere pauză manuală', async () => {
  const notified: string[] = []
  const acc: GuardTarget[] = [{ source: 'cont', campaignName: 'SE | X', adGroupId: '7', adGroupName: 'G', urls: [URL_P], texts: [] }]
  const r = await runAdsGuard({
    files: [], guardrails: G, cfg: CFG, readAccount: async () => acc, fetcher: fetcherFor(404, ''),
    pause: async () => ({ validateOnly: true }), notify: async (t) => { notified.push(t); return true }, retryDelayMs: 0, log: () => {},
  })
  assert.equal(r.paused, 0)
  assert.equal(r.validatedOnly, 1)
  assert.match(notified[0], /NU s-a aplicat/)
})

test('garda: modul check (CLI fără --confirm) nu trimite nimic', async () => {
  const { s, pause, notify } = spies()
  const r = await runAdsGuard({ mode: 'check', files: [campFile('1')], guardrails: G, cfg: CFG, readAccount: async () => targetsFromYaml([campFile('1')]), fetcher: fetcherFor(404, ''), pause, notify, retryDelayMs: 0, log: () => {} })
  assert.equal(r.failing, 1)
  assert.equal(s.paused.length + s.notified.length, 0)
})

test('garda: surse — YAML doar cu ID, contul are prioritate, rândurile GAQL grupate pe grup', () => {
  assert.equal(targetsFromYaml([campFile(null)]).length, 0)
  const y = targetsFromYaml([campFile('55')])
  assert.equal(y[0].adGroupId, '55')
  const rows = [
    { campaign: { name: 'SE | A', status: 'ENABLED' }, adGroup: { id: '55', name: 'G' }, adGroupAd: { ad: { finalUrls: [URL_P], responsiveSearchAd: { headlines: [{ text: 'H1' }], descriptions: [{ text: 'D1' }] } } } },
    { campaign: { name: 'SE | A', status: 'ENABLED' }, adGroup: { id: '55', name: 'G' }, adGroupAd: { ad: { finalUrls: [URL_P], responsiveSearchAd: { headlines: [{ text: 'H2' }], descriptions: [] } } } },
  ]
  const acc = targetsFromRows(rows)
  assert.equal(acc.length, 1)
  assert.deepEqual(acc[0].urls, [URL_P])
  assert.deepEqual(acc[0].texts, ['H1', 'D1', 'H2'])
  // cont citit: grupul din YAML care nu e activ in cont nu mai e verificat
  assert.deepEqual(mergeTargets(targetsFromYaml([campFile('99')]), acc).map((t) => t.adGroupId), ['55'])
  assert.equal(mergeTargets(y, acc)[0].source, 'cont+yaml')
  // cont necitit: raman grupurile din YAML
  assert.deepEqual(mergeTargets(y, null).map((t) => t.adGroupId), ['55'])
  assert.deepEqual(pauseOps(CID, [{ target: acc[0], problems: ['x'] }]), [pause_(`customers/${CID}/adGroups/55`)])
})
