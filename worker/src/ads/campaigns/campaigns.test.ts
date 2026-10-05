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
import { validateCampaign, validateAll, negativeBlocks, styleProblems, claimIssues, parsePage, expiringClaims, BASE_NEGATIVES, RETAILER_BRANDS, createPageLoader, landingProblems, type PageFacts, type Fetcher } from './validate.js'
import { checkReview } from './review.js'
import { buildPlan, planOps, findCustomGoal } from './plan.js'
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
    conversion_goal: { name: 'Comision afiliere', conversion_action_id: '7799099014' },
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

test('afirmații care expiră (B1): reducerea „de azi” e respinsă în orice text', () => {
  for (const x of ['Galaxy Z Fold7 sub mediană', 'Z Fold7: reducere reală', 'Z Fold7 256GB la preț redus',
    'Sub mediana de 30 de zile', 'Doar reduceri reale', 'iPhone 17 Pro Max -8%', 'Reducere 16,8 %',
    'Telefonul s-a ieftinit', 'Mai ieftin azi', 'Cel mai mic preț', 'Prețul a scăzut', 'Economisești 500 de lei',
    'Ofertă specială', 'Discount la Fold7', 'Preț minim garantat']) {
    assert.ok(expiringClaims(x).length > 0, `ar trebui respins: ${x}`)
  }
  for (const x of ['Comparăm cu mediana pe 30 zile', 'Istoric de preț pe 90 de zile', 'Nu comparăm cu prețul vechi',
    'Alertă de preț pe Telegram', 'Prețuri verificate zilnic', 'Vezi prețul Z Fold7 de azi', 'Preț iPhone 17 Pro Max azi',
    'Minim, maxim și mediană', 'Setează o alertă de preț pe Telegram și află când telefonul se ieftinește.',
    'Samsung Galaxy Z Fold7 256GB', 'superieftin.ro']) {
    assert.deepEqual(expiringClaims(x), [], `ar trebui permis: ${x}`)
  }
  // sitelink spre o pagina de lista (nu /p/): „reduceri” / „sub mediana” permise; procentul nu
  assert.deepEqual(expiringClaims('Doar prețuri sub mediană', { listingPage: true }), [])
  assert.deepEqual(expiringClaims('Cum verificăm reducerile', { listingPage: true }), [])
  assert.ok(expiringClaims('Reduceri de 20%', { listingPage: true }).length > 0)
  assert.ok(expiringClaims('Telefon la preț redus', { listingPage: true }).length > 0)
})

test('validarea statică respinge reducerea „de azi” în titluri, sitelinks de produs, callouts, snippets', () => {
  const c = camp(); c.ad_groups[0].ads[0].headlines[0] = 'Telefon test sub mediană'
  assert.ok(hasErr(c, /afirmă o reducere de azi/))
  const c2 = camp(); c2.extensions!.callouts = ['Doar reduceri reale']
  assert.ok(hasErr(c2, /afirmă o reducere de azi/))
  const c3 = camp(); c3.extensions!.sitelinks![0] = { text: 'Telefon test', url: URL_P, description1: 'Preț sub mediana de 30 de zile', description2: 'Istoric de preț' }
  assert.ok(hasErr(c3, /afirmă o reducere de azi/))
  const c4 = camp(); c4.extensions!.sitelinks![0] = { text: 'Reduceri la telefoane', url: 'https://www.superieftin.ro/reduceri-reale/telefoane-mobile', description1: 'Doar prețuri sub mediană', description2: 'Verificate față de 30 de zile' }
  assert.deepEqual(errors(c4), [])
  const c5 = camp(); c5.extensions!.structured_snippets = [{ header: 'Servicii', values: ['Istoric de preț', 'Preț redus azi', 'Alerte de preț'] }]
  assert.ok(hasErr(c5, /afirmă o reducere de azi/))
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

// Decizia SEO din 5 oct. 2026: /p/ e noindex si pentru produsele urmarite de sub 30 de zile,
// nemapate sau din Sanatate & Naturale. noindex SINGUR nu mai respinge un landing de produs in stoc.
const ldProduct = (avail: 'InStock' | 'OutOfStock') =>
  `<script type="application/ld+json">{"@type":"Product","offers":{"@type":"AggregateOffer","availability":"https://schema.org/${avail}"}}</script>`
const pageFetcher = (body: string): Fetcher => async () => ({ status: 200, body })

test('landing: noindex + InStock (produs urmărit de < 30 de zile) → OK', async () => {
  const html = `<head><meta name="robots" content="noindex, follow"/></head>${ldProduct('InStock')}`
  assert.deepEqual(await landingProblems(URL_P, createPageLoader(pageFetcher(html)), G, { strictStock: true }), [])
})

test('landing: noindex + OutOfStock / fără ofertă → eșec, ca înainte', async () => {
  const out = `<head><meta name="robots" content="noindex, follow"/></head>${ldProduct('OutOfStock')}`
  const p1 = await landingProblems(URL_P, createPageLoader(pageFetcher(out)), G)
  assert.ok(p1.some((m) => /noindex/.test(m)))
  assert.ok(p1.some((m) => /nicio ofertă în stoc/.test(m)))
  // fara JSON-LD Product (produs indisponibil) → tot noindex = esec
  const none = '<head><meta name="robots" content="noindex, follow"/></head><h1>Telefon</h1>'
  assert.ok((await landingProblems(URL_P, createPageLoader(pageFetcher(none)), G)).some((m) => /noindex/.test(m)))
  // noindex pe o lista (/reduceri-reale/, fara JSON-LD Product) ramane esec
  const lst = 'https://www.superieftin.ro/reduceri-reale/telefoane-mobile'
  assert.ok((await landingProblems(lst, createPageLoader(pageFetcher(none)), G)).some((m) => /noindex/.test(m)))
})

test('parsePage: cardul de verdict din redesign („Reducere reală” + „Prețul de azi e cu X% sub mediana”)', () => {
  const card = `<section><span>Reducere reală</span><span>−18,1%</span>
    <p>Prețul de azi e cu <b>18,1<!-- -->% sub mediana</b> pe 30 de zile (2.489,99 RON).</p></section>`
  assert.equal(parsePage(URL_P, 200, card).discountPct, 18.1)
  // fraza fara titlul „Reducere reală” lipit de ea nu e o reducere — nici cand subsolul (prezent pe
  // ORICE pagina) contine „Reducere reală = minimum 5% sub mediană”
  const footer = '<footer><p>Reducere reală = minimum 5% sub mediană.</p></footer>'
  assert.equal(parsePage(URL_P, 200, '<p>Prețul de azi e cu <b>18,1% sub mediana</b> pe 30 de zile.</p>' + footer).discountPct, null)
  assert.equal(parsePage(URL_P, 200, footer + '<p>Prețul de azi e cu <b>18,1% sub mediana</b> pe 30 de zile.</p>').discountPct, null)
  // titlul si fraza cu procente diferite → nu confirmam
  assert.equal(parsePage(URL_P, 200, '<span>Reducere reală</span><span>−25%</span><p>Prețul de azi e cu 18,1% sub mediana pe 30 de zile.</p>').discountPct, null)
  // cardul real cu subsol → procentul cardului
  assert.equal(parsePage(URL_P, 200, card + footer).discountPct, 18.1)
  // celelalte stari ale cardului: fara reducere
  for (const html of [
    '<span>Preț obișnuit</span><p>Prețul de azi e la <b>2% sub mediană</b> (mediana pe 30 de zile: 2.449,99 RON), în intervalul obișnuit. Nu e o reducere reală.</p>',
    '<span>Peste prețul obișnuit</span><p>Prețul de azi e cu <b>8,2% peste mediana</b> pe 30 de zile (2.449,99 RON).</p>',
    '<span>Monitorizăm prețul</span><p>Avem încă prea puține prețuri înregistrate pentru o mediană pe 30 de zile, deci nu putem spune dacă e o reducere reală.</p>',
  ]) {
    assert.equal(parsePage(URL_P, 200, html).discountPct, null, html)
    assert.equal(parsePage(URL_P, 200, html + footer).discountPct, null, html + ' + subsol')
  }
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
  return { ...emptySnapshot(), conversionActions: [{ id: '7799099014', name: 'Comision afiliere', status: 'ENABLED', primaryForGoal: true }], ...over }
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
    customGoals: [{ id: '9', name: 'SE | Comision afiliere', resourceName: 'customers/111/customConversionGoals/9', actions: ['customers/111/conversionActions/7799099014'], status: 'ENABLED' }],
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
    // Dupa ads:apply, YAML-ul are ID-urile din cont; contul simulat aici e gol, deci planul ar
    // raporta corect „nu exista in cont”. Verificam doar structura (fara ID-uri) — potrivirea cu
    // contul real o face `ads:plan`.
    if (f.campaign.id) continue
    const plan = buildPlan([f], acc(), '111')
    assert.equal(plan.campaigns[0].errors.length, 0)
  }
})

// --- Redenumirea „Comision Profitshare” → „Comision afiliere” (aprobata 2026-10-03) -------------
// Contul pastreaza numele vechi pana il schimba proprietarul manual: planul trebuie sa
// identifice actiunea si obiectivul dupa ID, fara sa creeze nimic nou.

test('plan în tranziție: cont cu numele vechi (acțiune + obiectiv) → zero operații, doar avertisment', () => {
  const c = camp({ id: '10' })
  c.ad_groups = []
  c.extensions = {}
  const snap = acc({
    conversionActions: [{ id: '7799099014', name: 'Comision Profitshare', status: 'ENABLED', primaryForGoal: true }],
    campaigns: [{ id: '10', name: c.name, status: 'PAUSED', resourceName: 'customers/111/campaigns/10', channelType: 'SEARCH', biddingStrategyType: 'MANUAL_CPC', cpcCeilingMicros: null,
      network: { googleSearch: true, searchNetwork: false, contentNetwork: false, partnerSearchNetwork: false }, positiveGeoTargetType: 'PRESENCE',
      budgetResourceName: 'customers/111/campaignBudgets/5', budgetId: '5', budgetMicros: 8_000_000, budgetShared: false }],
    criteria: [
      { campaignId: '10', criterionId: '2642', resourceName: 'r/geo', type: 'LOCATION', negative: false, geo: 'geoTargetConstants/2642' },
      { campaignId: '10', criterionId: '1032', resourceName: 'r/lang', type: 'LANGUAGE', negative: false, lang: 'languageConstants/1032' },
      ...c.negative_keywords!.map((n, i) => { const k = parseNegative(n); return { campaignId: '10', criterionId: `n${i}`, resourceName: `r/n${i}`, type: 'KEYWORD', negative: true, text: k.text, matchType: k.matchType } }),
    ],
    customGoals: [{ id: '9', name: 'SE | Comision Profitshare', resourceName: 'customers/111/customConversionGoals/9', actions: ['customers/111/conversionActions/7799099014'], status: 'ENABLED' }],
    goalConfigs: [{ campaignId: '10', level: 'CAMPAIGN', customGoal: 'customers/111/customConversionGoals/9' }],
  })
  const plan = buildPlan([cf(c)], snap, '111')
  assert.equal(plan.errors.length, 0)
  assert.equal(plan.sharedOps.length, 0, 'nu creează un al doilea obiectiv')
  assert.deepEqual(planOps(plan), [], 'campania rămâne pe obiectivul existent')
  assert.ok(plan.warnings.some((w) => /numele vechi „Comision Profitshare”/.test(w) && /redenumește-o manual/.test(w)))
  assert.ok(plan.warnings.some((w) => /SE \| Comision Profitshare/.test(w)))
})

test('findCustomGoal — nume nou, nume vechi, apoi orice obiectiv care conține DOAR acțiunea (după ID)', () => {
  const rn = 'customers/111/conversionActions/7799099014'
  const g = (id: string, name: string, actions = [rn], status = 'ENABLED') => ({ id, name, resourceName: `customers/111/customConversionGoals/${id}`, actions, status })
  assert.equal(findCustomGoal([g('1', 'SE | Comision Profitshare'), g('2', 'SE | Comision afiliere')], 'Comision afiliere', rn)?.id, '2')
  assert.equal(findCustomGoal([g('1', 'SE | Comision Profitshare')], 'Comision afiliere', rn)?.id, '1')
  assert.equal(findCustomGoal([g('3', 'Obiectivul meu')], 'Comision afiliere', rn)?.id, '3')
  assert.equal(findCustomGoal([g('4', 'Mixt', [rn, 'customers/111/conversionActions/1'])], 'Comision afiliere', rn), undefined)
  assert.equal(findCustomGoal([g('5', 'SE | Comision afiliere', [rn], 'REMOVED')], 'Comision afiliere', rn), undefined)
})

// --- Audiente (remarketing pe Search, Observare) ------------------------------------------------

const LIST = { id: '555', name: 'SE | Produs văzut, fără click 7z', resourceName: 'customers/111/userLists/555', type: 'REMARKETING',
  membershipStatus: 'OPEN', membershipLifeSpan: 30, eligibleForSearch: true, sizeForSearch: 0, sizeRangeForSearch: 'LESS_THAN_FIVE_HUNDRED' }
const AUD = { mode: 'OBSERVATION' as const, segments: [{ name: LIST.name, user_list_id: '555', bid_modifier: 1.25 }] }

test('audiențe: validare — doar OBSERVATION, ajustare -50%…+50%, CPC × ajustare ≤ guardrails', () => {
  assert.deepEqual(errors(camp({ audiences: AUD })), [])
  assert.ok(hasErr(camp({ audiences: { ...AUD, mode: 'TARGETING' } }), /TARGETING/))
  assert.ok(hasErr(camp({ audiences: { mode: 'OBSERVATION', segments: [] } }), /nicio listă/))
  assert.ok(hasErr(camp({ audiences: { mode: 'OBSERVATION', segments: [{ name: 'x', user_list_id: '555', bid_modifier: 2 }] } }), /în afara intervalului/))
  assert.ok(hasErr(camp({ audiences: { mode: 'OBSERVATION', segments: [{ name: 'x', user_list_id: 'abc' }] } }), /invalid/))
  assert.ok(hasErr(camp({ audiences: { mode: 'OBSERVATION', segments: [{ name: 'x', user_list_id: '1' }, { name: 'y', user_list_id: '1' }] } }), /duplicat/))
  // CPC 2,50 × 1,25 = 3,13 > 3 (guardrails) → refuzat; 2,40 × 1,25 = 3,00 → trece
  const c1 = camp({ audiences: AUD, bidding: { strategy: 'MANUAL_CPC', max_cpc: 2.5 } })
  assert.ok(hasErr(c1, /depășește CPC-ul maxim/))
  assert.ok(!hasErr(camp({ audiences: AUD, bidding: { strategy: 'MANUAL_CPC', max_cpc: 2.4 } }), /depășește CPC-ul maxim/))
  // fara audiences = nicio verificare (si niciun avertisment)
  assert.ok(!validateCampaign(cf(camp()), G).some((i) => /audiences/.test(i.where)))
})

test('audiențe: campanie nouă → setare Observare în create + listă cu ajustare', () => {
  const plan = buildPlan([cf(camp({ audiences: AUD }))], acc({ userLists: [LIST] }), '111')
  const ops = planOps(plan)
  const create: any = (ops.find((o) => 'campaignOperation' in o.op)!.op as any).campaignOperation.create
  assert.deepEqual(create.targetingSetting, { targetRestrictions: [{ targetingDimension: 'AUDIENCE', bidOnly: true }] })
  const crit: any = ops.find((o) => (o.op as any).campaignCriterionOperation?.create?.userList)!.op
  assert.equal(crit.campaignCriterionOperation.create.userList.userList, 'customers/111/userLists/555')
  assert.equal(crit.campaignCriterionOperation.create.bidModifier, 1.25)
  assert.equal(crit.campaignCriterionOperation.create.campaign, create.resourceName)
  // lista sub 100 de utilizatori: avertisment, nu eroare
  assert.ok(plan.campaigns[0].warnings.some((w) => /sub 100/.test(w)))
  assert.equal(plan.campaigns[0].errors.length, 0)
  // fara audiences: nicio setare de audienta in create
  const plain: any = planOps(buildPlan([cf(camp())], acc({ userLists: [LIST] }), '111')).find((o) => 'campaignOperation' in o.op)!.op
  assert.equal(plain.campaignOperation.create.targetingSetting, undefined)
})

test('audiențe: campanie existentă — adăugare, modificare ajustare, eliminare, listă inexistentă', () => {
  const base: AccountSnapshot['campaigns'][number] = { id: '10', name: 'SE | Search | Test', status: 'PAUSED', resourceName: 'customers/111/campaigns/10', channelType: 'SEARCH',
    biddingStrategyType: 'MANUAL_CPC', cpcCeilingMicros: null, network: { googleSearch: true, searchNetwork: false, contentNetwork: false, partnerSearchNetwork: false },
    positiveGeoTargetType: 'PRESENCE', budgetResourceName: 'b', budgetId: '5', budgetMicros: 8_000_000, budgetShared: false, targetRestrictions: [] }
  const c = camp({ id: '10', audiences: AUD })
  const audOps = (snap: AccountSnapshot) => planOps(buildPlan([cf(c)], snap, '111'))
    .filter((o) => /audiențe|listă/.test(o.label))
  // 1. nimic in cont → Observare + lista noua
  let ops = audOps(acc({ campaigns: [base], userLists: [LIST] }))
  assert.deepEqual(ops.map((o) => o.kind), ['update', 'create'])
  assert.equal((ops[0].op as any).campaignOperation.updateMask, 'targetingSetting.targetRestrictions')
  assert.deepEqual((ops[0].op as any).campaignOperation.update.targetingSetting.targetRestrictions, [{ targetingDimension: 'AUDIENCE', bidOnly: true }])
  // 2. deja la zi → zero operatii
  const crit = { campaignId: '10', criterionId: '7', resourceName: 'customers/111/campaignCriteria/10~7', type: 'USER_LIST', negative: false, userList: LIST.resourceName, bidModifier: 1.25 }
  const upToDate = { ...base, targetRestrictions: [{ targetingDimension: 'AUDIENCE', bidOnly: true }] }
  assert.deepEqual(audOps(acc({ campaigns: [upToDate], userLists: [LIST], criteria: [crit] })), [])
  // 3. ajustare diferita → update bidModifier
  ops = audOps(acc({ campaigns: [upToDate], userLists: [LIST], criteria: [{ ...crit, bidModifier: 1.1 }] }))
  assert.deepEqual(ops.map((o) => o.kind), ['update'])
  assert.equal((ops[0].op as any).campaignCriterionOperation.update.bidModifier, 1.25)
  // 4. lista din cont care nu e in YAML → eliminata; excluderile manuale (negative) → neatinse
  const other = { ...crit, criterionId: '8', resourceName: 'customers/111/campaignCriteria/10~8', userList: 'customers/111/userLists/999' }
  const excl = { ...crit, criterionId: '9', resourceName: 'customers/111/campaignCriteria/10~9', negative: true, userList: 'customers/111/userLists/998' }
  ops = audOps(acc({ campaigns: [upToDate], userLists: [LIST], criteria: [crit, other, excl] }))
  assert.deepEqual(ops.map((o) => [o.kind, (o.op as any).campaignCriterionOperation.remove]), [['remove', 'customers/111/campaignCriteria/10~8']])
  // 5. lista inexistenta in cont → eroare de plan (apply refuza)
  const p5 = buildPlan([cf(c)], acc({ campaigns: [upToDate], userLists: [] }), '111')
  assert.ok(p5.campaigns[0].errors.some((e) => /nu există în cont/.test(e)))
  // 6. YAML fara audiences → listele din cont NU sunt atinse
  const p6 = planOps(buildPlan([cf(camp({ id: '10' }))], acc({ campaigns: [base], userLists: [LIST], criteria: [crit] }), '111'))
  assert.ok(!p6.some((o) => /audiențe|listă/.test(o.label)))
})
