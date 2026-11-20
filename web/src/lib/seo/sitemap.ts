// Sitemap (sitemap index). Pure: construieste XML-ul; datele vin din lib/seo/sitemap-data.ts,
// rutele sunt app/sitemap.xml si app/sitemaps/[fisier].
//
// Structura (blog de recomandari, 20 nov. 2026):
//   /sitemap.xml          → INDEX (acelasi URL ca inainte: Search Console / robots.txt nu se schimba)
//   /sitemaps/pagini.xml  → homepage, /ghiduri, metodologie, articolele, temele /c/, autorii,
//                           paginile legale. Fisierele produse-N.xml au disparut odata cu /p/.
//
// `lastmod` doar unde e REAL (Google ignora un lastmod care „minte” sistematic): articole =
// updated_at; /ghiduri = cel mai recent articol; restul fara lastmod.

import { absUrl } from './site'

export const SITEMAP_FILES = ['pagini.xml'] as const

export interface SitemapEntry {
  path: string                    // cale relativa („/c/laptopuri”) sau URL absolut
  lastmod?: Date | string | null
  images?: string[]               // <image:image> (articole: imaginea Open Graph generata)
}

export function xmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

function lastmodTag(v: Date | string | null | undefined): string {
  if (!v) return ''
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? '' : `<lastmod>${d.toISOString()}</lastmod>`
}

function imageTags(images: string[] | undefined): string {
  return (images ?? []).map((i) => `<image:image><image:loc>${xmlEscape(absUrl(i))}</image:loc></image:image>`).join('')
}

export function urlsetXml(entries: SitemapEntry[]): string {
  const body = entries.map((e) => `<url><loc>${xmlEscape(absUrl(e.path))}</loc>${lastmodTag(e.lastmod)}${imageTags(e.images)}</url>`).join('\n')
  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n' +
    `${body}\n</urlset>\n`
}

export function sitemapIndexXml(entries: SitemapEntry[]): string {
  const body = entries.map((e) => `<sitemap><loc>${xmlEscape(absUrl(e.path))}</loc>${lastmodTag(e.lastmod)}</sitemap>`).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</sitemapindex>\n`
}

// Doar fisierele din SITEMAP_FILES exista; restul (inclusiv vechile produse-N.xml) → 404
export function isSitemapFile(name: string): boolean {
  return (SITEMAP_FILES as readonly string[]).includes(name)
}

// Cel mai recent lastmod dintr-o lista (pentru <lastmod> din index); null daca niciunul
export function latestLastmod(entries: SitemapEntry[]): Date | null {
  let max = 0
  for (const e of entries) {
    if (!e.lastmod) continue
    const t = new Date(e.lastmod).getTime()
    if (!Number.isNaN(t) && t > max) max = t
  }
  return max ? new Date(max) : null
}

// Paginile de incredere (Despre, Contact, politici) — cerute de Google pentru site-urile de afiliere
export const LEGAL_PAGES = ['/despre', '/contact', '/confidentialitate', '/termeni', '/cookies']

export interface PageSources {
  guides: { slug: string; updated_at: string }[]
  themes: { slug: string }[]          // temele /c/ (parintii vizibili)
  authors: { slug: string }[]         // autori cu cel putin un articol publicat
}

// Lista din pagini.xml, in ordinea: homepage, articole, teme, autori, pagini legale
export function buildPageEntries(s: PageSources): SitemapEntry[] {
  const latestGuide = s.guides.reduce<string | null>((m, g) => (!m || g.updated_at > m ? g.updated_at : m), null)
  return [
    { path: '/' },   // se schimba la fiecare articol nou, fara o data „reala” proprie → fara lastmod
    { path: '/ghiduri', lastmod: latestGuide },
    { path: '/ghiduri/metodologie' },
    ...s.guides.map((g) => ({
      path: `/ghiduri/${g.slug}`,
      lastmod: g.updated_at,
      images: [`/ghiduri/${g.slug}/opengraph-image`],
    })),
    ...s.themes.map((c) => ({ path: `/c/${c.slug}` })),
    ...s.authors.map((a) => ({ path: `/autori/${a.slug}` })),
    ...LEGAL_PAGES.map((path) => ({ path })),
  ]
}
