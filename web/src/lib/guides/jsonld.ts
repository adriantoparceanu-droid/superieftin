import { COMPANY } from '../company'
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

// Editorul (publisher) = site-ul, operat de firma din company.ts (singura sursa pentru datele firmei)
export function publisherLd() {
  return {
    '@type': 'Organization',
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

// Product + offers, identic ca structura cu /p/[slug] (doar ofertele disponibile acum).
// Produsele fara nicio oferta disponibila nu se marcheaza (Google cere offers pe Product).
export function productLd(p: LiveProduct) {
  if (!p.offers.length) return null
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    image: p.image_url ?? undefined,
    url: `${SITE_URL}/p/${p.slug}`,
    brand: p.brand ? { '@type': 'Brand', name: p.brand } : undefined,
    category: p.category,
    offers: p.offers.map((o) => ({
      '@type': 'Offer',
      price: o.current_price,
      priceCurrency: 'RON',
      availability: 'https://schema.org/InStock',
      seller: { '@type': 'Organization', name: o.retailer_name },
      url: `${SITE_URL}/go/${o.offer_id}`,
    })),
  }
}

// JSON in <script>: „<” scapat, ca un titlu cu „</script>” sa nu poata inchide tagul
export function ldScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}
