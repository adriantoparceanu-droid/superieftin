// Teste pentru logica SEO pura (lib/seo/*): JSON-LD, sitemap, robots.txt,
// fraze despre pret, variante, llms.txt. Rulare: cd web && npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { organizationLd, websiteLd, breadcrumbLd, itemListLd, ldScript, ORGANIZATION_DESCRIPTION } from './jsonld'
import { urlsetXml, sitemapIndexXml, isSitemapFile, latestLastmod, buildPageEntries, indexableThemes, SITEMAP_FILES, LEGAL_PAGES } from './sitemap'
import { robotsRules, AI_BOTS } from './robots'
import { variantBase, historyPartialSince, historyTitle, historyChartPhrase } from './product-facts'
import { buildLlmsTxt, buildLlmsFull, stripGuideMarkers } from './llms'
import { roCount, absUrl, lowerFirst, SITE_URL, ORGANIZATION_ID } from './site'

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

test('Organization + WebSite: @id comun, SearchAction pe domeniul canonic', () => {
  const org = organizationLd()
  const site = websiteLd()
  assert.equal(org['@id'], ORGANIZATION_ID)
  assert.equal(site.publisher['@id'], ORGANIZATION_ID)
  assert.equal(site.potentialAction.target.urlTemplate, `${SITE_URL}/cautare?q={search_term_string}`)
  assert.equal(site.inLanguage, 'ro-RO')
  assert.ok(org.legalName)
  // Identitatea de blog (20 nov. 2026): fara observator / reduceri reale / indice
  assert.match(ORGANIZATION_DESCRIPTION, /[Bb]log de recomandări/)
  for (const t of [ORGANIZATION_DESCRIPTION, site.description]) assert.doesNotMatch(t, /[Oo]bservator|reduceri reale|indice|median/)
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

test('sitemap: un singur fisier (pagini.xml); vechile produse-N.xml nu mai exista', () => {
  assert.deepEqual([...SITEMAP_FILES], ['pagini.xml'])
  assert.equal(isSitemapFile('pagini.xml'), true)
  assert.equal(isSitemapFile('produse-1.xml'), false)
  assert.equal(isSitemapFile('../etc.xml'), false)
})

test('sitemap: pagini.xml = homepage, articole (lastmod + imagine OG), teme, autori, pagini legale — fara /p/', () => {
  const entries = buildPageEntries({
    guides: [
      { slug: 'ghid-a', updated_at: '2026-11-10T10:00:00.000Z' },
      { slug: 'ghid-b', updated_at: '2026-11-18T08:00:00.000Z' },
    ],
    themes: [{ slug: 'telefoane-accesorii' }, { slug: 'tv-audio' }],
    authors: [{ slug: 'adrian' }],
  })
  const paths = entries.map((e) => e.path)
  assert.deepEqual(paths.slice(0, 3), ['/', '/ghiduri', '/ghiduri/metodologie'])
  for (const p of ['/ghiduri/ghid-a', '/ghiduri/ghid-b', '/c/telefoane-accesorii', '/c/tv-audio', '/autori/adrian', ...LEGAL_PAGES]) {
    assert.ok(paths.includes(p), p)
  }
  assert.ok(paths.every((p) => !/^\/(p|t|reduceri-reale|indice|cand-sa-cumperi|black-friday-2026)(\/|$)/.test(p)), 'fara adrese scoase')
  assert.equal(new Set(paths).size, paths.length, 'fara dubluri')
  const a = entries.find((e) => e.path === '/ghiduri/ghid-a')!
  assert.equal(a.lastmod, '2026-11-10T10:00:00.000Z')
  assert.deepEqual(a.images, ['/ghiduri/ghid-a/opengraph-image'])
  assert.equal(entries.find((e) => e.path === '/ghiduri')!.lastmod, '2026-11-18T08:00:00.000Z')
  assert.equal(entries.find((e) => e.path === '/')!.lastmod, undefined)

  const xml = urlsetXml(entries)
  assert.match(xml, /xmlns:image="http:\/\/www.google.com\/schemas\/sitemap-image\/1.1"/)
  assert.match(xml, new RegExp(`<loc>${SITE_URL}/ghiduri/ghid-a</loc><lastmod>2026-11-10T10:00:00.000Z</lastmod><image:image><image:loc>${SITE_URL}/ghiduri/ghid-a/opengraph-image</image:loc></image:image></url>`))
  assert.doesNotMatch(xml, /\/p\//)
})

test('sitemap: teme = parintii cu articole + subcategoriile cu pagina proprie (>= 3 articole)', () => {
  const cats = [
    { id: 1, slug: 'telefoane-accesorii', name: 'T&A', parent_id: null },
    { id: 11, slug: 'telefoane-mobile', name: 'Telefoane', parent_id: 1 },
    { id: 12, slug: 'huse', name: 'Huse', parent_id: 1 },
    { id: 2, slug: 'tv-audio', name: 'TV', parent_id: null },          // fara articole → noindex
    { id: 3, slug: 'laptopuri-calculatoare', name: 'Laptopuri', parent_id: null },
  ]
  const g = (slug: string, ids: number[], cat: string | null = null) => ({
    slug, title: slug, meta_description: null, published_at: null, updated_at: '2026-11-01T00:00:00Z',
    category_slug: cat, category_ids: ids, image_url: null, words: 0, author_name: null,
  })
  const guides = [g('a', [11]), g('b', [11]), g('c', [11]), g('d', [12]), g('e', [], 'laptopuri-calculatoare')]
  // huse are 1 articol → 308 spre parinte, nu intra; tv-audio fara articole → nu intra
  assert.deepEqual(indexableThemes(cats, guides).map((c) => c.slug), ['telefoane-accesorii', 'telefoane-mobile', 'laptopuri-calculatoare'])
  assert.deepEqual(indexableThemes(cats, []), [])
})

test('sitemap: XML valid, escapare, lastmod doar unde exista', () => {
  const xml = urlsetXml([
    { path: '/c/a&b' },
    { path: '/p/x', lastmod: '2026-10-02T10:00:00.000Z' },
    { path: '/p/y', lastmod: null },
  ])
  assert.match(xml, /^<\?xml version="1.0" encoding="UTF-8"\?>\n<urlset xmlns="http:\/\/www.sitemaps.org\/schemas\/sitemap\/0.9"/)
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
    assert.equal(allowed(bot, '/ghiduri/telefoane-bune'), true, `${bot} /ghiduri/`)
    assert.equal(allowed(bot, '/llms.txt'), true, `${bot} /llms.txt`)
  }
  for (const g of robotsRules()) assert.deepEqual(g.disallow, ['/go/', '/api/'])
  for (const bot of ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'OAI-SearchBot', 'Google-Extended']) assert.ok(AI_BOTS.includes(bot))
})

// --- „Pe scurt despre preț” si variante --------------------------------------------------------

// priceFactRows (cardul „Pe scurt despre preț” din redesign): teste in lib/price-series.test.ts

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
  guides: [{ slug: 'ghid-a', title: 'Ghid A', meta_description: 'Descriere A' }],
  themes: [
    { slug: 'telefoane-accesorii', name: 'Telefoane & Accesorii' },
    { slug: 'tv-audio', name: 'TV & Audio' },
  ],
}

test('llms.txt: blog de recomandari, articole cu rezumat, teme, metodologie, afiliere, RSS, contact', () => {
  const txt = buildLlmsTxt(llmsData)
  assert.match(txt, /^# superieftin\.ro/)
  assert.match(txt, /> Blog de recomandări de produse din România/)
  assert.match(txt, new RegExp(`\\[Ghid A\\]\\(${SITE_URL}/ghiduri/ghid-a\\): Descriere A`))
  assert.match(txt, new RegExp(`\\[TV & Audio\\]\\(${SITE_URL}/c/tv-audio\\)`))
  assert.match(txt, /## Cum alegem produsele/)
  assert.match(txt, /## Cum ne finanțăm/)
  assert.match(txt, /Profitshare/)
  assert.match(txt, new RegExp(`${SITE_URL}/ghiduri/feed\\.xml`))
  assert.match(txt, new RegExp(`${SITE_URL}/ghiduri/metodologie`))
  assert.match(txt, new RegExp(`${SITE_URL}/contact`))
  assert.match(txt, new RegExp(`${SITE_URL}/llms-full.txt`))
  // fara comparator / observator / preturi
  assert.doesNotMatch(txt, /[Oo]bservator|[Rr]educere reală|reduceri-reale|\/indice|cand-sa-cumperi|black-friday-2026|\/p\/|mediana/)
  assert.doesNotMatch(txt, /\d+ lei/)
  assert.ok(Buffer.byteLength(txt) < 20_000)
  assert.doesNotMatch(txt, /\{\{/)
})

test('llms-full.txt: textul articolului fara marcaje, fara preturi si fara /p/', () => {
  const full = buildLlmsFull(llmsData, [{
    slug: 'ghid-a', title: 'Ghid A', meta_description: null, updated_at: '2026-09-27T10:00:00Z',
    summary: 'Pe scurt {{pret:telefon-x}}',
    body_md: '## Titlu\n\nText.\n\n{{oferte:telefon-x}}\n{{pro: Baterie mare}}\n{{contra: Fără încărcător}}\n\n{{comparatie:123,telefon-y}}\n',
    faq: [{ q: 'Întrebare?', a: 'Răspuns.' }],
  }])
  const url = `${SITE_URL}/ghiduri/ghid-a`
  assert.match(full, /# Ghid A/)
  assert.match(full, /## Titlu/)
  assert.ok(full.includes(`(produsul și prețul de azi: ${url}#produs-telefon-x)`))
  assert.ok(full.includes(`(produsul și prețul de azi: ${url}, ${url}#produs-telefon-y)`))
  assert.match(full, /Bun: Baterie mare/)
  assert.match(full, /Mai slab: Fără încărcător/)
  assert.match(full, /\*\*Întrebare\?\*\*/)
  assert.doesNotMatch(full, /\{\{/)
  assert.doesNotMatch(full, /\/p\/|[Oo]bservator/)
})

test('stripGuideMarkers: marcaje necunoscute dispar, textul ramane', () => {
  assert.equal(stripGuideMarkers('a {{necunoscut:x}} b', 'u'), 'a  b')
  // Marcajele scoase din setul public (istoricul de pret e intern) dispar si ele
  assert.equal(stripGuideMarkers('a {{reducere:x}} {{istoric-pret:y}} b', 'u'), 'a   b')
})
