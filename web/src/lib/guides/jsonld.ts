import { COMPANY } from '../company'
import { ORGANIZATION_ID } from '../seo/site'
import { productLd as productLdBase } from '../seo/jsonld'
import type { Guide, GuideAuthor, LiveProduct } from './queries'

// Date structurate (schema.org) pentru pagina de ghid.
// NU folosim Review / AggregateRating cu stele: nu avem recenzii reale ale utilizatorilor, iar
// Google penalizeaza marcajul de recenzie auto-acordat pe site-urile de afiliere.

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.superieftin.ro'

function abs(url: string): string {
  return url.startsWith('http') ? url : `${SITE_URL}${url.startsWith('/') ? '' : '/'}${url}`
}

function personOrOrg(a: GuideAuthor) {
  return {
    '@type': a.kind === 'organization' ? 'Organization' : 'Person',
    name: a.name,
    ...(a.url ? { url: abs(a.url) } : {}),
    ...(a.bio ? { description: a.bio } : {}),
  }
}

// Editorul (publisher) = site-ul, operat de firma din company.ts (singura sursa pentru datele firmei).
// Acelasi @id ca Organization-ul din layout (lib/seo/jsonld.ts) → o singura entitate pe tot site-ul.
export function publisherLd() {
  return {
    '@type': 'Organization',
    '@id': ORGANIZATION_ID,
    name: 'superieftin.ro',
    url: SITE_URL,
    ...(COMPANY.name ? { legalName: COMPANY.name } : {}),
    ...(COMPANY.email ? { email: COMPANY.email } : {}),
    ...(COMPANY.address ? { address: { '@type': 'PostalAddress', streetAddress: COMPANY.address, addressCountry: 'RO' } } : {}),
    ...(COMPANY.cui ? { taxID: COMPANY.cui } : {}),
  }
}

export function blogPostingLd(guide: Guide) {
  const url = `${SITE_URL}/ghiduri/${guide.slug}`
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: guide.title,
    description: guide.meta_description ?? undefined,
    url,
    inLanguage: 'ro-RO',
    datePublished: guide.published_at ? new Date(guide.published_at).toISOString() : undefined,
    dateModified: new Date(guide.updated_at).toISOString(),
    author: guide.author ? personOrOrg(guide.author) : publisherLd(),
    publisher: publisherLd(),
    // BlogPosting nu are „reviewedBy” in schema.org; proprietatea exista pe WebPage, deci
    // verificatorul se declara pe pagina care contine articolul (mainEntityOfPage).
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': url,
      ...(guide.reviewer ? { reviewedBy: personOrOrg(guide.reviewer), lastReviewed: new Date(guide.updated_at).toISOString() } : {}),
    },
    ...(guide.category_name ? { articleSection: guide.category_name } : {}),
  }
}

export function breadcrumbLd(guide: Guide) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Acasă', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Ghiduri', item: `${SITE_URL}/ghiduri` },
      { '@type': 'ListItem', position: 3, name: guide.title, item: `${SITE_URL}/ghiduri/${guide.slug}` },
    ],
  }
}

export function faqLd(guide: Guide) {
  if (!guide.faq.length) return null
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: guide.faq.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  }
}

// Product + AggregateOffer, acelasi constructor ca /p/[slug] (lib/seo/jsonld.ts): doar ofertele
// disponibile acum, Offer.url = pagina produsului (nu /go/ — blocat in robots.txt, redirect afiliat).
// Produsele fara nicio oferta disponibila nu se marcheaza (Google cere offers pe Product).
export function productLd(p: LiveProduct) {
  return productLdBase({
    id: p.id,
    name: p.name,
    slug: p.slug,
    image: p.image_url,
    brand: p.brand,
    offers: p.offers.map((o) => ({ price: o.current_price, retailer: o.retailer_name })),
  })
}

// JSON in <script>: „<” scapat, ca un titlu cu „</script>” sa nu poata inchide tagul
export function ldScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}
