// Teste pentru campaniile ca si cod (Faza 3): validare statica, afirmatii pe landing,
// hash-ul pentru policy-reviewer, planul fata de cont. Fara retea si fara cont Google.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { stringify } from 'yaml'
import type { Campaign, CampaignFile, Guardrails } from './schema.js'
import { contentHash, writeIds, parseNegative, loadAllCampaigns, loadGuardrails } from './schema.js'
import { validateCampaign, validateAll, negativeBlocks, styleProblems, claimIssues, parsePage, BASE_NEGATIVES, RETAILER_BRANDS, type PageFacts } from './validate.js'
import { checkReview } from './review.js'
import { buildPlan, planOps } from './plan.js'
import { emptySnapshot, type AccountSnapshot } from './account.js'

const G: Guardrails = {
  currency: 'RON',
  budget: { max_daily_per_campaign: 50, max_daily_total: 150, max_monthly_total: 4000 },
  bidding: { max_cpc: 3, allowed_strategies: ['MANUAL_CPC', 'MAXIMIZE_CLICKS'] },
  targeting: { countries: ['RO'], languages: ['ro'], networks: { search: true, search_partners: false, display: false } },
  excluded_categories: ['sanatate-naturale'],
  safety: { new_entities_status: 'PAUSED', require_policy_pass: true, default_env: 'test' },
}

const URL_P = 'https://www.superieftin.ro/p/telefon-test'
const H = ['Titlu unu', 'Titlu doi', 'Titlu trei', 'Titlu patru', 'Titlu cinci', 'Titlu șase', 'Titlu șapte', 'Titlu opt',
  'Titlu nouă', 'Titlu zece', 'Titlu unsprezece', 'Titlu doisprezece']
const D = ['Descriere unu, suficient de clară.', 'Descriere doi, tot clară.', 'Descriere trei.', 'Descriere patru.']

function camp(over: Partial<Campaign> = {}): Campaign {
  return {
    name: 'SE | Search | Test', id: null, status: 'PAUSED', daily_budget: 8,
    bidding: { strategy: 'MANUAL_CPC', max_cpc: 0.35 },
    conversion_goal: { name: 'Comision Profitshare', conversion_action_id: '7799099014' },
    targeting: { countries: ['RO'], languages: ['ro'], location_mode: 'PRESENCE', networks: { search: true, search_partners: false, display: false } },
    negative_keywords: [...BASE_NEGATIVES, ...RETAILER_BRANDS],
    ad_groups: [{
      name: 'Grup', id: null, final_url: URL_P,
      keywords: { exact: ['telefon test pret'], phrase: ['telefon test'] },
      ads: [{ type: 'RSA', id: null, headlines: [...H], descriptions: [...D], path1: 'telefon', path2: 'test' }],
    }],
    extensions: {
      sitelinks: [1, 2, 3, 4].map((i) => ({ text: `Link ${i}`, url: `https://www.superieftin.ro/c/x${i}` })),
      callouts: ['Mediana pe 30 de zile'],
    },
    ...over,
  }
}
function cf(c: Campaign, slug = 'test'): CampaignFile {
  const raw = stringify({ campaign: c })
  return { file: `/tmp/${slug}.yaml`, rel: `ads/campaigns/${slug}.yaml`, slug, raw, campaign: c }
}
const errors = (c: Campaign) => validateCampaign(cf(c), G).filter((i) => i.level === 'error').map((i) => i.msg)
const hasErr = (c: Campaign, re: RegExp) => errors(c).some((m) => re.test(m))

test('campania de bază trece validarea statică', () => {
  assert.deepEqual(errors(camp()), [])
})

test('limite de caractere RSA: titlu > 30, descriere > 90, path > 15', () => {
  const c = camp()
  c.ad_groups[0].ads[0].headlines[0] = 'x'.repeat(31)
  assert.ok(hasErr(c, /are 31 caractere \(max 30\)/))
  const c2 = camp()
  c2.ad_groups[0].ads[0].descriptions[0] = 'y'.repeat(91)
  assert.ok(hasErr(c2, /are 91 caractere \(max 90\)/))
  const c3 = camp()
  c3.ad_groups[0].ads[0].path1 = 'p'.repeat(16)
  assert.ok(hasErr(c3, /path1 .* 16 caractere/))
  // diacriticele conteaza ca un singur caracter
  const c4 = camp()
  c4.ad_groups[0].ads[0].headlines[0] = 'ș'.repeat(30)
  assert.deepEqual(errors(c4), [])
})

test('minim 8 titluri și 3 descrieri; sub țintă = avertisment', () => {
  const c = camp()
  c.ad_groups[0].ads[0].headlines = H.slice(0, 7)
  assert.ok(hasErr(c, /7 titluri \(minim 8\)/))
  const c2 = camp()
  c2.ad_groups[0].ads[0].descriptions = D.slice(0, 2)
  assert.ok(hasErr(c2, /2 descrieri \(minim 3\)/))
  const c3 = camp()
  c3.ad_groups[0].ads[0].headlines = H.slice(0, 9)
  const w = validateCampaign(cf(c3), G).filter((i) => i.level === 'warn').map((i) => i.msg)
  assert.ok(w.some((m) => /9 titluri \(țintă/.test(m)))
})

test('bugete și CPC peste guardrails sunt refuzate', () => {
  assert.ok(hasErr(camp({ daily_budget: 51 }), /depășește plafonul de 50/))
  assert.ok(hasErr(camp({ bidding: { strategy: 'MANUAL_CPC', max_cpc: 3.5 } }), /depășește CPC-ul maxim de 3/))
  assert.ok(hasErr(camp({ bidding: { strategy: 'TARGET_ROAS', max_cpc: 1 } }), /nu e permisă/))
  const c = camp()
  c.ad_groups[0].max_cpc = 0.5
  assert.ok(hasErr(c, /depășește CPC-ul maxim al campaniei/))
  // suma pe toate fisierele
  const many = [1, 2, 3, 4].map((i) => cf(camp({ name: `SE | T${i}`, daily_budget: 40, ad_groups: [{ ...camp().ad_groups[0], keywords: { exact: [`kw ${i}`] } }] }), `t${i}`))
  assert.ok(validateAll(many, G).some((i) => /suma bugetelor zilnice 160/.test(i.msg)))
})

test('statusul trebuie PAUSED, rețeaua doar Search, locația PRESENCE', () => {
  assert.ok(hasErr(camp({ status: 'ENABLED' }), /PAUSED/))
  const c = camp()
  c.targeting!.networks!.display = true
  assert.ok(hasErr(c, /networks\.display|doar rețeaua Search/))
  const c2 = camp()
  c2.targeting!.location_mode = 'PRESENCE_OR_INTEREST'
  assert.ok(hasErr(c2, /PRESENCE/))
  assert.ok(hasErr(camp({ targeting: { ...camp().targeting, countries: ['HU'] } }), /țara HU nu e permisă/))
})

test('cuvinte cheie: fără broad, fără retaileri, exact_only, negative obligatorii', () => {
  const c = camp()
  c.ad_groups[0].keywords.broad = ['telefon']
  assert.ok(hasErr(c, /broad match nu e permis/))
  const c2 = camp()
  c2.ad_groups[0].keywords.exact = ['iphone emag']
  assert.ok(hasErr(c2, /brandul retailerului „emag”/))
  assert.ok(hasErr(camp({ exact_only: true }), /exact_only/))
  assert.ok(hasErr(camp({ negative_keywords: ['gratis'] }), /lipsesc negativele obligatorii: .*evomag/))
})

test('cuvânt cheie blocat de propriile negative', () => {
  const c = camp()
  c.negative_keywords = [...c.negative_keywords!, 'pret']
  assert.ok(hasErr(c, /blocat de propriul negativ pret/))
})

test('semantica negativelor: broad / phrase / exact', () => {
  assert.equal(negativeBlocks(parseNegative('orange'), 'iphone 17 pro max orange'), true)
  assert.equal(negativeBlocks(parseNegative('"orange romania"'), 'iphone 17 pro max orange'), false)
  assert.equal(negativeBlocks(parseNegative('ce este'), 'este ce telefon'), true)        // broad: orice ordine
  assert.equal(negativeBlocks(parseNegative('"ce este"'), 'este ce telefon'), false)     // phrase: ordinea conteaza
  assert.equal(negativeBlocks(parseNegative('[z flip 7]'), 'z flip 7 fe'), false)        // exact: doar identic
  assert.equal(negativeBlocks(parseNegative('[z flip 7]'), 'z flip 7'), true)
  assert.equal(negativeBlocks(parseNegative('fold 6'), 'samsung z fold 7 256gb'), false)
})

test('duplicate de cuvinte cheie între grupuri/campanii', () => {
  const a = cf(camp(), 'a')
  const b = cf(camp({ name: 'SE | Search | Alta' }), 'b')
  assert.ok(validateAll([a, b], G).some((i) => /apare și în/.test(i.msg)))
})

test('URL-uri: doar www.superieftin.ro, fără /go/, fără categorii excluse', () => {
  const c = camp(); c.ad_groups[0].final_url = 'https://www.superieftin.ro/go/19502'
  assert.ok(hasErr(c, /nu poate fi \/go\//))
  const c2 = camp(); c2.ad_groups[0].final_url = 'https://superieftin.ro/p/x'
  assert.ok(hasErr(c2, /www\.superieftin\.ro/))
  const c3 = camp(); c3.ad_groups[0].final_url = 'https://www.superieftin.ro/reduceri-reale/sanatate-naturale'
  assert.ok(hasErr(c3, /categorie exclusă/))
  const c4 = camp(); c4.ad_groups[0].final_url = 'https://www.emag.ro/x'
  assert.ok(hasErr(c4, /www\.superieftin\.ro/))
})

test('stil: majuscule excesive, „!” în titlu, punctuație repetată, emoji', () => {
  assert.ok(styleProblems('REDUCERI mari', 'headline').some((p) => /majuscule/.test(p)))
  assert.ok(styleProblems('Galaxy 256GB RAM', 'headline').length === 0)
  assert.ok(styleProblems('Super ofertă!', 'headline').some((p) => /titluri/.test(p)))
  assert.ok(styleProblems('Ce preț!!', 'description').some((p) => /repetată/.test(p)))
  assert.ok(styleProblems('Preț bun 🔥', 'description').some((p) => /emoji/.test(p)))
  assert.ok(styleProblems('Preț ★ mic', 'description').some((p) => /simboluri/.test(p)))
})

const page = (over: Partial<PageFacts> = {}): PageFacts => ({
  url: URL_P, status: 200, text: 'Samsung Galaxy Z Fold7 Reducere reală: 16,8 % sub mediana de 30 de zile',
  noindex: false, discountPct: 16.8, inStock: true, categories: ['telefoane-mobile'], ...over,
})

test('afirmații (regula 9): procentul trebuie să corespundă paginii', () => {
  assert.deepEqual(claimIssues(['Reducere de 16% azi'], page(), 'x'), [])
  assert.deepEqual(claimIssues(['Reducere de 16,8% azi'], page(), 'x'), [])
  assert.equal(claimIssues(['Reducere de 17% azi'], page(), 'x').length, 1)
  assert.equal(claimIssues(['Reducere de 15% azi'], page(), 'x').length, 1)   // prea mic: nu „coincide”
  assert.equal(claimIssues(['Reducere de 16% azi'], page({ discountPct: null }), 'x').length >= 1, true)
})

test('afirmații: „sub mediană” cere insigna Reducere reală pe pagina de produs', () => {
  assert.deepEqual(claimIssues(['Galaxy Z Fold7 sub mediană'], page(), 'x'), [])
  assert.ok(claimIssues(['Galaxy Z Fold7 sub mediană'], page({ discountPct: null }), 'x').some((i) => /nu mai afișează/.test(i.msg)))
})

test('afirmații: marca din anunț trebuie să apară pe pagină', () => {
  assert.ok(claimIssues(['iPhone 17 Pro Max'], page(), 'x').some((i) => /marca „iphone”/.test(i.msg)))
  assert.deepEqual(claimIssues(['Samsung Galaxy'], page(), 'x'), [])
})

test('parsePage extrage reducerea, stocul și categoriile din HTML-ul real', () => {
  const html = `<html><head><meta name="robots" content="index, follow"/></head><body>
    <script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","category":"telefoane-mobile","offers":[{"@type":"Offer","availability":"https://schema.org/InStock"}]}</script>
    <script type="application/ld+json">{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":2,"name":"telefoane mobile","item":"https://www.superieftin.ro/c/telefoane-mobile"}]}</script>
    <p class="font-semibold">Reducere reală: <!-- -->16,8<!-- -->% sub mediana de 30 de zile</p></body></html>`
  const p = parsePage(URL_P, 200, html)
  assert.equal(p.discountPct, 16.8)
  assert.equal(p.inStock, true)
  assert.equal(p.noindex, false)
  assert.deepEqual(p.categories, ['telefoane-mobile'])
  const p2 = parsePage(URL_P, 200, '<meta name="robots" content="noindex, follow"/>')
  assert.equal(p2.noindex, true)
  assert.equal(p2.discountPct, null)
})

test('hash-ul pentru policy-reviewer ignoră id-urile, nu și conținutul', () => {
  const raw = stringify({ campaign: camp() })
  const withIds = writeIds(raw, [{ path: ['campaign', 'id'], value: '123' }, { path: ['campaign', 'ad_groups', 0, 'ads', 0, 'id'], value: '456' }])
  assert.notEqual(raw, withIds)
  assert.equal(contentHash(raw), contentHash(withIds))
  const changed = stringify({ campaign: camp({ daily_budget: 9 }) })
  assert.notEqual(contentHash(raw), contentHash(changed))
})

test('writeIds păstrează comentariile', () => {
  const raw = '# comentariu important\ncampaign:\n  name: "SE | X"   # nume\n  id: null\n'
  const out = writeIds(raw, [{ path: ['campaign', 'id'], value: '777' }])
  assert.match(out, /# comentariu important/)
  assert.match(out, /# nume/)
  assert.match(out, /id: "777"|id: '777'|id: 777/)
})

test('verdict policy-reviewer: lipsă, hash greșit, vechi, valid', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'review-'))
  const f = cf(camp(), 'rev')
  const now = new Date('2026-09-27T12:00:00Z')
  assert.equal(checkReview(f, now, dir).ok, false)
  const write = (o: object) => writeFileSync(path.join(dir, 'rev.pass'), stringify(o))
  write({ verdict: 'PASS', date: '2026-09-27T10:00:00Z', sha256: 'deadbeef' })
  assert.match(checkReview(f, now, dir).reason, /hash-ul nu corespunde/)
  write({ verdict: 'FAIL', date: '2026-09-27T10:00:00Z', sha256: contentHash(f.raw) })
  assert.equal(checkReview(f, now, dir).ok, false)
  write({ verdict: 'PASS', date: '2026-09-10T10:00:00Z', sha256: contentHash(f.raw) })
  assert.match(checkReview(f, now, dir).reason, /vechi/)
  write({ verdict: 'PASS', date: '2026-09-27T10:00:00Z', sha256: contentHash(f.raw) })
  assert.equal(checkReview(f, now, dir).ok, true)
})

// --- Planul -------------------------------------------------------------------------------------

function acc(over: Partial<AccountSnapshot> = {}): AccountSnapshot {
  return { ...emptySnapshot(), conversionActions: [{ id: '7799099014', name: 'Comision Profitshare', status: 'ENABLED', primaryForGoal: true }], ...over }
}

test('plan pentru campanie nouă: campanie, grupuri și anunțuri PAUSED, doar Search, prezență', () => {
  const plan = buildPlan([cf(camp())], acc(), '111')
  const ops = planOps(plan)
  const campaignOp: any = ops.find((o) => 'campaignOperation' in o.op)!.op.campaignOperation
  assert.equal(campaignOp.create.status, 'PAUSED')
  assert.equal(campaignOp.create.advertisingChannelType, 'SEARCH')
  assert.deepEqual(campaignOp.create.networkSettings, { targetGoogleSearch: true, targetSearchNetwork: false, targetContentNetwork: false, targetPartnerSearchNetwork: false })
  assert.equal(campaignOp.create.geoTargetTypeSetting.positiveGeoTargetType, 'PRESENCE')
  for (const o of ops) {
    const op: any = o.op
    if (op.adGroupOperation?.create) assert.equal(op.adGroupOperation.create.status, 'PAUSED')
    if (op.adGroupAdOperation?.create) assert.equal(op.adGroupAdOperation.create.status, 'PAUSED')
    if (op.campaignOperation?.update?.status || op.adGroupOperation?.update?.status === 'ENABLED') assert.fail('planul nu are voie să activeze nimic')
  }
  assert.equal((ops.find((o) => 'campaignBudgetOperation' in o.op)!.op as any).campaignBudgetOperation.create.amountMicros, '8000000')
  assert.equal((ops.find((o) => 'adGroupOperation' in o.op)!.op as any).adGroupOperation.create.cpcBidMicros, '350000')
  // obiectivul de conversie personalizat: creat o data, legat de campanie
  assert.equal(plan.sharedOps.length, 1)
  assert.ok(ops.some((o) => 'conversionGoalCampaignConfigOperation' in o.op))
  // ID-urile temporare sunt unice
  const rns = ops.map((o) => (Object.values(o.op)[0] as any)?.create?.resourceName).filter(Boolean)
  assert.equal(new Set(rns).size, rns.length)
  assert.equal(plan.errors.length, 0)
})

test('plan pe campanie existentă: nimic de schimbat → zero operații; ce lipsește din YAML → pauză', () => {
  const c = camp({ id: '10' })
  c.ad_groups[0].id = '20'
  c.ad_groups[0].ads[0].id = '30'
  c.extensions = {}
  c.negative_keywords = [...BASE_NEGATIVES, ...RETAILER_BRANDS]
  const snap = acc({
    campaigns: [{ id: '10', name: c.name, status: 'ENABLED', resourceName: 'customers/111/campaigns/10', channelType: 'SEARCH', biddingStrategyType: 'MANUAL_CPC', cpcCeilingMicros: null,
      network: { googleSearch: true, searchNetwork: false, contentNetwork: false, partnerSearchNetwork: false }, positiveGeoTargetType: 'PRESENCE',
      budgetResourceName: 'customers/111/campaignBudgets/5', budgetId: '5', budgetMicros: 8_000_000, budgetShared: false }],
    criteria: [
      { campaignId: '10', criterionId: '2642', resourceName: 'r/geo', type: 'LOCATION', negative: false, geo: 'geoTargetConstants/2642' },
      { campaignId: '10', criterionId: '1032', resourceName: 'r/lang', type: 'LANGUAGE', negative: false, lang: 'languageConstants/1032' },
      ...c.negative_keywords!.map((n, i) => { const k = parseNegative(n); return { campaignId: '10', criterionId: `n${i}`, resourceName: `r/n${i}`, type: 'KEYWORD', negative: true, text: k.text, matchType: k.matchType } }),
    ],
    adGroups: [{ id: '20', campaignId: '10', name: 'Grup', status: 'ENABLED', cpcMicros: 350_000, resourceName: 'customers/111/adGroups/20' },
      { id: '21', campaignId: '10', name: 'Grup vechi', status: 'ENABLED', cpcMicros: 350_000, resourceName: 'customers/111/adGroups/21' }],
    keywords: [
      { adGroupId: '20', criterionId: '1', resourceName: 'r/k1', text: 'telefon test pret', matchType: 'EXACT', status: 'ENABLED', negative: false },
      { adGroupId: '20', criterionId: '2', resourceName: 'r/k2', text: 'telefon test', matchType: 'PHRASE', status: 'ENABLED', negative: false },
      { adGroupId: '20', criterionId: '3', resourceName: 'r/k3', text: 'telefon vechi', matchType: 'EXACT', status: 'ENABLED', negative: false },
    ],
    ads: [{ adGroupId: '20', adId: '30', resourceName: 'customers/111/adGroupAds/20~30', adResourceName: 'customers/111/ads/30', status: 'ENABLED', type: 'RESPONSIVE_SEARCH_AD',
      finalUrls: [URL_P], headlines: [...H], descriptions: [...D], path1: 'telefon', path2: 'test', approval: 'APPROVED' }],
    customGoals: [{ id: '9', name: 'SE | Comision Profitshare', resourceName: 'customers/111/customConversionGoals/9', actions: ['customers/111/conversionActions/7799099014'], status: 'ENABLED' }],
    goalConfigs: [{ campaignId: '10', level: 'CAMPAIGN', customGoal: 'customers/111/customConversionGoals/9' }],
  })
  const plan = buildPlan([cf(c)], snap, '111')
  const ops = planOps(plan)
  assert.deepEqual(ops.map((o) => o.kind).sort(), ['pause', 'pause'])
  assert.ok(ops.some((o) => /telefon vechi/.test(o.label)))
  assert.ok(ops.some((o) => /Grup vechi/.test(o.label)))
  // statusul ENABLED al campaniei (activata de proprietar) NU e atins
  assert.ok(!ops.some((o) => 'campaignOperation' in o.op))

  // buget schimbat in YAML → o singura modificare de buget
  const plan2 = buildPlan([cf({ ...c, daily_budget: 12 })], snap, '111')
  const upd = planOps(plan2).filter((o) => o.kind === 'update')
  assert.equal(upd.length, 1)
  assert.equal((upd[0].op as any).campaignBudgetOperation.update.amountMicros, '12000000')
})

test('plan: campanie cu id din YAML care lipsește din cont = eroare (nu recreează pe ascuns)', () => {
  const plan = buildPlan([cf(camp({ id: '999' }))], acc(), '111')
  assert.ok(plan.campaigns[0].errors.some((e) => /nu există în cont/.test(e)))
})

test('fișierele reale din ads/campaigns trec validarea statică', () => {
  const files = loadAllCampaigns()
  assert.ok(files.length >= 3)
  const errs = validateAll(files, loadGuardrails()).filter((i) => i.level === 'error')
  assert.deepEqual(errs, [])
  for (const f of files) {
    const plan = buildPlan([f], acc(), '111')
    assert.equal(plan.campaigns[0].errors.length, 0)
  }
})
