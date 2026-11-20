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

// Din 20 nov. 2026 landing-urile sunt articole /ghiduri/<slug> (paginile /p/ dispar)
const URL_A = 'https://www.superieftin.ro/ghiduri/telefoane-bune-sub-1500-lei'
const URL_P = 'https://www.superieftin.ro/p/telefon-test'
function campFile(id: string | null, headlines = ['Samsung Galaxy Test 256GB', 'Istoric de preț pe 90 de zile'], finalUrl = URL_A): CampaignFile {
  const c = {
    name: 'SE | Search | Test', id: null, status: 'PAUSED', daily_budget: 8, bidding: { strategy: 'MANUAL_CPC', max_cpc: 0.35 },
    ad_groups: [{ name: 'Grup test', id, final_url: finalUrl, keywords: { exact: ['x'] },
      ads: [{ type: 'RSA', id: null, headlines, descriptions: ['Comparăm cu mediana pe 30 de zile.'] }] }],
  } as unknown as Campaign
  return { file: '/tmp/t.yaml', rel: 'ads/campaigns/t.yaml', slug: 't', raw: stringify({ campaign: c }), campaign: c }
}

// HTML-ul unui articol: BlogPosting + Product cu review FARA offers + butoane /go/ (ProductPick)
function articleHtml(opts: { noindex?: boolean; goLinks?: number; text?: string } = {}) {
  const { noindex = false, goLinks = 1, text = '' } = opts
  return `<html><head>${noindex ? '<meta name="robots" content="noindex">' : ''}
<script type="application/ld+json">${JSON.stringify({ '@type': 'BlogPosting', headline: 'Telefoane bune' })}</script>
<script type="application/ld+json">${JSON.stringify({ '@type': 'Product', name: 'Samsung Galaxy Test', review: { '@type': 'Review' } })}</script></head>
<body><h1>Samsung Galaxy Test 256GB</h1>${text}${Array.from({ length: goLinks }, (_, i) => `<a href="/go/${i + 1}">Vezi la magazin</a>`).join('')}</body></html>`
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
  const f = fetcherFor(200, articleHtml())
  const { s, pause, notify } = spies()
  const r = await runAdsGuard({ files: [campFile(null)], guardrails: G, cfg: CFG, readAccount: async () => [], fetcher: f, pause, notify, retryDelayMs: 0, log: () => {} })
  assert.equal(r.checked, 0)
  assert.equal(f.calls, 0)
  assert.equal(s.paused.length, 0)
  assert.equal(s.notified.length, 0)
})

test('garda: landing bun → nicio pauză, nicio alertă', async () => {
  const { s, pause, notify } = spies()
  const r = await runAdsGuard({ files: [campFile('123')], guardrails: G, cfg: null, fetcher: fetcherFor(200, articleHtml()), pause, notify, retryDelayMs: 0, log: () => {} })
  assert.equal(r.checked, 1)
  assert.equal(r.failing, 0)
  assert.equal(s.paused.length + s.notified.length, 0)
})

test('garda: landing invalid (404 / 410 / noindex / fără buton spre magazin / /p/) → pauză DOAR pentru grup + alertă', async () => {
  for (const [status, body, re, url] of [
    [404, '', /404/, URL_A],
    [410, '', /410/, URL_A],
    [200, articleHtml({ noindex: true }), /noindex/, URL_A],
    [200, articleHtml({ goLinks: 0 }), /niciun buton spre magazin/, URL_A],
    [200, articleHtml(), /paginile \/p\/ nu mai există/, URL_P],
  ] as const) {
    const { s, pause, notify } = spies()
    const acc: GuardTarget[] = [{ source: 'cont', campaignName: 'SE | Search | Test', adGroupId: '123', adGroupName: 'Grup test', urls: [url], texts: ['Samsung Galaxy Test'] }]
    const f = fetcherFor(status, body)
    const r = await runAdsGuard({ files: [], guardrails: G, cfg: CFG, readAccount: async () => acc, fetcher: f, pause, notify, retryDelayMs: 0, log: () => {} })
    assert.equal(r.failing, 1)
    assert.equal(r.paused, 1)
    assert.deepEqual(s.paused, [[pause_(`customers/${CID}/adGroups/123`)]])
    assert.doesNotThrow(() => assertPauseOnly(CID, s.paused[0]))   // exact ce accepta pauseOnly
    assert.equal(s.notified.length, 1)
    assert.match(s.notified[0], re)
    assert.match(s.notified[0], /puse pe PAUZĂ/)
    // pagina care pica se re-verifica o data (/p/ pica fara nicio descarcare)
    if (url === URL_A) assert.ok(f.calls >= 2, 'pagina care pică se re-verifică o dată')
    else assert.equal(f.calls, 0)
  }
})
// Articolul are Product cu review FARA offers: nu inseamna „fara stoc” (bug-ul de dinainte de
// 20 nov. 2026 — garda ar fi pus pe pauza orice grup spre /ghiduri/)
test('garda: articol cu Product fără offers + buton /go/ → nicio pauză, nicio alertă', async () => {
  const { s, pause, notify } = spies()
  const acc: GuardTarget[] = [{ source: 'cont', campaignName: 'SE | Search | Test', adGroupId: '123', adGroupName: 'Grup test', urls: [URL_A], texts: ['Samsung Galaxy Test'] }]
  const r = await runAdsGuard({ files: [], guardrails: G, cfg: CFG, readAccount: async () => acc, fetcher: fetcherFor(200, articleHtml()), pause, notify, retryDelayMs: 0, log: () => {} })
  assert.equal(r.checked, 1)
  assert.equal(r.failing, 0)
  assert.equal(s.paused.length + s.notified.length, 0)
})

const pause_ = (rn: string) => ({ adGroupOperation: { update: { resourceName: rn, status: 'PAUSED' }, updateMask: 'status' } })

test('garda: procent din anunț care nu apare pe articol → pauză (fără cont: alertă cu pauză manuală)', async () => {
  const files = [campFile('123', ['Samsung Galaxy Test', 'Galaxy Test -12%'])]
  const a = spies()
  const r1 = await runAdsGuard({ files, guardrails: G, cfg: null, fetcher: fetcherFor(200, articleHtml()), pause: a.pause, notify: a.notify, retryDelayMs: 0, log: () => {} })
  assert.equal(r1.failing, 1)
  assert.match(a.s.notified[0], /nu afișează nicio reducere reală/)
  // fara acces la cont nu se poate pune pauza → alerta cere pauza manuala
  assert.equal(a.s.paused.length, 0)
  assert.match(a.s.notified[0], /pauză manual/)
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
