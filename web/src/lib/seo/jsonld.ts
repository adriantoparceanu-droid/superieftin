import { COMPANY } from '../company'
import { ORGANIZATION_ID, SITE_NAME, SITE_URL, WEBSITE_ID, absUrl } from './site'

// Date structurate (schema.org) comune. Pure (fara DB) — testate in jsonld.test.ts.
// Reguli: fara Review / AggregateRating (nu avem recenzii reale); URL-urile din marcaj sunt
// paginile NOASTRE (niciodata /go/ — e blocat in robots.txt si e redirect de afiliere).
//
// ATENTIE: worker/src/ads/campaigns/validate.ts (ads:validate + garda ads-guard) citeste
// JSON-LD-ul paginilor din reclame: cauta un nod top-level cu "@type": "Product" si verifica
// `offers.availability` (obiect sau lista) + linkurile /c/<slug> din BreadcrumbList.
// Nu muta Product intr-un @graph si nu scoate `availability` de pe AggregateOffer.

// Organizatia din spatele site-ului (o singura data, in layout). Datele firmei vin din company.ts.
export function organizationLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': ORGANIZATION_ID,
    name: SITE_NAME,
    url: `${SITE_URL}/`,
    description: 'Comparator de prețuri cu istoric pentru magazinele online din România.',
    ...(COMPANY.name ? { legalName: COMPANY.name } : {}),
    ...(COMPANY.email ? { email: COMPANY.email } : {}),
    ...(COMPANY.address ? { address: { '@type': 'PostalAddress', streetAddress: COMPANY.address, addressCountry: 'RO' } } : {}),
    ...(COMPANY.cui ? { taxID: COMPANY.cui } : {}),
    // `logo` si `sameAs` lipsesc intentionat: nu exista inca un logo raster nici profiluri
    // externe (raport SEO, A6 / E5). Se adauga aici cand exista.
  }
}

// Site-ul + cautarea interna. publisher = referinta la Organization (acelasi @id).
export function websiteLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    name: SITE_NAME,
    url: `${SITE_URL}/`,
    inLanguage: 'ro-RO',
    description: 'Comparator de prețuri cu istoric — reduceri reale pe piața din România',
    publisher: { '@id': ORGANIZATION_ID },
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${SITE_URL}/cautare?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  }
}

export interface Crumb { name: string; path: string }

export function breadcrumbLd(items: Crumb[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((b, i) => ({ '@type': 'ListItem', position: i + 1, name: b.name, item: absUrl(b.path) })),
  }
}

export function itemListLd(name: string, items: { name: string; path: string }[], opts: { total?: number; startPosition?: number } = {}) {
  const start = opts.startPosition ?? 1
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    numberOfItems: opts.total ?? items.length,
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: start + i, url: absUrl(it.path), name: it.name })),
  }
}

// --- Product --------------------------------------------------------------------------------

export interface ProductLdInput {
  id: string
  name: string
  slug: string
  image: string | null
  brand: string | null
  partNo?: string | null
  tags?: string[]                  // slug-urile tag-urilor (refurbished, second-hand)
  offers: { price: number | null; retailer: string }[]   // DOAR ofertele disponibile acum
}

const CONDITION: Record<string, string> = {
  refurbished: 'https://schema.org/RefurbishedCondition',
  'second-hand': 'https://schema.org/UsedCondition',
}

export function itemConditionFor(tags: string[] = []): string {
  for (const t of tags) if (CONDITION[t]) return CONDITION[t]
  return 'https://schema.org/NewCondition'
}

// GTIN valid (8/12/13/14 cifre cu cifra de control corecta). Unele feed-uri pun EAN-ul in part_no
// (ex. 8806097826972): atunci il declaram ca gtin, altfel ca mpn (codul producatorului).
export function isValidGtin(code: string): boolean {
  if (!/^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(code)) return false
  const digits = code.split('').map(Number)
  const check = digits.pop()!
  const sum = digits.reverse().reduce((s, d, i) => s + d * (i % 2 === 0 ? 3 : 1), 0)
  return (10 - (sum % 10)) % 10 === check
}

// Product cu AggregateOffer (lowPrice/highPrice/offerCount) + ofertele individuale.
// Fara nicio oferta cu pret → null (Google: „Either offers, review or aggregateRating should be
// specified”); pagina respectiva e oricum noindex.
export function productLd(p: ProductLdInput) {
  const offers = p.offers.filter((o): o is { price: number; retailer: string } => o.price != null && o.price > 0)
  if (!offers.length) return null
  const url = absUrl(`/p/${p.slug}`)
  const condition = itemConditionFor(p.tags)
  const prices = offers.map((o) => o.price)
  const code = p.partNo?.trim() || null
  const gtin = code && isValidGtin(code) ? code : null
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${url}#product`,
    name: p.name,
    url,
    ...(p.image ? { image: p.image } : {}),
    sku: p.id,
    ...(gtin ? { gtin } : code ? { mpn: code } : {}),
    ...(p.brand ? { brand: { '@type': 'Brand', name: p.brand } } : {}),
    // Fara `category`: validatorul campaniilor trateaza Product.category ca slug de categorie
    // (si ar cere /c/<valoare>); categoria reiese din BreadcrumbList-ul paginii.
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'RON',
      lowPrice: Math.min(...prices),
      highPrice: Math.max(...prices),
      offerCount: offers.length,
      availability: 'https://schema.org/InStock',
      url,
      offers: offers.map((o) => ({
        '@type': 'Offer',
        price: o.price,
        priceCurrency: 'RON',
        availability: 'https://schema.org/InStock',
        itemCondition: condition,
        seller: { '@type': 'Organization', name: o.retailer },
        url,
      })),
    },
  }
}

// JSON in <script>: „<” scapat, ca un nume de produs cu „</script>” sa nu poata inchide tagul.
export function ldScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}
