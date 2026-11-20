import { ORGANIZATION_ID, SITE_URL, WEBSITE_ID, absUrl } from '../seo/site'
import { breadcrumbLd, faqPageLd } from '../seo/jsonld'
import { productNotes, splitGuideBody, collectRefs } from './markers'

// Date structurate (schema.org) pentru articole (/ghiduri/<slug>) si autori (/autori/<slug>).
// Functii PURE (fara DB) — testate in jsonld.test.ts.
//
// Decizia proprietarului (20.11.2026, reorganizarea in blog): produsele din articol = RECENZIE
// EDITORIALA cu pro/contra — Product + Review cu positiveNotes / negativeNotes, autorul real al
// articolului. Exceptie de la regula veche „fara Review”, DOAR pentru acest caz:
//   - FARA reviewRating / AggregateRating (nu inventam note sau stele);
//   - FARA preturi / offers (pretul se schimba zilnic, iar schema nu trebuie sa promita nimic);
//   - FARA url spre /p/ (paginile de produs dispar) si fara gtin (nu il avem sigur).
// Produsele fara {{pro}}/{{contra}} nu primesc nod Product (un Product fara offers/review e
// marcat invalid de Google); apar doar in ItemList si in `mentions` (ca Thing, cu numele).
//
// Garda Ads (worker/src/ads/campaigns/validate.ts) trateaza landing-urile /ghiduri/ separat:
// cere BlogPosting + macar un link /go/; un Product fara offers NU mai inseamna „fara stoc”.

export interface LdAuthor {
  name: string
  slug: string
  kind: 'person' | 'organization'
  bio?: string | null
  url?: string | null       // profil extern (sau intern) — pe pagina de autor devine sameAs
}

export interface LdProduct {
  id: string
  name: string
  slug: string
  brand: string | null
  image_url: string | null
}

// Un produs din articol, in ordinea aparitiei, cu notele lui (goale = fara recenzie)
export interface ArticleProduct extends LdProduct {
  pros: string[]
  cons: string[]
}

export interface ArticleLdInput {
  slug: string
  title: string
  description: string | null
  publishedAt: string | null
  updatedAt: string
  section: { name: string; slug: string } | null   // tema (categoria) articolului
  author: LdAuthor | null
  reviewer: LdAuthor | null
  products: ArticleProduct[]
  faq: { q: string; a: string }[]
}

export function articleUrl(slug: string): string {
  return absUrl(`/ghiduri/${slug}`)
}

// Imaginea Open Graph generata (app/ghiduri/[slug]/opengraph-image.tsx) — aceeasi in BlogPosting
export function articleImageUrl(slug: string): string {
  return `${articleUrl(slug)}/opengraph-image`
}

export function authorUrl(slug: string): string {
  return absUrl(`/autori/${slug}`)
}

// @id-ul autorului = pagina lui + fragment → aceeasi entitate pe articole si pe /autori/<slug>
export function authorId(a: Pick<LdAuthor, 'slug' | 'kind'>): string {
  return `${authorUrl(a.slug)}#${a.kind === 'organization' ? 'organization' : 'person'}`
}

export function authorRef(a: LdAuthor) {
  return {
    '@type': a.kind === 'organization' ? 'Organization' : 'Person',
    '@id': authorId(a),
    name: a.name,
    url: authorUrl(a.slug),
  }
}

// Datele din Postgres (::text, ex. „2026-11-20 10:00:00.123+00”) → ISO 8601; invalid → undefined
export function isoDate(v: string | null | undefined): string | undefined {
  if (!v) return undefined
  const d = new Date(/^\d{4}-\d\d-\d\d \d/.test(v) ? v.replace(' ', 'T').replace(/([+-]\d\d)$/, '$1:00') : v)
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString()
}

// Profil extern (alt domeniu) → sameAs. Linkurile spre propriul site nu sunt „alte profiluri”.
export function externalProfileUrl(url: string | null | undefined): string | null {
  if (!url || !/^https?:\/\//i.test(url)) return null
  try {
    const host = new URL(url).hostname.toLowerCase()
    return host === 'superieftin.ro' || host.endsWith('.superieftin.ro') ? null : url
  } catch {
    return null
  }
}

// Produsele articolului in ordinea primei aparitii in corp (marcajele {{oferte}}/{{pret}}/
// {{comparatie}}), fara dubluri (acelasi produs scris o data ca id si o data ca slug = unul), cu
// notele pro/contra unite. `products` = Map-ul din loadLiveProducts (ref → produs).
export function articleProducts<P extends LdProduct>(body: string, products: Map<string, P>): (P & { pros: string[]; cons: string[] })[] {
  const byId = new Map<string, P & { pros: string[]; cons: string[] }>()
  for (const ref of collectRefs(splitGuideBody(body))) {
    const p = products.get(ref)
    if (p && !byId.has(p.id)) byId.set(p.id, { ...p, pros: [], cons: [] })
  }
  for (const n of productNotes(body)) {
    const p = products.get(n.ref)
    const cur = p && byId.get(p.id)
    if (!cur) continue
    for (const x of n.pros) if (!cur.pros.includes(x)) cur.pros.push(x)
    for (const x of n.cons) if (!cur.cons.includes(x)) cur.cons.push(x)
  }
  return [...byId.values()]
}

function notesList(items: string[]) {
  return {
    '@type': 'ItemList',
    itemListElement: items.map((name, i) => ({ '@type': 'ListItem', position: i + 1, name })),
  }
}

export function productAnchorUrl(articleSlug: string, productSlug: string): string {
  return `${articleUrl(articleSlug)}#produs-${productSlug}`
}

// Product cu Review editorial — doar pentru produsele cu cel putin un pro sau contra
export function productReviewLd(a: ArticleLdInput, p: ArticleProduct) {
  if (!p.pros.length && !p.cons.length) return null
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': productAnchorUrl(a.slug, p.slug),
    name: p.name,
    ...(p.image_url ? { image: absUrl(p.image_url) } : {}),
    ...(p.brand ? { brand: { '@type': 'Brand', name: p.brand } } : {}),
    review: {
      '@type': 'Review',
      author: a.author ? authorRef(a.author) : { '@type': 'Organization', '@id': ORGANIZATION_ID, name: 'superieftin.ro' },
      ...(isoDate(a.publishedAt) ? { datePublished: isoDate(a.publishedAt) } : {}),
      publisher: { '@id': ORGANIZATION_ID },
      ...(p.pros.length ? { positiveNotes: notesList(p.pros) } : {}),
      ...(p.cons.length ? { negativeNotes: notesList(p.cons) } : {}),
    },
  }
}

export function blogPostingLd(a: ArticleLdInput) {
  const url = articleUrl(a.slug)
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    '@id': `${url}#article`,
    headline: a.title,
    ...(a.description ? { description: a.description } : {}),
    image: articleImageUrl(a.slug),
    url,
    inLanguage: 'ro-RO',
    ...(isoDate(a.publishedAt) ? { datePublished: isoDate(a.publishedAt) } : {}),
    ...(isoDate(a.updatedAt) ? { dateModified: isoDate(a.updatedAt) } : {}),
    author: a.author ? authorRef(a.author) : { '@id': ORGANIZATION_ID },
    publisher: { '@id': ORGANIZATION_ID },
    mainEntityOfPage: { '@id': url },
    isPartOf: { '@id': WEBSITE_ID },
    ...(a.section ? { articleSection: a.section.name } : {}),
    ...(a.products.length
      ? {
          mentions: a.products.map((p) =>
            p.pros.length || p.cons.length
              ? { '@id': productAnchorUrl(a.slug, p.slug) }
              : { '@type': 'Thing', name: p.name }),
        }
      : {}),
  }
}

// Pagina care contine articolul: verificatorul (reviewedBy) sta aici — BlogPosting nu are
// proprietatea in schema.org, WebPage da.
export function webPageLd(a: ArticleLdInput) {
  const url = articleUrl(a.slug)
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': url,
    url,
    name: a.title,
    inLanguage: 'ro-RO',
    isPartOf: { '@id': WEBSITE_ID },
    mainEntity: { '@id': `${url}#article` },
    primaryImageOfPage: { '@type': 'ImageObject', url: articleImageUrl(a.slug), width: 1200, height: 630 },
    ...(a.reviewer
      ? { reviewedBy: authorRef(a.reviewer), ...(isoDate(a.updatedAt) ? { lastReviewed: isoDate(a.updatedAt) } : {}) }
      : {}),
  }
}

// Lista produselor din articol, in ordinea aparitiei; fiecare element duce la cardul lui (#produs-…)
export function articleItemListLd(a: ArticleLdInput) {
  if (!a.products.length) return null
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: a.title,
    numberOfItems: a.products.length,
    itemListElement: a.products.map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: productAnchorUrl(a.slug, p.slug),
      name: p.name,
    })),
  }
}

// Acasa → tema → articol; fara tema, treapta din mijloc e lista articolelor (/ghiduri).
// Aceleasi trepte ca firimiturile vizibile (articleCrumbs, folosit de pagina).
export function articleCrumbs(a: Pick<ArticleLdInput, 'slug' | 'title' | 'section'>): { name: string; path: string }[] {
  return [
    { name: 'Acasă', path: '/' },
    a.section ? { name: a.section.name, path: `/c/${a.section.slug}` } : { name: 'Ghiduri', path: '/ghiduri' },
    { name: a.title, path: `/ghiduri/${a.slug}` },
  ]
}

export function articleBreadcrumbLd(a: ArticleLdInput) {
  return breadcrumbLd(articleCrumbs(a))
}

// Toate nodurile articolului, fiecare in propriul <script> (fara @graph)
export function articleLd(a: ArticleLdInput): object[] {
  return [
    blogPostingLd(a),
    webPageLd(a),
    articleBreadcrumbLd(a),
    articleItemListLd(a),
    ...a.products.map((p) => productReviewLd(a, p)),
    faqPageLd(a.faq),
  ].filter((x): x is NonNullable<typeof x> => x != null)
}

// --- Pagina de autor ------------------------------------------------------------------------

export interface AuthorPageInput extends LdAuthor {
  articles: { slug: string; title: string }[]
}

export function authorProfileLd(a: AuthorPageInput) {
  const url = authorUrl(a.slug)
  const sameAs = externalProfileUrl(a.url)
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    '@id': url,
    url,
    name: a.name,
    inLanguage: 'ro-RO',
    isPartOf: { '@id': WEBSITE_ID },
    mainEntity: {
      '@type': a.kind === 'organization' ? 'Organization' : 'Person',
      '@id': authorId(a),
      name: a.name,
      url,
      ...(a.bio ? { description: a.bio } : {}),
      ...(sameAs ? { sameAs: [sameAs] } : {}),
      ...(a.kind === 'person' ? { worksFor: { '@id': ORGANIZATION_ID } } : { parentOrganization: { '@id': ORGANIZATION_ID } }),
    },
    hasPart: a.articles.map((g) => ({ '@type': 'BlogPosting', '@id': `${articleUrl(g.slug)}#article`, headline: g.title, url: articleUrl(g.slug) })),
  }
}

export { SITE_URL }

// JSON in <script>: „<” scapat, ca un titlu cu „</script>” sa nu poata inchide tagul
export function ldScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}
