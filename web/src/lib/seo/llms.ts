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
import { PRODUCT_INDEX_MIN_HISTORY_DAYS, PRODUCT_INDEX_MIN_PRICE_CHANGES, PRODUCT_INDEX_MIN_STORES } from './product-index'
import { COMPANY } from '../company'
import { SITE_URL, formatRoDate, roCount } from './site'
import type { SiteFacts } from './site-facts'
import { editionFact, monthLabel, monthSlug, type Edition } from '../observator/observator'

export interface LlmsCategory { slug: string; name: string; parent_slug: string | null; products: number }
export interface LlmsGuide { slug: string; title: string; meta_description: string | null }
export interface LlmsGuideFull extends LlmsGuide {
  summary: string | null
  body_md: string
  faq: { q: string; a: string }[]
  updated_at: string
}

// Observatorul reducerilor reale (/indice, /cand-sa-cumperi, /black-friday-2026) — opțional: fără
// date (tabelele lipsă, nicio ediție) secțiunea are doar linkurile și metodologia.
export interface LlmsObservator {
  latestEdition: Edition | null
  timing: { slug: string; name: string }[]   // categoriile cu pagină „Când să cumperi”
}

export interface LlmsData {
  observator?: LlmsObservator
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
    `- Ofertele neconfirmate de ${OFFER_STALE_DAYS} zile sunt ascunse. O pagină de produs se indexează doar dacă are o ofertă disponibilă, o categorie (în afara Sănătate & Naturale), cel puțin ${PRODUCT_INDEX_MIN_HISTORY_DAYS} de zile de istoric de preț și fie cel puțin ${PRODUCT_INDEX_MIN_STORES} magazine cu ofertă disponibilă, fie cel puțin ${PRODUCT_INDEX_MIN_PRICE_CHANGES} schimbări de preț în ultimele 60 de zile; variantele aproape identice (alte culori) trimit prin canonical la pagina principală; celelalte rămân accesibile, dar nu sunt indexate.`,
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

function observatorLines(o: LlmsObservator | undefined): string[] {
  const out = [
    '## Observatorul reducerilor reale',
    '',
    `- [Black Friday 2026](${SITE_URL}/black-friday-2026): câte dintre reducerile din perioada Black Friday sunt reale, măsurat zilnic din 1 noiembrie 2026 față de mediana prețurilor de dinainte de 1 noiembrie`,
    `- [Indicele prețurilor](${SITE_URL}/indice): lunar, variația prețului tipic pe categorii, pe un coș stabil de produse (produse cu preț în stoc în ambele luni comparate); variația = mediana variațiilor pe produs; edițiile publicate nu se modifică`,
    `- [Când să cumperi](${SITE_URL}/cand-sa-cumperi): pe categorii, cât de des au apărut reduceri reale și cât au durat, doar pentru perioada urmărită (fără afirmații despre tipare anuale sub 12 luni de date)`,
    `- [Metodologie](${SITE_URL}/ghiduri/metodologie): cum calculăm mediana și reducerea reală`,
  ]
  const e = o?.latestEdition
  if (e) out.push(`- Ultima ediție a indicelui ([${monthLabel(e.month)}](${SITE_URL}/indice/${monthSlug(e.month)})): ${editionFact(e)}`)
  if (o?.timing.length) {
    out.push(`- Categorii cu pagină „Când să cumperi”: ${o.timing.map((c) => `[${c.name}](${SITE_URL}/cand-sa-cumperi/${c.slug})`).join(', ')}`)
  }
  out.push('')
  return out
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
    '> Observatorul reducerilor reale din România: urmărim zilnic prețurile magazinelor online, păstrăm istoricul și ' +
      `marcăm ca „reducere reală” doar prețurile cu minim ${REAL_DISCOUNT_PCT}% sub mediana ultimelor 30 de zile. ` +
      'Publicăm lunar indicele prețurilor pe categorii; comparatorul de prețuri pornește de la această analiză.',
    '',
    ...factsLines(d.facts),
    ...observatorLines(d.observator),
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
    'superieftin.ro este observatorul reducerilor reale din România: măsurăm zilnic prețurile din magazinele online și ' +
      'spunem, cu date, dacă o „reducere” e reală sau doar un preț vechi umflat. Preluăm zilnic prețurile produselor de la ' +
      'magazinele partenere și le păstrăm istoricul; pe pagina fiecărui produs vezi graficul de preț și mediana, ca să verifici singur.',
    '',
    'Pe lângă paginile de produs publicăm, calculate automat din aceleași prețuri: indicele lunar al prețurilor (/indice, ' +
      'pe un coș stabil de produse; o ediție publicată nu se mai modifică), paginile „Când să cumperi” pe categorii ' +
      '(/cand-sa-cumperi — doar perioada urmărită, fără estimări de preț) și măsurătorile zilnice de Black Friday 2026 ' +
      '(/black-friday-2026, din 1 noiembrie, față de mediana de dinainte de 1 noiembrie). Sănătate & Naturale nu intră în aceste pagini.',
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
