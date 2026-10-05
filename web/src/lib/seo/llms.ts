// Textele /llms.txt si /llms-full.txt (propunere de standard: llmstxt.org) — pure, testate in
// llms.test.ts; datele le aduc rutele app/llms.txt si app/llms-full.txt.
//
// Reguli (raport SEO 2026-10-04, D2/D3):
// - fapte LIVE (cate produse, magazine, de cand avem istoric, cate reduceri reale) cu data generarii;
// - onest: majoritatea produselor au o singura oferta, valoarea principala e istoricul + mediana;
// - FARA preturi in llms-full.txt: marcajele din ghiduri devin „vezi prețul live pe <URL>”, ca un
//   asistent AI sa nu citeze un pret vechi (REGULI.md, regula 9);
// - Sanatate & Naturale apare la categorii (SEO organic e permis), dar fara landing de reduceri.

import { ABOVE_MEDIAN_PCT, FRESH_HOURS, REAL_DISCOUNT_PCT } from '../discount'
import { OFFER_STALE_DAYS } from '../availability'
import { PRODUCT_INDEX_MIN_HISTORY_DAYS } from './product-index'
import { COMPANY } from '../company'
import { SITE_URL, formatRoDate, roCount } from './site'
import type { SiteFacts } from './site-facts'

export interface LlmsCategory { slug: string; name: string; parent_slug: string | null; products: number }
export interface LlmsGuide { slug: string; title: string; meta_description: string | null }
export interface LlmsGuideFull extends LlmsGuide {
  summary: string | null
  body_md: string
  faq: { q: string; a: string }[]
  updated_at: string
}

export interface LlmsData {
  facts: SiteFacts | null
  guides: LlmsGuide[]
  categories: LlmsCategory[]     // indexabile (vizibile, cu produse disponibile)
  landings: LlmsCategory[]       // cu landing /reduceri-reale/ (fara Sanatate & Naturale)
}

function generatedLine(iso: string): string {
  const d = new Date(iso)
  const time = new Intl.DateTimeFormat('ro-RO', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Bucharest' }).format(d)
  return `Generat: ${formatRoDate(d)}, ora ${time} (ora României). Cifrele se recalculează cel mult o dată pe oră.`
}

function factsLines(f: SiteFacts | null): string[] {
  if (!f) return []
  const out = ['## Cifre live', '']
  out.push(`- Produse urmărite, cu cel puțin o ofertă disponibilă acum: ${f.products.toLocaleString('ro-RO')}`)
  out.push(`- Magazine cu oferte disponibile acum: ${f.retailers.toLocaleString('ro-RO')}`)
  if (f.historySince) out.push(`- Istoric de preț din: ${formatRoDate(f.historySince)}`)
  out.push(`- Produse cu reducere reală acum (fără Sănătate & Naturale): ${f.realDiscounts.toLocaleString('ro-RO')}`)
  out.push(`- ${generatedLine(f.generatedAt)}`)
  out.push('')
  return out
}

function methodologyLines(): string[] {
  return [
    '## Cum funcționează',
    '',
    '- Prețurile vin din feed-urile magazinelor (prin rețelele de afiliere) și din scanări periodice; fiecare preț intră în istoric.',
    `- Mediana 30 de zile = prețul „din mijloc” al ultimelor 30 de zile pentru fiecare ofertă; e puțin influențată de un preț urcat pentru câteva zile înainte de o promoție.`,
    `- Reducere reală = preț curent cu cel puțin ${REAL_DISCOUNT_PCT}% sub mediana ultimelor 30 de zile (nu față de „prețul vechi” afișat de magazin).`,
    `- Între ${REAL_DISCOUNT_PCT}% sub și ${ABOVE_MEDIAN_PCT}% peste mediană: „preț în intervalul obișnuit”; peste ${ABOVE_MEDIAN_PCT}%: mai scump decât de obicei.`,
    `- Pe paginile /reduceri-reale/ și pe homepage, o reducere reală apare doar pentru prețuri verificate în ultimele ${FRESH_HOURS} de ore.`,
    `- Ofertele neconfirmate de ${OFFER_STALE_DAYS} zile sunt ascunse. O pagină de produs se indexează doar dacă are o ofertă disponibilă, o categorie (în afara Sănătate & Naturale) și cel puțin ${PRODUCT_INDEX_MIN_HISTORY_DAYS} de zile de istoric de preț; celelalte rămân accesibile, dar nu sunt indexate.`,
    '- Majoritatea produselor au o singură ofertă monitorizată; valoarea principală a site-ului e istoricul de preț și comparația cu mediana, nu numărul de magazine.',
    '- Linkurile spre magazine sunt de afiliere (Profitshare, 2Performant); comisionul nu influențează ordinea ofertelor (ordonate după preț) și nici verdictul.',
    '- Prețurile din ghiduri se completează automat din date, nu sunt scrise de mână.',
    '',
    '## Ce găsești pe o pagină de produs (/p/<slug>)',
    '',
    '- prețul de azi la fiecare magazin cu ofertă disponibilă și data ultimei verificări;',
    '- mediana ultimelor 30 de zile și diferența față de ea (verdict: reducere reală / preț în intervalul obișnuit / peste mediană);',
    '- graficul de preț pe ultimele 90 de zile (sau de la prima înregistrare, pentru produsele urmărite de mai puțin timp), cu minimul și maximul perioadei, și un rezumat în cuvinte („Pe scurt despre preț”);',
    '- alerta de preț (Telegram / email): te anunță când prețul ajunge la pragul ales.',
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
    '- Prețurile se schimbă zilnic: când citezi un preț sau o reducere, menționează data și trimite la pagina produsului.',
    `- „Reducere reală” are definiția de mai sus (minim ${REAL_DISCOUNT_PCT}% sub mediana 30 de zile); nu e o promisiune că prețul va scădea.`,
    '- Linkurile spre magazine (/go/…) sunt de afiliere și nu trebuie accesate automat; citește paginile /p/, /c/, /reduceri-reale/ și /ghiduri/.',
    '',
  ]
}

export function buildLlmsTxt(d: LlmsData): string {
  const lines: string[] = [
    '# superieftin.ro',
    '',
    '> Comparator de prețuri cu istoric pentru magazinele online din România. Urmărim zilnic prețurile și ' +
      `marcăm ca „reducere reală” doar prețurile cu minim ${REAL_DISCOUNT_PCT}% sub mediana ultimelor 30 de zile.`,
    '',
    ...factsLines(d.facts),
    ...methodologyLines(),
    '## Pagini principale',
    '',
    `- [Metodologie](${SITE_URL}/ghiduri/metodologie): cum verificăm prețurile și reducerile`,
    `- [Despre noi](${SITE_URL}/despre): ce face site-ul și cine îl operează`,
    `- [Contact](${SITE_URL}/contact): date de contact și datele firmei`,
    `- [Ghiduri](${SITE_URL}/ghiduri): lista ghidurilor de cumpărare`,
    `- [Reduceri reale azi, pe categorii](${SITE_URL}/reduceri-reale): toate categoriile cu reduceri verificate față de mediană`,
    `- [Text complet (llms-full.txt)](${SITE_URL}/llms-full.txt): metodologia și ghidurile publicate, integral`,
    `- [Sitemap](${SITE_URL}/sitemap.xml)`,
    '',
  ]

  if (d.guides.length) {
    lines.push('## Ghiduri', '')
    for (const g of d.guides) {
      lines.push(`- [${g.title}](${SITE_URL}/ghiduri/${g.slug})${g.meta_description ? `: ${g.meta_description}` : ''}`)
    }
    lines.push('')
  }

  if (d.categories.length) {
    lines.push('## Categorii', '')
    const roots = d.categories.filter((c) => !c.parent_slug)
    const listed = new Set<string>()
    const line = (c: LlmsCategory, indent: string) => {
      listed.add(c.slug)
      return `${indent}- [${c.name}](${SITE_URL}/c/${c.slug}): ${roCount(c.products, 'produse disponibile', 'produs disponibil')}`
    }
    for (const r of roots) {
      lines.push(line(r, ''))
      for (const c of d.categories.filter((x) => x.parent_slug === r.slug)) lines.push(line(c, '  '))
    }
    for (const c of d.categories) if (!listed.has(c.slug)) lines.push(line(c, ''))
    lines.push('')
  }

  if (d.landings.length) {
    lines.push('## Reduceri reale pe categorii', '')
    for (const l of d.landings) lines.push(`- [Reduceri reale la ${l.name}](${SITE_URL}/reduceri-reale/${l.slug})`)
    lines.push('')
  }

  lines.push(...contactLines(), ...notesLines())
  return lines.join('\n')
}

// Marcajele live din ghiduri ({{oferte:ref}}, {{pret:ref}}…) → text simplu, fara preturi
const MARKER_RE = /\{\{\s*(oferte|pret|istoric-pret|reducere|comparatie)\s*:\s*([^{}\n]+?)\s*\}\}/g

export function stripGuideMarkers(md: string, guideUrl: string): string {
  return md.replace(MARKER_RE, (_m, _type: string, refs: string) => {
    const urls = refs.split(',').map((r) => r.trim()).filter(Boolean)
      .map((r) => (/^\d{1,18}$/.test(r) ? guideUrl : `${SITE_URL}/p/${r}`))
    const unique = [...new Set(urls)]
    return `(vezi prețul live pe ${unique.join(', ')})`
  }).replace(/\{\{[^{}\n]*\}\}/g, '')
}

// „Despre” de mai jos rezuma app/despre/page.tsx — daca schimbi textul acolo, actualizeaza-l si aici.
export function buildLlmsFull(d: LlmsData, guides: LlmsGuideFull[]): string {
  const parts: string[] = [buildLlmsTxt(d), '---', '', '# Despre superieftin.ro', '',
    'superieftin.ro este un comparator de prețuri pentru magazinele online din România. Scopul lui e simplu: ' +
      'să vezi dacă o „reducere” e reală sau doar un preț vechi umflat. Preluăm zilnic prețurile produselor de la ' +
      'magazinele partenere și le păstrăm istoricul; pe pagina fiecărui produs vezi graficul de preț și mediana, ca să verifici singur.',
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
