// Teste pentru logica SEO pura (lib/seo/*): canonical/paginare, JSON-LD, sitemap, robots.txt,
// fraze despre pret, variante, llms.txt. Rulare: cd web && npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { listingSeo, listingDescription, parsePageParam } from './listing'
import { productLd, organizationLd, websiteLd, breadcrumbLd, itemListLd, isValidGtin, itemConditionFor, ldScript } from './jsonld'
import {
  urlsetXml, sitemapIndexXml, sitemapFileNames, parseSitemapFile, productSlice, productSitemapCount,
  latestLastmod, PRODUCTS_PER_SITEMAP,
} from './sitemap'
import { robotsRules, AI_BOTS } from './robots'
import { priceFacts, variantBase, historyPartialSince, historyTitle, historyChartPhrase } from './product-facts'
import { indexableCategories, landingCategories, isExcludedFromAds } from './categories'
import { buildLlmsTxt, buildLlmsFull, stripGuideMarkers } from './llms'
import { roCount, absUrl, lowerFirst, SITE_URL, ORGANIZATION_ID } from './site'

// --- canonical / paginare / noindex (/c/, /t/) ------------------------------------------------

const base = { basePath: '/c/telefoane-mobile', totalPages: 16, hasReorder: false, brand: null, empty: false }

test('listing: pagina 1 → canonical de baza, indexabila', () => {
  const s = listingSeo({ ...base, page: 1 })
  assert.deepEqual(s, { notFound: false, canonical: '/c/telefoane-mobile', robots: null, titleSuffix: '' })
})

test('listing: ?page=2 → canonical propriu + sufix in titlu', () => {
  const s = listingSeo({ ...base, page: 2 })
  assert.equal(s.canonical, '/c/telefoane-mobile?page=2')
  assert.equal(s.titleSuffix, ' — pagina 2')
  assert.equal(s.robots, null)
})

test('listing: ?page peste ultima pagina → 404; pagina 1 a unei liste goale nu e 404', () => {
  assert.equal(listingSeo({ ...base, page: 17 }).notFound, true)
  assert.equal(listingSeo({ ...base, page: 16 }).notFound, false)
  assert.equal(listingSeo({ ...base, totalPages: 0, page: 1, empty: true }).notFound, false)
  assert.equal(listingSeo({ ...base, totalPages: 0, page: 2, empty: true }).notFound, true)
})

test('listing: sortarea / ?tot=1 → canonical spre baza (si pe pagina 2)', () => {
  assert.equal(listingSeo({ ...base, page: 3, hasReorder: true }).canonical, '/c/telefoane-mobile')
})

test('listing: ?brand= → noindex, follow si canonical de baza', () => {
  const s = listingSeo({ ...base, page: 1, brand: 'Samsung' })
  assert.deepEqual(s.robots, { index: false, follow: true })
  assert.equal(s.canonical, '/c/telefoane-mobile')
})

test('listing: categorie fara produse disponibile → noindex, follow', () => {
  assert.deepEqual(listingSeo({ ...base, page: 1, totalPages: 0, empty: true }).robots, { index: false, follow: true })
})

test('parsePageParam: valori invalide → 1', () => {
  assert.equal(parsePageParam(undefined), 1)
  assert.equal(parsePageParam('abc'), 1)
  assert.equal(parsePageParam('-4'), 1)
  assert.equal(parsePageParam('3'), 3)
})

test('listingDescription: cifre live, fara promisiuni de reducere', () => {
  const d = listingDescription('Telefoane Mobile', { products: 756, retailers: 4, brands: 31, minPrice: 99.9 })
  assert.match(d, /^Telefoane Mobile: 756 de produse de la 4 magazine și 31 de mărci, cu istoric de preț\./)
  assert.match(d, /Prețuri de la 99,9/)
  assert.doesNotMatch(d, /%|garantat|economisești/i)
  assert.match(listingDescription('Monitoare', { products: 0, retailers: 0, brands: 0, minPrice: null }), /niciun produs disponibil/)
  assert.match(listingDescription('X', { products: 1, retailers: 1, brands: 1, minPrice: null }), /^X: 1 produs de la 1 magazin, cu istoric/)
})

test('roCount: „de” dupa regula romaneasca', () => {
  assert.equal(roCount(5, 'produse'), '5 produse')
  assert.equal(roCount(19, 'produse'), '19 produse')
  assert.equal(roCount(20, 'produse'), '20 de produse')
  assert.equal(roCount(101, 'produse'), '101 produse')
  assert.equal(roCount(120, 'produse'), '120 de produse')
  assert.equal(roCount(1000, 'produse'), '1.000 de produse')
  assert.equal(roCount(1, 'produse', 'produs'), '1 produs')
  assert.equal(roCount(0, 'produse'), '0 produse')
})

test('site: absUrl si lowerFirst', () => {
  assert.equal(absUrl('/p/x'), `${SITE_URL}/p/x`)
  assert.equal(absUrl('https://a.ro/b'), 'https://a.ro/b')
  assert.equal(lowerFirst('Suport TV'), 'suport TV')
  assert.equal(lowerFirst('Telefoane Mobile'), 'telefoane mobile')
})

// --- JSON-LD -----------------------------------------------------------------------------------

const product = {
  id: '42', name: 'Telefon X 128GB Negru', slug: 'telefon-x-128gb-negru', image: 'https://cdn/x.jpg',
  brand: 'Samsung', partNo: 'SM-A556B', tags: [] as string[],
  offers: [{ price: 1299.99, retailer: 'evomag' }, { price: 1349, retailer: 'ITGalaxy' }],
}

test('productLd: AggregateOffer cu low/high/count si Offer.url = pagina (nu /go/)', () => {
  const ld = productLd(product)!
  assert.equal(ld['@type'], 'Product')
  assert.equal(ld.url, `${SITE_URL}/p/telefon-x-128gb-negru`)
  assert.equal(ld.offers['@type'], 'AggregateOffer')
  assert.equal(ld.offers.lowPrice, 1299.99)
  assert.equal(ld.offers.highPrice, 1349)
  assert.equal(ld.offers.offerCount, 2)
  // ads:validate / ads-guard citesc availability de pe nodul offers
  assert.equal(ld.offers.availability, 'https://schema.org/InStock')
  for (const o of ld.offers.offers) {
    assert.equal(o.url, `${SITE_URL}/p/telefon-x-128gb-negru`)
    assert.doesNotMatch(o.url, /\/go\//)
    assert.equal(o.itemCondition, 'https://schema.org/NewCondition')
  }
  assert.equal(ld.sku, '42')
  assert.equal((ld as Record<string, unknown>).mpn, 'SM-A556B')
  assert.deepEqual(ld.brand, { '@type': 'Brand', name: 'Samsung' })
  // fara `category` (validatorul campaniilor l-ar trata drept slug de categorie)
  assert.equal((ld as Record<string, unknown>).category, undefined)
})

test('productLd: fara oferte cu pret → null (nu emitem Product cu offers goale)', () => {
  assert.equal(productLd({ ...product, offers: [] }), null)
  assert.equal(productLd({ ...product, offers: [{ price: null, retailer: 'x' }] }), null)
})

test('productLd: fara brand → fara cheia brand; EAN valid in part_no → gtin, nu mpn', () => {
  const ld = productLd({ ...product, brand: null, partNo: '8806097826972' }) as Record<string, unknown>
  assert.equal('brand' in ld, false)
  assert.equal(ld.gtin, '8806097826972')
  assert.equal('mpn' in ld, false)
})

test('isValidGtin: cifra de control', () => {
  assert.equal(isValidGtin('8806097826972'), true)
  assert.equal(isValidGtin('8806097826973'), false)
  assert.equal(isValidGtin('195950639094'), true)     // UPC-A (iPhone)
  assert.equal(isValidGtin('SM-F966BZSBEUE'), false)
})

test('itemConditionFor: tag-urile refurbished / second-hand', () => {
  assert.equal(itemConditionFor(['refurbished']), 'https://schema.org/RefurbishedCondition')
  assert.equal(itemConditionFor(['second-hand']), 'https://schema.org/UsedCondition')
  assert.equal(itemConditionFor([]), 'https://schema.org/NewCondition')
})

test('Organization + WebSite: @id comun, SearchAction pe domeniul canonic', () => {
  const org = organizationLd()
  const site = websiteLd()
  assert.equal(org['@id'], ORGANIZATION_ID)
  assert.equal(site.publisher['@id'], ORGANIZATION_ID)
  assert.equal(site.potentialAction.target.urlTemplate, `${SITE_URL}/cautare?q={search_term_string}`)
  assert.equal(site.inLanguage, 'ro-RO')
  assert.ok(org.legalName)
})

test('breadcrumbLd / itemListLd: pozitii si URL-uri absolute', () => {
  const b = breadcrumbLd([{ name: 'Acasă', path: '/' }, { name: 'Laptopuri', path: '/c/laptopuri' }])
  assert.equal(b.itemListElement[1].position, 2)
  assert.equal(b.itemListElement[1].item, `${SITE_URL}/c/laptopuri`)
  const l = itemListLd('X', [{ name: 'a', path: '/p/a' }], { startPosition: 49, total: 100 })
  assert.equal(l.itemListElement[0].position, 49)
  assert.equal(l.numberOfItems, 100)
})

test('ldScript: JSON valid, fara „</script>” in clar', () => {
  const s = ldScript({ name: 'a</script><b>' })
  assert.doesNotMatch(s, /<\/script>/)
  assert.deepEqual(JSON.parse(s), { name: 'a</script><b>' })
})

// --- sitemap -----------------------------------------------------------------------------------

test('sitemap: impartire in fisiere de cate 10.000 de produse', () => {
  assert.equal(PRODUCTS_PER_SITEMAP, 10_000)
  assert.equal(productSitemapCount(0), 0)
  assert.equal(productSitemapCount(10_000), 1)
  assert.equal(productSitemapCount(29_022), 3)
  assert.deepEqual(sitemapFileNames(29_022), ['pagini.xml', 'produse-1.xml', 'produse-2.xml', 'produse-3.xml'])
  const all = Array.from({ length: 25_000 }, (_, i) => i)
  assert.equal(productSlice(all, 1).length, 10_000)
  assert.equal(productSlice(all, 3).length, 5_000)
  assert.equal(productSlice(all, 3)[0], 20_000)
})

test('sitemap: nume de fisiere acceptate', () => {
  assert.deepEqual(parseSitemapFile('pagini.xml'), { kind: 'pages' })
  assert.deepEqual(parseSitemapFile('produse-2.xml'), { kind: 'products', index: 2 })
  assert.equal(parseSitemapFile('produse-0.xml'), null)
  assert.equal(parseSitemapFile('produse-1'), null)
  assert.equal(parseSitemapFile('../etc.xml'), null)
})

test('sitemap: XML valid, escapare, lastmod doar unde exista', () => {
  const xml = urlsetXml([
    { path: '/c/a&b' },
    { path: '/p/x', lastmod: '2026-10-02T10:00:00.000Z' },
    { path: '/p/y', lastmod: null },
  ])
  assert.match(xml, /^<\?xml version="1.0" encoding="UTF-8"\?>\n<urlset xmlns="http:\/\/www.sitemaps.org\/schemas\/sitemap\/0.9">/)
  assert.match(xml, new RegExp(`<loc>${SITE_URL}/c/a&amp;b</loc></url>`))
  assert.match(xml, /<loc>[^<]*\/p\/x<\/loc><lastmod>2026-10-02T10:00:00.000Z<\/lastmod>/)
  assert.equal((xml.match(/<lastmod>/g) ?? []).length, 1)
  assert.equal((xml.match(/<url>/g) ?? []).length, (xml.match(/<\/url>/g) ?? []).length)
  const idx = sitemapIndexXml([{ path: '/sitemaps/pagini.xml' }])
  assert.match(idx, /<sitemapindex xmlns="http:\/\/www.sitemaps.org\/schemas\/sitemap\/0.9">/)
  assert.match(idx, new RegExp(`<sitemap><loc>${SITE_URL}/sitemaps/pagini.xml</loc></sitemap>`))
})

test('sitemap: latestLastmod', () => {
  assert.equal(latestLastmod([{ path: '/' }]), null)
  assert.equal(latestLastmod([{ path: '/a', lastmod: '2026-10-01T00:00:00Z' }, { path: '/b', lastmod: '2026-10-03T00:00:00Z' }])?.toISOString(), '2026-10-03T00:00:00.000Z')
})

test('categorii: sitemap fara categorii goale / ascunse; landing fara Sanatate & Naturale', () => {
  const cats = [
    { slug: 'telefoane-accesorii', name: 'T&A', parent_slug: null, visible: true, products: 900 },
    { slug: 'telefoane-mobile', name: 'Telefoane Mobile', parent_slug: 'telefoane-accesorii', visible: true, products: 756 },
    { slug: 'monitoare', name: 'Monitoare', parent_slug: 'laptopuri-calculatoare', visible: true, products: 0 },
    { slug: 'ascunsa', name: 'Ascunsă', parent_slug: null, visible: false, products: 10 },
    { slug: 'sanatate-naturale', name: 'S&N', parent_slug: null, visible: true, products: 50 },
    { slug: 'suplimente-alimentare', name: 'Suplimente', parent_slug: 'sanatate-naturale', visible: true, products: 40 },
  ]
  assert.deepEqual(indexableCategories(cats).map((c) => c.slug), ['telefoane-accesorii', 'telefoane-mobile', 'sanatate-naturale', 'suplimente-alimentare'])
  assert.deepEqual(landingCategories(cats).map((c) => c.slug), ['telefoane-accesorii', 'telefoane-mobile'])
  assert.equal(isExcludedFromAds('suplimente-alimentare', 'sanatate-naturale'), true)
  assert.equal(isExcludedFromAds('laptopuri', 'laptopuri-calculatoare'), false)
})

// --- robots.txt --------------------------------------------------------------------------------

// Evaluator minimal RFC 9309: grupul cu user-agent potrivit (altfel `*`), regula cea mai lunga castiga
function allowed(ua: string, path: string): boolean {
  const groups = robotsRules()
  const uaList = (g: { userAgent: string | string[] }) => (Array.isArray(g.userAgent) ? g.userAgent : [g.userAgent])
  const group = groups.find((g) => uaList(g).some((u) => u !== '*' && ua.toLowerCase().includes(u.toLowerCase())))
    ?? groups.find((g) => uaList(g).includes('*'))!
  const rules = [
    ...[group.allow].flat().map((p) => ({ p, allow: true })),
    ...group.disallow.map((p) => ({ p, allow: false })),
  ].filter((r) => path.startsWith(r.p)).sort((a, b) => b.p.length - a.p.length)
  return rules.length ? rules[0].allow : true
}

test('robots: fiecare robot AI are grup explicit si /go/ + /api/ raman interzise', () => {
  for (const bot of [...AI_BOTS, 'Googlebot', 'Mozilla/5.0 oarecare']) {
    assert.equal(allowed(bot, '/go/123'), false, `${bot} /go/`)
    assert.equal(allowed(bot, '/api/go-token'), false, `${bot} /api/`)
    assert.equal(allowed(bot, '/p/telefon-x'), true, `${bot} /p/`)
    assert.equal(allowed(bot, '/llms.txt'), true, `${bot} /llms.txt`)
  }
  for (const g of robotsRules()) assert.deepEqual(g.disallow, ['/go/', '/api/'])
  for (const bot of ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'OAI-SearchBot', 'Google-Extended']) assert.ok(AI_BOTS.includes(bot))
})

// --- „Pe scurt despre preț” si variante --------------------------------------------------------

test('priceFacts: minim/maxim 90 zile cu date, mediana, ultima verificare — fara verdict', () => {
  const facts = priceFacts({
    history: [
      { price: 149.99, recorded_at: '2026-08-01 10:00:00+03' },
      { price: 129.99, recorded_at: '2026-08-12T09:00:00Z' },
      { price: 138.99, recorded_at: '2026-10-03T08:00:00Z' },
    ],
    median30: 138.99,
    lastChecked: '2026-10-03T08:00:00Z',
    retailer: 'evomag.ro',
    trackedSince: '2026-01-10T08:00:00Z',
    now: new Date('2026-10-04T12:00:00Z'),
  })
  const text = facts.join(' ')
  assert.match(text, /^În ultimele 90 de zile, /)
  assert.match(text, /cel mai mic preț înregistrat a fost 129,99\s?RON \(12 august 2026\), iar cel mai mare 149,99\s?RON \(1 august 2026\)/)
  assert.match(text, /Mediana prețurilor din ultimele 30 de zile: 138,99/)
  assert.match(text, /Ultima verificare: 3 octombrie 2026, la evomag\.ro\./)
  // regula 9 + ads:validate: fara „Reducere reală: X% sub mediana”, fara procente
  assert.doesNotMatch(text, /reducere|%/i)
})

test('priceFacts: istoric scurt / pret constant / fara date', () => {
  assert.match(priceFacts({ history: [{ price: 10, recorded_at: '2026-10-01T10:00:00Z' }], median30: null, lastChecked: null, retailer: null })[0], /^Urmărim prețul din 1 octombrie 2026/)
  assert.match(priceFacts({ history: [{ price: 10, recorded_at: '2026-10-01T10:00:00Z' }, { price: 10, recorded_at: '2026-10-02T10:00:00Z' }], median30: null, lastChecked: null, retailer: null })[0], /constant/)
  assert.deepEqual(priceFacts({ history: [], median30: null, lastChecked: null, retailer: null }), [])
})

test('priceFacts: produs urmarit de mai putin de 90 de zile — fraza pleaca de la prima inregistrare', () => {
  const now = new Date('2026-10-04T12:00:00Z')
  // petmart: prima inregistrare pe 3.10.2026, pret constant
  const constant = priceFacts({
    history: [{ price: 361.12, recorded_at: '2026-10-03 09:00:00+03' }, { price: 361.12, recorded_at: '2026-10-04 09:00:00+03' }],
    trackedSince: '2026-10-03 09:00:00+03', median30: null, lastChecked: null, retailer: null, now,
  })
  assert.match(constant[0], /^De la 3 octombrie 2026, de când urmărim produsul, prețul înregistrat a fost constant: 361,12\s?RON\.$/)
  // minim / maxim, cu trackedSince dedus din istoric (fara query)
  const range = priceFacts({
    history: [{ price: 120, recorded_at: '2026-09-20T08:00:00Z' }, { price: 100, recorded_at: '2026-09-25T08:00:00Z' }],
    median30: 110, lastChecked: null, retailer: null, now,
  })
  assert.match(range[0], /^De la 20 septembrie 2026, de când urmărim produsul, cel mai mic preț înregistrat a fost 100\s?RON \(25 septembrie 2026\)/)
  for (const f of [...constant, ...range]) assert.doesNotMatch(f, /90 de zile/)
  // urmarit de mult: chiar daca fereastra de 90 de zile incepe mai tarziu, raman „ultimele 90 de zile”
  const old = priceFacts({
    history: [{ price: 10, recorded_at: '2026-09-01T08:00:00Z' }, { price: 10, recorded_at: '2026-10-01T08:00:00Z' }],
    trackedSince: '2025-01-15T08:00:00Z', median30: null, lastChecked: null, retailer: null, now,
  })
  assert.match(old[0], /^În ultimele 90 de zile, prețul înregistrat a fost constant/)
})

test('historyPartialSince / historyTitle / historyChartPhrase: 90 de zile doar cu 90+ zile de date', () => {
  const now = new Date('2026-10-04T12:00:00Z')
  assert.equal(historyPartialSince('2026-10-03T08:00:00Z', now), '2026-10-03T08:00:00Z')
  assert.equal(historyPartialSince('2026-07-06T13:00:00Z', now), '2026-07-06T13:00:00Z') // 89,96 zile
  assert.equal(historyPartialSince('2026-07-06T11:00:00Z', now), null)                    // 90+ zile
  assert.equal(historyPartialSince(null, now), null)
  assert.equal(historyPartialSince('nu e data', now), null)
  assert.equal(historyTitle(null), 'Istoricul prețului (90 de zile)')
  assert.equal(historyTitle('2026-10-03T08:00:00Z'), 'Istoricul prețului (de la 3 oct. 2026)')
  // ora Romaniei: 2 oct. 22:30 UTC = 3 oct. in Romania
  assert.equal(historyTitle('2026-10-02T22:30:00Z'), 'Istoricul prețului (de la 3 oct. 2026)')
  assert.match(historyChartPhrase(null), /pe 90 de zile/)
  assert.equal(historyChartPhrase('2026-10-03T08:00:00Z'), 'Grafic cu istoricul prețului de la 3 octombrie 2026, comparat cu mediana de 30 de zile.')
})

test('variantBase: taie culoarea de dupa ultimul cuvant cu cifre', () => {
  assert.equal(variantBase('Telefon mobil Galaxy S26 Ultra 256GB 12GB RAM Dual Sim 5G Cobalt Violet'), 'Telefon mobil Galaxy S26 Ultra 256GB 12GB RAM Dual Sim 5G')
  assert.equal(variantBase('Telefon mobil Nokia 105 (2024), Dual Sim (Mov)'), 'Telefon mobil Nokia 105 (2024)')
  assert.equal(variantBase('Telefon mobil iPhone 17 Pro Max 256GB Dual SIM 5G Cosmic Orange'), 'Telefon mobil iPhone 17 Pro Max 256GB Dual SIM 5G')
  // prea multe cuvinte dupa ultima cifra / fara cifre / baza prea scurta → null
  assert.equal(variantBase('Laptop 15 cu tastatura iluminata si carcasa din aluminiu'), null)
  assert.equal(variantBase('Husa transparenta silicon'), null)
  assert.equal(variantBase('TV 55 negru'), null)
})

// --- llms.txt ------------------------------------------------------------------------------------

const llmsData = {
  facts: { products: 29022, retailers: 6, realDiscounts: 412, historySince: '2026-06-11T14:37:59.000Z', generatedAt: '2026-10-04T08:00:00.000Z' },
  guides: [{ slug: 'ghid-a', title: 'Ghid A', meta_description: 'Descriere A' }],
  categories: [
    { slug: 'telefoane-accesorii', name: 'Telefoane & Accesorii', parent_slug: null, products: 2000 },
    { slug: 'telefoane-mobile', name: 'Telefoane Mobile', parent_slug: 'telefoane-accesorii', products: 756 },
    { slug: 'sanatate-naturale', name: 'Sănătate & Naturale', parent_slug: null, products: 6000 },
  ],
  landings: [{ slug: 'telefoane-mobile', name: 'Telefoane Mobile', parent_slug: 'telefoane-accesorii', products: 756 }],
}

test('llms.txt: cifre live, categorii /c/, metodologie, contact, sub 20 KB', () => {
  const txt = buildLlmsTxt(llmsData)
  assert.match(txt, /^# superieftin\.ro/)
  assert.match(txt, /29\.022/)
  assert.match(txt, /Istoric de preț din: 11 iunie 2026/)
  assert.match(txt, new RegExp(`\\[Telefoane Mobile\\]\\(${SITE_URL}/c/telefoane-mobile\\): 756 de produse disponibile`))
  assert.match(txt, new RegExp(`${SITE_URL}/ghiduri/metodologie`))
  assert.match(txt, new RegExp(`${SITE_URL}/contact`))
  assert.match(txt, new RegExp(`${SITE_URL}/llms-full.txt`))
  assert.match(txt, /contact@superieftin\.ro/)
  // Sanatate & Naturale: in categorii da, landing de reduceri nu
  assert.match(txt, /\/c\/sanatate-naturale/)
  assert.doesNotMatch(txt, /reduceri-reale\/sanatate/)
  assert.ok(Buffer.byteLength(txt) < 20_000)
  assert.doesNotMatch(txt, /\{\{/)
})

test('llms-full.txt: textul ghidului fara marcaje si fara preturi', () => {
  const full = buildLlmsFull(llmsData, [{
    slug: 'ghid-a', title: 'Ghid A', meta_description: null, updated_at: '2026-09-27T10:00:00Z',
    summary: 'Pe scurt {{pret:telefon-x}}',
    body_md: '## Titlu\n\nText.\n\n{{oferte:telefon-x}}\n\n{{comparatie:123,telefon-y}}\n',
    faq: [{ q: 'Întrebare?', a: 'Răspuns.' }],
  }])
  assert.match(full, /# Ghid A/)
  assert.match(full, /## Titlu/)
  assert.match(full, new RegExp(`vezi prețul live pe ${SITE_URL}/p/telefon-x`))
  assert.match(full, new RegExp(`vezi prețul live pe ${SITE_URL}/ghiduri/ghid-a, ${SITE_URL}/p/telefon-y`))
  assert.match(full, /\*\*Întrebare\?\*\*/)
  assert.doesNotMatch(full, /\{\{/)
})

test('stripGuideMarkers: marcaje necunoscute dispar, textul ramane', () => {
  assert.equal(stripGuideMarkers('a {{necunoscut:x}} b', 'u'), 'a  b')
})
