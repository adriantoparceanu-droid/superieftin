// Textele /llms.txt si /llms-full.txt (propunere de standard: llmstxt.org) — pure, testate in
// seo.test.ts; datele le aduc rutele app/llms.txt si app/llms-full.txt (lib/seo/llms-data.ts).
//
// Din 20 nov. 2026 superieftin.ro e un BLOG DE RECOMANDARI (reorganizarea din
// docs/plans/2026-11-20-reorganizare-blog-design.md). Reguli:
// - identitatea, cum alegem produsele, cum ne finantam (afiliere), lista articolelor cu rezumat,
//   temele, metodologia, RSS — fara comparator, observator, „reduceri reale”, indice;
// - FARA preturi: marcajele din articole devin trimiteri spre cardul produsului din articol, ca un
//   asistent AI sa nu citeze un pret vechi (REGULI.md, regula 9).

import { OFFER_STALE_DAYS } from '../availability'
import { COMPANY } from '../company'
import { RSS_PATH } from '../guides/rss'
import { SITE_URL, formatRoDate } from './site'

export interface LlmsTheme { slug: string; name: string }
export interface LlmsGuide { slug: string; title: string; meta_description: string | null }
export interface LlmsGuideFull extends LlmsGuide {
  summary: string | null
  body_md: string
  faq: { q: string; a: string }[]
  updated_at: string
}

export interface LlmsData {
  guides: LlmsGuide[]
  themes: LlmsTheme[]            // temele /c/ indexabile (indexableThemes, ca in sitemap)
}

const IDENTITY =
  'Blog de recomandări de produse din România: top-uri pe buget, comparații între modele, ghiduri de alegere ' +
  'și „Merită acum?”. Fiecare produs recomandat are un card cu cel mai bun preț găsit la magazinele partenere ' +
  'și un singur buton spre acel magazin.'

function methodologyLines(): string[] {
  return [
    '## Cum alegem produsele',
    '',
    '- Pornim de la ce caută oamenii și de la produsele pe care magazinele partenere le au efectiv în stoc.',
    '- Urmărim zilnic, intern, prețurile magazinelor partenere, ca să nu recomandăm un produs când e mai scump decât de obicei. Istoricul de preț e o unealtă internă, nu e public.',
    '- Caracteristicile tehnice vin din specificațiile producătorului și din fișa produsului de la magazin.',
    '- Pentru fiecare produs recomandat scriem ce face bine și ce face mai slab.',
    '- Ciornele se pot scrie cu ajutorul instrumentelor AI; fiecare articol e citit și verificat de un om înainte de publicare. Autorul și verificatorul apar sub titlu.',
    `- Prețul din card se completează automat din date (nu e scris de mână) și se actualizează periodic. O ofertă negăsită de ${OFFER_STALE_DAYS} zile la magazin nu mai apare; fără ofertă, cardul scrie „Momentan indisponibil la magazinele partenere”.`,
    '- Articolele publicate se verifică săptămânal (produse indisponibile, preț ieșit din bugetul din titlu, articole nerevizuite de mult).',
    '',
    '## Cum ne finanțăm',
    '',
    '- Unele linkuri spre magazine sunt de afiliere (Profitshare, 2Performant): dacă cumperi după un click, magazinul ne plătește un comision. Prețul pentru cumpărător rămâne același.',
    '- Nu primim bani de la producători sau magazine pentru a recomanda un produs; butonul din card duce la magazinul partener cu cel mai bun preț găsit, nu la cel cu comisionul mai mare.',
    '',
  ]
}

function contactLines(): string[] {
  const out = ['## Operator', '']
  if (COMPANY.name) out.push(`- Firma: ${COMPANY.name}${COMPANY.cui ? `, CUI ${COMPANY.cui}` : ''}${COMPANY.regCom ? `, ${COMPANY.regCom}` : ''}`)
  if (COMPANY.address) out.push(`- Sediu: ${COMPANY.address}`)
  if (COMPANY.email) out.push(`- Email: ${COMPANY.email}`)
  out.push(`- [Contact](${SITE_URL}/contact)`, '')
  return out
}

function notesLines(): string[] {
  return [
    '## Note pentru asistenți',
    '',
    '- Prețurile se schimbă des: nu cita un preț din memorie; trimite la articol, unde cardul arată prețul de azi.',
    '- Linkurile spre magazine (/go/…) sunt de afiliere și nu trebuie accesate automat; citește articolele (/ghiduri/…) și temele (/c/…).',
    '',
  ]
}

export function buildLlmsTxt(d: LlmsData): string {
  const lines: string[] = [
    '# superieftin.ro',
    '',
    `> ${IDENTITY}`,
    '',
    ...methodologyLines(),
    '## Pagini principale',
    '',
    `- [Articole](${SITE_URL}/ghiduri): toate articolele, cele mai noi primele`,
    `- [Metodologie](${SITE_URL}/ghiduri/metodologie): cum alegem produsele, cine verifică, cum ne finanțăm`,
    `- [Despre noi](${SITE_URL}/despre): ce face site-ul și cine îl operează`,
    `- [Contact](${SITE_URL}/contact): date de contact și datele firmei`,
    `- [Flux RSS](${SITE_URL}${RSS_PATH}): articolele noi`,
    `- [Text complet (llms-full.txt)](${SITE_URL}/llms-full.txt): metodologia și articolele publicate, integral`,
    `- [Sitemap](${SITE_URL}/sitemap.xml)`,
    '',
  ]

  if (d.guides.length) {
    lines.push('## Articole', '')
    for (const g of d.guides) {
      lines.push(`- [${g.title}](${SITE_URL}/ghiduri/${g.slug})${g.meta_description ? `: ${g.meta_description}` : ''}`)
    }
    lines.push('')
  }

  if (d.themes.length) {
    lines.push('## Teme', '')
    for (const t of d.themes) lines.push(`- [${t.name}](${SITE_URL}/c/${t.slug})`)
    lines.push('')
  }

  lines.push(...contactLines(), ...notesLines())
  return lines.join('\n')
}

// Marcajele din articole → text simplu, fara preturi:
//   {{oferte:ref}} / {{pret:ref}} / {{comparatie:r1,r2}} → trimitere spre cardul din articol
//     (#produs-<slug> pentru ref-urile slug; un id numeric → articolul);
//   {{pro: x}} / {{contra: x}} → „Bun: x” / „Mai slab: x” (sunt text editorial, raman);
//   orice alt marcaj ({{reducere}}, {{istoric-pret}}, necunoscut) → dispare.
const PRODUCT_MARKER_RE = /\{\{\s*(oferte|pret|comparatie)\s*:\s*([^{}\n]+?)\s*\}\}/g
const NOTE_MARKER_RE = /\{\{\s*(pro|contra)\s*:\s*([^{}\n]+?)\s*\}\}/g

export function stripGuideMarkers(md: string, guideUrl: string): string {
  return md
    .replace(PRODUCT_MARKER_RE, (_m, _type: string, refs: string) => {
      const urls = refs.split(',').map((r) => r.trim()).filter(Boolean)
        .map((r) => (/^\d{1,18}$/.test(r) ? guideUrl : `${guideUrl}#produs-${r}`))
      const unique = [...new Set(urls)]
      return `(produsul și prețul de azi: ${unique.join(', ')})`
    })
    .replace(NOTE_MARKER_RE, (_m, type: string, text: string) => `${type === 'pro' ? 'Bun' : 'Mai slab'}: ${text}`)
    .replace(/\{\{[^{}\n]*\}\}/g, '')
}

// „Despre” de mai jos rezuma app/despre/page.tsx — daca schimbi textul acolo, actualizeaza-l si aici.
export function buildLlmsFull(d: LlmsData, guides: LlmsGuideFull[]): string {
  const parts: string[] = [buildLlmsTxt(d), '---', '', '# Despre superieftin.ro', '',
    'superieftin.ro este un blog de recomandări de produse din România. Scriem articole care te ajută să alegi: ' +
      'top-uri pe buget, comparații între modele și ghiduri de alegere. Fiecare produs recomandat are un card cu cel mai ' +
      'bun preț găsit la magazinele partenere și un buton spre acel magazin.',
    '',
    'Prețurile se actualizează periodic, nu în timp real. Prețul final și stocul sunt cele afișate de magazin în momentul comenzii.',
    '',
  ]
  for (const g of guides) {
    const url = `${SITE_URL}/ghiduri/${g.slug}`
    parts.push('---', '', `# ${g.title}`, '', `Sursa: ${url} · actualizat ${formatRoDate(g.updated_at)}`, '')
    if (g.summary) parts.push(`**Pe scurt:** ${stripGuideMarkers(g.summary, url)}`, '')
    parts.push(stripGuideMarkers(g.body_md, url).trim(), '')
    if (g.faq.length) {
      parts.push('## Întrebări frecvente', '')
      for (const f of g.faq) parts.push(`**${stripGuideMarkers(f.q, url)}**`, '', stripGuideMarkers(f.a, url), '')
    }
  }
  return parts.join('\n')
}
