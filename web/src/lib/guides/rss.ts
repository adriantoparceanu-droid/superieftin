import { SITE_NAME, absUrl } from '../seo/site'

// Fluxul RSS 2.0 al articolelor (/ghiduri/feed.xml). Pur — testat in guides.test.ts.
// De ce RSS: agregatoarele, cititoarele RSS si asistentii AI afla repede de articolele noi.

export const RSS_PATH = '/ghiduri/feed.xml'
export const RSS_TITLE = `${SITE_NAME} — articole`
export const RSS_MAX_ITEMS = 50

// `alternates.types` pentru <link rel="alternate" type="application/rss+xml">. Metadata Next se
// combina SUPERFICIAL: o pagina care isi pune `alternates: { canonical }` inlocuieste tot obiectul
// `alternates` din layout, deci pierde linkul RSS → adauga `types: RSS_ALTERNATE_TYPES` alaturi.
export const RSS_ALTERNATE_TYPES = { 'application/rss+xml': [{ url: RSS_PATH, title: RSS_TITLE }] }

export interface RssItem {
  slug: string
  title: string
  description: string | null
  published_at: string | null
  updated_at: string
  author_name: string | null
  category_name: string | null
}

// Escapare XML pentru text si atribute (inclusiv caracterele de control interzise in XML 1.0)
export function xmlEscape(s: string): string {
  return s
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

// RFC 822 (cerut de RSS 2.0): „Fri, 20 Nov 2026 10:00:00 GMT”
function rfc822(v: string | null): string | null {
  if (!v) return null
  const d = new Date(/^\d{4}-\d\d-\d\d \d/.test(v) ? v.replace(' ', 'T').replace(/([+-]\d\d)$/, '$1:00') : v)
  return Number.isNaN(d.getTime()) ? null : d.toUTCString()
}

export function buildRss(items: RssItem[], now: Date = new Date()): string {
  const self = absUrl(RSS_PATH)
  const list = items.slice(0, RSS_MAX_ITEMS)
  const lastBuild = rfc822(list[0]?.published_at ?? null) ?? now.toUTCString()
  const out: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">',
    '<channel>',
    `<title>${xmlEscape(RSS_TITLE)}</title>`,
    `<link>${xmlEscape(absUrl('/ghiduri'))}</link>`,
    '<description>Articole de recomandări: ce merită cumpărat, comparații și ghiduri de alegere.</description>',
    '<language>ro-RO</language>',
    `<lastBuildDate>${lastBuild}</lastBuildDate>`,
    `<atom:link href="${xmlEscape(self)}" rel="self" type="application/rss+xml"/>`,
  ]
  for (const it of list) {
    const link = absUrl(`/ghiduri/${it.slug}`)
    const pub = rfc822(it.published_at)
    out.push(
      '<item>',
      `<title>${xmlEscape(it.title)}</title>`,
      `<link>${xmlEscape(link)}</link>`,
      `<guid isPermaLink="true">${xmlEscape(link)}</guid>`,
      ...(it.description ? [`<description>${xmlEscape(it.description)}</description>`] : []),
      ...(pub ? [`<pubDate>${pub}</pubDate>`] : []),
      ...(it.author_name ? [`<dc:creator>${xmlEscape(it.author_name)}</dc:creator>`] : []),
      ...(it.category_name ? [`<category>${xmlEscape(it.category_name)}</category>`] : []),
      '</item>',
    )
  }
  out.push('</channel>', '</rss>')
  return out.join('\n') + '\n'
}
