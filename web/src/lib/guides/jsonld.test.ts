// Teste pentru datele structurate ale articolelor si autorilor (lib/guides/jsonld.ts), fluxul RSS
// (lib/guides/rss.ts) si ancorele H2 / cuprinsul (lib/guides/markdown.ts, toc.ts).
// Rulare: cd web && npm test
// Nodurile JSON-LD sunt obiecte libere: in teste le citim ca `any`, ca sa verificam forma exacta.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  articleLd, articleProducts, blogPostingLd, webPageLd, productReviewLd, articleItemListLd,
  articleBreadcrumbLd, authorProfileLd, externalProfileUrl, isoDate, type ArticleLdInput, type LdProduct,
} from './jsonld'
import { buildRss, xmlEscape } from './rss'
import { headingSlug, renderMarkdown, newHeadingEnv } from './markdown'
import { guideToc } from './toc'
import { ORGANIZATION_ID, SITE_URL } from '../seo/site'

const BODY = `Intro.

## Cele mai bune alegeri

{{oferte:111}}
{{pro: Ecran luminos}}
{{pro: Baterie mare}}
{{contra: Încărcător separat}}

Text intre carduri.

{{oferte:telefon-b}}

## Față în față

{{comparatie:111,telefon-c}}
`

const PRODUCTS = new Map<string, LdProduct>()
for (const p of [
  { id: '111', name: 'Telefon A', slug: 'telefon-a', brand: 'Samsung', image_url: 'https://cdn.example.ro/a.jpg' },
  { id: '222', name: 'Telefon B', slug: 'telefon-b', brand: null, image_url: null },
  { id: '333', name: 'Telefon C', slug: 'telefon-c', brand: 'Apple', image_url: null },
]) { PRODUCTS.set(p.id, p); PRODUCTS.set(p.slug, p) }

const INPUT: ArticleLdInput = {
  slug: 'cele-mai-bune-telefoane',
  title: 'Cele mai bune telefoane sub 2000 de lei',
  description: 'Ce telefoane merită cumpărate acum.',
  publishedAt: '2026-11-10 09:00:00+00',
  updatedAt: '2026-11-18 12:30:00.5+00',
  section: { name: 'Telefoane & Accesorii', slug: 'telefoane-accesorii' },
  author: { name: 'Adrian', slug: 'adrian', kind: 'person', bio: null, url: null },
  reviewer: { name: 'Echipa Superieftin.ro', slug: 'echipa-superieftin', kind: 'organization', bio: null, url: '/despre' },
  products: articleProducts(BODY, PRODUCTS),
  faq: [{ q: 'Merită?', a: 'Da, dacă…' }, { q: '  ', a: 'gol' }],
}

const URL_ = `${SITE_URL}/ghiduri/cele-mai-bune-telefoane`

test('articleProducts: ordinea aparitiei, fara dubluri (id + slug), pro/contra atasate', () => {
  const ps = INPUT.products
  assert.deepEqual(ps.map((p) => p.slug), ['telefon-a', 'telefon-b', 'telefon-c'])
  assert.deepEqual(ps[0].pros, ['Ecran luminos', 'Baterie mare'])
  assert.deepEqual(ps[0].cons, ['Încărcător separat'])
  assert.deepEqual([ps[1].pros, ps[1].cons], [[], []])
})

test('isoDate: formatul ::text din Postgres → ISO; invalid → undefined', () => {
  assert.equal(isoDate('2026-11-10 09:00:00+00'), '2026-11-10T09:00:00.000Z')
  assert.equal(isoDate('2026-11-10 11:00:00.25+02'), '2026-11-10T09:00:00.250Z')
  assert.equal(isoDate('2026-11-10T09:00:00Z'), '2026-11-10T09:00:00.000Z')
  assert.equal(isoDate('nu e data'), undefined)
  assert.equal(isoDate(null), undefined)
})

test('BlogPosting: campurile cerute, URL-uri absolute, autor cu pagina /autori/, publisher = @id', () => {
  const b = blogPostingLd(INPUT) as Record<string, any>
  assert.equal(b['@type'], 'BlogPosting')
  assert.equal(b['@id'], `${URL_}#article`)
  assert.equal(b.headline, INPUT.title)
  assert.equal(b.description, INPUT.description)
  assert.equal(b.image, `${URL_}/opengraph-image`)
  assert.equal(b.inLanguage, 'ro-RO')
  assert.equal(b.datePublished, '2026-11-10T09:00:00.000Z')
  assert.equal(b.dateModified, '2026-11-18T12:30:00.500Z')
  assert.deepEqual(b.author, { '@type': 'Person', '@id': `${SITE_URL}/autori/adrian#person`, name: 'Adrian', url: `${SITE_URL}/autori/adrian` })
  assert.deepEqual(b.publisher, { '@id': ORGANIZATION_ID })
  assert.deepEqual(b.mainEntityOfPage, { '@id': URL_ })
  assert.equal(b.articleSection, 'Telefoane & Accesorii')
  // mentions: produsul cu recenzie prin @id, celelalte ca Thing (un Product fara review/offers = invalid)
  assert.deepEqual(b.mentions, [
    { '@id': `${URL_}#produs-telefon-a` },
    { '@type': 'Thing', name: 'Telefon B' },
    { '@type': 'Thing', name: 'Telefon C' },
  ])
})

test('BlogPosting fara autor → organizatia; fara sectiune → fara articleSection', () => {
  const b = blogPostingLd({ ...INPUT, author: null, section: null, products: [] }) as Record<string, any>
  assert.deepEqual(b.author, { '@id': ORGANIZATION_ID })
  assert.equal('articleSection' in b, false)
  assert.equal('mentions' in b, false)
})

test('WebPage: reviewedBy = verificatorul (Organization cu pagina de autor), legat de articol', () => {
  const w = webPageLd(INPUT) as Record<string, any>
  assert.equal(w['@id'], URL_)
  assert.deepEqual(w.mainEntity, { '@id': `${URL_}#article` })
  assert.equal(w.reviewedBy['@type'], 'Organization')
  assert.equal(w.reviewedBy.url, `${SITE_URL}/autori/echipa-superieftin`)
  assert.equal('reviewedBy' in (webPageLd({ ...INPUT, reviewer: null }) as object), false)
})

test('Product + Review editorial: pro/contra ca ItemList, fara offers / reviewRating / /p/ / gtin', () => {
  const p = productReviewLd(INPUT, INPUT.products[0]) as Record<string, any>
  assert.equal(p['@type'], 'Product')
  assert.equal(p.name, 'Telefon A')
  assert.equal(p.image, 'https://cdn.example.ro/a.jpg')
  assert.deepEqual(p.brand, { '@type': 'Brand', name: 'Samsung' })
  for (const k of ['offers', 'url', 'gtin', 'mpn', 'sku', 'aggregateRating']) assert.equal(k in p, false, k)
  const r = p.review
  assert.equal(r['@type'], 'Review')
  assert.equal(r.author.url, `${SITE_URL}/autori/adrian`)
  assert.equal(r.datePublished, '2026-11-10T09:00:00.000Z')
  assert.equal('reviewRating' in r, false)
  assert.deepEqual(r.positiveNotes, {
    '@type': 'ItemList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Ecran luminos' },
      { '@type': 'ListItem', position: 2, name: 'Baterie mare' },
    ],
  })
  assert.deepEqual(r.negativeNotes.itemListElement, [{ '@type': 'ListItem', position: 1, name: 'Încărcător separat' }])
  // Doar contra → fara positiveNotes
  const onlyCons = productReviewLd(INPUT, { ...INPUT.products[0], pros: [] }) as Record<string, any>
  assert.equal('positiveNotes' in onlyCons.review, false)
  // Fara note → fara Product
  assert.equal(productReviewLd(INPUT, INPUT.products[1]), null)
})

test('ItemList: produsele in ordine, url = ancora #produs-<slug> din articol', () => {
  const l = articleItemListLd(INPUT) as Record<string, any>
  assert.equal(l.numberOfItems, 3)
  assert.deepEqual(l.itemListElement.map((i: any) => [i.position, i.url]), [
    [1, `${URL_}#produs-telefon-a`], [2, `${URL_}#produs-telefon-b`], [3, `${URL_}#produs-telefon-c`],
  ])
  assert.equal(articleItemListLd({ ...INPUT, products: [] }), null)
})

test('BreadcrumbList: Acasa → tema → articol; fara tema → Ghiduri', () => {
  const items = (articleBreadcrumbLd(INPUT) as any).itemListElement.map((i: any) => i.item)
  assert.deepEqual(items, [`${SITE_URL}/`, `${SITE_URL}/c/telefoane-accesorii`, URL_])
  const noTheme = (articleBreadcrumbLd({ ...INPUT, section: null }) as any).itemListElement.map((i: any) => i.item)
  assert.deepEqual(noTheme, [`${SITE_URL}/`, `${SITE_URL}/ghiduri`, URL_])
})

test('articleLd: toate nodurile, un singur Product, FAQ doar cu intrebarile completate, nimic spre /p/ sau pret', () => {
  const nodes = articleLd(INPUT) as Record<string, any>[]
  assert.deepEqual(nodes.map((n) => n['@type']), ['BlogPosting', 'WebPage', 'BreadcrumbList', 'ItemList', 'Product', 'FAQPage'])
  assert.equal(nodes[5].mainEntity.length, 1)
  const json = JSON.stringify(nodes)
  assert.equal(json.includes('/p/'), false)
  for (const k of ['"offers"', '"price"', '"priceCurrency"', 'reviewRating', 'aggregateRating', 'AggregateOffer']) {
    assert.equal(json.includes(k), false, k)
  }
  // Toate URL-urile sunt absolute
  for (const m of json.matchAll(/"(?:url|item|image|@id)":"([^"]+)"/g)) assert.match(m[1], /^https?:\/\//, m[1])
})

test('ProfilePage: Person/Organization, sameAs DOAR pentru profil extern', () => {
  assert.equal(externalProfileUrl('/despre'), null)
  assert.equal(externalProfileUrl('https://www.superieftin.ro/despre'), null)
  assert.equal(externalProfileUrl('https://www.linkedin.com/in/x'), 'https://www.linkedin.com/in/x')
  const p = authorProfileLd({ name: 'Adrian', slug: 'adrian', kind: 'person', bio: 'Scrie.', url: 'https://www.linkedin.com/in/x', articles: [{ slug: 'a', title: 'A' }] }) as Record<string, any>
  assert.equal(p['@type'], 'ProfilePage')
  assert.equal(p.url, `${SITE_URL}/autori/adrian`)
  assert.equal(p.mainEntity['@type'], 'Person')
  assert.equal(p.mainEntity['@id'], `${SITE_URL}/autori/adrian#person`)   // acelasi @id ca autorul din BlogPosting
  assert.deepEqual(p.mainEntity.sameAs, ['https://www.linkedin.com/in/x'])
  assert.equal(p.hasPart[0]['@id'], `${SITE_URL}/ghiduri/a#article`)
  const org = authorProfileLd({ name: 'Echipa', slug: 'echipa', kind: 'organization', bio: null, url: '/despre', articles: [] }) as Record<string, any>
  assert.equal(org.mainEntity['@type'], 'Organization')
  assert.equal('sameAs' in org.mainEntity, false)
})

test('RSS: RSS 2.0 valid, linkuri absolute, escapare XML, pubDate RFC 822, max 50', () => {
  const item = { slug: 'x', title: 'Tom & Jerry <3', description: 'Desc "a"', published_at: '2026-11-20 10:00:00+00', updated_at: '2026-11-20 10:00:00+00', author_name: 'Adrian', category_name: null }
  const xml = buildRss([item])
  assert.match(xml, /^<\?xml version="1.0" encoding="UTF-8"\?>\n<rss version="2.0"/)
  assert.ok(xml.includes(`<link>${SITE_URL}/ghiduri/x</link>`))
  assert.ok(xml.includes(`<guid isPermaLink="true">${SITE_URL}/ghiduri/x</guid>`))
  assert.ok(xml.includes('<title>Tom &amp; Jerry &lt;3</title>'))
  assert.ok(xml.includes('<description>Desc &quot;a&quot;</description>'))
  assert.ok(xml.includes('<pubDate>Fri, 20 Nov 2026 10:00:00 GMT</pubDate>'))
  assert.ok(xml.includes(`<atom:link href="${SITE_URL}/ghiduri/feed.xml" rel="self"`))
  assert.equal(xml.includes('<category>'), false)
  const many = buildRss(Array.from({ length: 60 }, (_, i) => ({ ...item, slug: `s${i}` })))
  assert.equal(many.match(/<item>/g)?.length, 50)
  assert.equal(xmlEscape('a\u0001b'), 'ab')
})

test('headingSlug: fara diacritice (virgula si sedila), stabil, rezervat produs-', () => {
  assert.equal(headingSlug('Cum alegi un laptop?'), 'cum-alegi-un-laptop')
  assert.equal(headingSlug('Ștergătoare și țânțari: ăîâ'), 'stergatoare-si-tantari-aia')
  assert.equal(headingSlug('Şi ţ (sedilă)'), 'si-t-sedila')
  assert.equal(headingSlug('!!!'), 'sectiune')
  assert.equal(headingSlug('Produs recomandat'), 'sectiune-produs-recomandat')
})

test('renderMarkdown: id pe H2 (si # → h2) doar cu env; unic in pagina; fara HTML brut', () => {
  assert.equal(renderMarkdown('## Preț'), '<h2>Preț</h2>\n')
  const env = newHeadingEnv()
  assert.equal(renderMarkdown('## Preț', env), '<h2 id="pret">Preț</h2>\n')
  assert.equal(renderMarkdown('# Preț\n\n### Sub', env), '<h2 id="pret-2">Preț</h2>\n<h3>Sub</h3>\n')
  assert.equal(renderMarkdown('## FAQ', env), '<h2 id="faq-2">FAQ</h2>\n')   // „faq” e rezervat paginii
  assert.match(renderMarkdown('## <b>x</b>', newHeadingEnv()), /&lt;b&gt;/)
})

test('guideToc: aceleasi id-uri ca la randarea pe bucati din GuideBody', () => {
  const toc = guideToc(BODY)
  assert.deepEqual(toc, [{ id: 'cele-mai-bune-alegeri', text: 'Cele mai bune alegeri' }, { id: 'fata-in-fata', text: 'Față în față' }])
  const env = newHeadingEnv()
  const html = ['Intro.\n\n## Cele mai bune alegeri\n', '\n\n## Față în față\n'].map((t) => renderMarkdown(t, env)).join('')
  for (const h of toc) assert.ok(html.includes(`id="${h.id}"`), h.id)
})
