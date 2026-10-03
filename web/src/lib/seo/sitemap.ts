// Sitemap impartit (sitemap index). Pure: construieste XML-ul si decide impartirea; datele vin
// din rutele app/sitemap.xml si app/sitemaps/[fisier].
//
// Structura (decizia din raportul SEO 2026-10-04, A7):
//   /sitemap.xml                  → INDEX (acelasi URL ca inainte: Search Console nu trebuie schimbat)
//   /sitemaps/pagini.xml          → homepage, pagini statice, ghiduri, /c/, /t/, /reduceri-reale/*
//   /sitemaps/produse-1.xml, -2…  → paginile de produs disponibile, cate PRODUCTS_PER_SITEMAP
//
// `lastmod` doar unde e REAL (Google ignora un lastmod care „minte” sistematic): produse = ultima
// schimbare de pret, ghiduri = updated_at; categoriile/landing-urile NU au lastmod.

import { absUrl } from './site'

export const PRODUCTS_PER_SITEMAP = 10_000

export interface SitemapEntry {
  path: string                    // cale relativa („/c/laptopuri”) sau URL absolut
  lastmod?: Date | string | null
}

export function xmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

function lastmodTag(v: Date | string | null | undefined): string {
  if (!v) return ''
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? '' : `<lastmod>${d.toISOString()}</lastmod>`
}

export function urlsetXml(entries: SitemapEntry[]): string {
  const body = entries.map((e) => `<url><loc>${xmlEscape(absUrl(e.path))}</loc>${lastmodTag(e.lastmod)}</url>`).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`
}

export function sitemapIndexXml(entries: SitemapEntry[]): string {
  const body = entries.map((e) => `<sitemap><loc>${xmlEscape(absUrl(e.path))}</loc>${lastmodTag(e.lastmod)}</sitemap>`).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</sitemapindex>\n`
}

// Cate fisiere de produse sunt necesare (0 produse → 0 fisiere)
export function productSitemapCount(totalProducts: number): number {
  return Math.ceil(Math.max(0, totalProducts) / PRODUCTS_PER_SITEMAP)
}

export function sitemapFileNames(totalProducts: number): string[] {
  const n = productSitemapCount(totalProducts)
  return ['pagini.xml', ...Array.from({ length: n }, (_, i) => `produse-${i + 1}.xml`)]
}

// „pagini.xml” → { kind: 'pages' }; „produse-2.xml” → { kind: 'products', index: 2 }; altceva → null
export function parseSitemapFile(name: string): { kind: 'pages' } | { kind: 'products'; index: number } | null {
  if (name === 'pagini.xml') return { kind: 'pages' }
  const m = name.match(/^produse-([1-9]\d{0,4})\.xml$/)
  return m ? { kind: 'products', index: Number(m[1]) } : null
}

// Felia de produse pentru fisierul `index` (1-based). Lista trebuie sa fie intr-o ordine
// stabila (dupa id), altfel produsele „sar” intre fisiere de la o zi la alta.
export function productSlice<T>(all: T[], index: number): T[] {
  const start = (index - 1) * PRODUCTS_PER_SITEMAP
  return all.slice(start, start + PRODUCTS_PER_SITEMAP)
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
