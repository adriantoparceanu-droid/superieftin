import { COMPANY } from '../company'
import { ORGANIZATION_ID, SITE_NAME, SITE_URL, WEBSITE_ID, absUrl } from './site'

// Date structurate (schema.org) comune. Pure (fara DB) — testate in seo.test.ts.
// Reguli: fara Review / AggregateRating (nu avem recenzii reale ale utilizatorilor; singura exceptie
// = recenzia editoriala pro/contra din articole, fara note — lib/guides/jsonld.ts); URL-urile din marcaj sunt
// paginile NOASTRE (niciodata /go/ — e blocat in robots.txt si e redirect de afiliere).
// Product cu oferte (paginile /p/) a disparut odata cu comparatorul (blog de recomandari, 20 nov. 2026).

// Descrierea organizatiei (o folosesc si homepage-ul / llms.txt ca formulare de baza)
export const ORGANIZATION_DESCRIPTION =
  'Blog de recomandări de produse din România: top-uri pe buget, comparații și ghiduri de alegere, ' +
  'cu cel mai bun preț găsit la magazinele partenere. Articolele sunt verificate de un om înainte de publicare.'

// Organizatia din spatele site-ului (o singura data, in layout). Datele firmei vin din company.ts.
export function organizationLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': ORGANIZATION_ID,
    name: SITE_NAME,
    url: `${SITE_URL}/`,
    // Identitatea din reorganizarea din 20 nov. 2026 (docs/plans/2026-11-20-reorganizare-blog-design.md):
    // blog de recomandări; datele de preț sunt unealtă internă.
    description: ORGANIZATION_DESCRIPTION,
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
    description: 'Blog de recomandări de produse din România — top-uri pe buget, comparații și ghiduri de alegere',
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

// FAQPage din perechi întrebare/răspuns în text simplu (aceleași texte ca pe pagină)
export function faqPageLd(items: { q: string; a: string }[]) {
  const list = items.filter((f) => f.q.trim() && f.a.trim())
  if (!list.length) return null
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: list.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  }
}

// JSON in <script>: „<” scapat, ca un nume de produs cu „</script>” sa nu poata inchide tagul.
export function ldScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}
