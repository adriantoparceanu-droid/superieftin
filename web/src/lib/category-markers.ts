// Textele pe categorii (/c/[categorie]): marcaje cu cifre LIVE, validare si FAQ JSON-LD.
//
// De ce marcaje si nu cifre scrise de mana: numarul de produse, preturile si reducerile se
// schimba zilnic. Un text scris azi cu „756 de telefoane” sau „20 de reduceri” ar minti peste
// o saptamana (REGULI.md, regula 9). Marcajul {{cat:produse}} se inlocuieste la fiecare afisare
// cu valoarea curenta din baza de date (lib/category-content.ts → getCategoryStats).
//
// Fisier FARA acces la DB / Next — functii pure, testate in category-markers.test.ts.
//
// Sintaxa:
//   {{cat:cheie}}                      → doar valoarea (ex. „1.221”, „2.913 lei”, „iunie 2026”)
//   {{cat:cheie|singular|plural}}      → la cheile numerice: numarul + substantivul acordat corect
//                                        („1 laptop”, „12 laptopuri”, „1.221 de laptopuri”)
//
// Cheile (toate calculate DOAR pe ofertele disponibile acum — OFFER_AVAILABLE_SQL; pe o
// categorie-parinte se aduna si subcategoriile):
//   produse        — nr. de produse cu cel putin o oferta disponibila
//   magazine       — nr. de magazine cu oferte disponibile in categorie
//   lista-magazine — numele acelor magazine („eMAG și evomag.ro”)
//   reduceri       — nr. de produse cu „reducere reala” acum (aceeasi regula ca /reduceri-reale/)
//   cu-mediana     — nr. de produse care au deja mediana pe 30 de zile (minim 2 preturi in 30 de zile)
//   pret-median    — pretul median al produselor (cel mai mic pret disponibil per produs)
//   pret-p10 / pret-p90 — 8 din 10 produse costa intre aceste doua valori (fara extremele
//                    produselor mapate gresit, de aceea nu afisam minimul/maximul brut)
//   branduri-top   — primele 5 marci dupa nr. de produse („Samsung, Xiaomi, Apple, Motorola și Honor”)
//   istoric-de-la  — luna din care urmarim preturile in categorie („iunie 2026”)
//   actualizat     — momentul calculului („4 octombrie 2026, ora 14:05”)
//   prag           — pragul reducerii reale („5%”, din lib/discount.ts)

import MarkdownIt from 'markdown-it'
import { REAL_DISCOUNT_PCT } from './discount'
import { findHealthClaims } from './guides/format'

export interface CategoryStats {
  produse: number
  magazine: number
  magazineNume: string[]
  reduceri: number
  cuMediana: number
  pretMedian: number | null
  pretP10: number | null
  pretP90: number | null
  branduri: string[]
  istoricDeLa: string | null   // ISO
  actualizat: string           // ISO
}

export interface CategoryFaqItem {
  q: string
  a: string
}

export const CAT_MARKER_KEYS = [
  'produse', 'magazine', 'lista-magazine', 'reduceri', 'cu-mediana',
  'pret-median', 'pret-p10', 'pret-p90', 'branduri-top', 'istoric-de-la', 'actualizat', 'prag',
] as const
export type CatMarkerKey = (typeof CAT_MARKER_KEYS)[number]

// Cheile la care are sens forma cu substantiv ({{cat:produse|laptop|laptopuri}})
const COUNT_KEYS: CatMarkerKey[] = ['produse', 'magazine', 'reduceri', 'cu-mediana']

// Orice {{cat:…}} — si cele cu cheie gresita, ca sa le putem semnala la validare
const MARKER_RE = /\{\{\s*cat\s*:\s*([^{}|\n]*?)\s*(?:\|([^{}|\n]*)\|([^{}|\n]*))?\s*\}\}/g

export const MAX_FAQ = 6

// ---------- Formatare in romana ----------

// Regula lui „de”: 20 de lei, 101 lei, 120 de lei, 1.000 de lei (ultimele doua cifre 00 sau ≥ 20).
// Doar pentru numere intregi; „2,49 lei” ramane fara „de”.
export function needsDe(n: number): boolean {
  if (!Number.isInteger(n) || n === 0) return false
  const last2 = Math.abs(n) % 100
  return last2 === 0 || last2 >= 20
}

export function formatCount(n: number, singular?: string, plural?: string): string {
  const num = n.toLocaleString('ro-RO')
  if (!singular || !plural) return num
  if (n === 1) return `${num} ${singular}`
  return `${num} ${needsDe(n) ? 'de ' : ''}${plural}`
}

// Preturi: sub 100 lei cu zecimale (doar daca exista), peste 100 rotunjit la leu.
export function formatLei(value: number): string {
  const v = value >= 100 ? Math.round(value) : Math.round(value * 100) / 100
  // sub 100 lei: întreg sau exact 2 zecimale („2,50 lei”, nu „2,5 lei”) — regula din formatPrice
  const d = Number.isInteger(v) ? 0 : 2
  const num = v.toLocaleString('ro-RO', { minimumFractionDigits: d, maximumFractionDigits: d })
  return `${num} ${needsDe(v) ? 'de ' : ''}lei`
}

// „eMAG, evomag.ro și ITGalaxy.ro”
export function joinRo(items: string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  return `${items.slice(0, -1).join(', ')} și ${items[items.length - 1]}`
}

const TZ = 'Europe/Bucharest'

export function formatMonthYear(iso: string): string {
  return new Intl.DateTimeFormat('ro-RO', { month: 'long', year: 'numeric', timeZone: TZ }).format(new Date(iso))
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  const date = new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ }).format(d)
  const time = new Intl.DateTimeFormat('ro-RO', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ }).format(d)
  return `${date}, ora ${time}`
}

// Numele magazinelor din tabela retailers (ex. „rowenta.ro/”) — fara slash-ul final
function cleanRetailer(name: string): string {
  return name.trim().replace(/\/+$/, '')
}

// Valoarea marcajului ca TEXT SIMPLU. null = cheie necunoscuta.
export function markerValue(key: string, stats: CategoryStats, singular?: string, plural?: string): string | null {
  const price = (v: number | null) => (v == null ? '—' : formatLei(v))
  switch (key as CatMarkerKey) {
    case 'produse': return formatCount(stats.produse, singular, plural)
    case 'magazine': return formatCount(stats.magazine, singular, plural)
    case 'reduceri': return formatCount(stats.reduceri, singular, plural)
    case 'cu-mediana': return formatCount(stats.cuMediana, singular, plural)
    case 'lista-magazine': return joinRo(stats.magazineNume.map(cleanRetailer)) || '—'
    case 'pret-median': return price(stats.pretMedian)
    case 'pret-p10': return price(stats.pretP10)
    case 'pret-p90': return price(stats.pretP90)
    case 'branduri-top': return stats.branduri.length ? joinRo(stats.branduri.slice(0, 5)) : 'diverse mărci'
    case 'istoric-de-la': return stats.istoricDeLa ? formatMonthYear(stats.istoricDeLa) : '—'
    case 'actualizat': return formatDateTime(stats.actualizat)
    case 'prag': return `${REAL_DISCOUNT_PCT}%`
    default: return null
  }
}

// Caracterele cu inteles in Markdown, ca un nume de marca (ex. „*Brand_X*”) sa nu strice textul
function escapeMd(s: string): string {
  return s.replace(/([\\`*_[\]<>#])/g, '\\$1')
}

// Inlocuieste marcajele in text. mode 'md' = valorile sunt protejate pentru Markdown (randat
// apoi cu renderMarkdown); 'plain' = text simplu (FAQ JSON-LD). Un marcaj necunoscut dispare
// (pe site nu aratam niciodata „{{…}}”); validarea de la salvare il opreste inainte.
export function renderCategoryMarkers(text: string, stats: CategoryStats, mode: 'md' | 'plain' = 'md'): string {
  return text.replace(MARKER_RE, (_m, key: string, singular?: string, plural?: string) => {
    const v = markerValue(key.trim(), stats, singular?.trim() || undefined, plural?.trim() || undefined)
    if (v == null) return ''
    return mode === 'md' ? escapeMd(v) : v
  })
}

// Markdown-ul textelor de categorie: ca la ghiduri (html: false → HTML-ul scris apare ca text),
// dar FARA linkify — altfel numele magazinelor din {{cat:lista-magazine}} („evomag.ro”) ar
// deveni linkuri directe spre magazin, ocolind /go/. Linkurile se scriu explicit: [text](/c/…).
const md = new MarkdownIt({ html: false, linkify: false, typographer: false, breaks: false })

export function renderCategoryMarkdown(text: string, stats: CategoryStats): string {
  return md.render(renderCategoryMarkers(text, stats, 'md'))
}

// Markdown → text simplu pentru JSON-LD (linkuri → doar textul, fara ** / _ / `).
// NU folosim stripMarkdown din ghiduri: acela sterge si cratimele („USB-C” → „USB C”).
export function markdownToPlain(md: string): string {
  return md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/(^|[\s(])[*_]([^*_\n]+)[*_](?=[\s).,;:!?]|$)/g, '$1$2')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, '')
    .replace(/\\([\\`*_[\]<>#])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

// FAQPage JSON-LD cu raspunsurile randate (cifrele reale de acum), fara Markdown.
export function categoryFaqLd(faq: CategoryFaqItem[], stats: CategoryStats) {
  const items = faq.filter((f) => f.q.trim() && f.a.trim())
  if (!items.length) return null
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((f) => ({
      '@type': 'Question',
      name: markdownToPlain(renderCategoryMarkers(f.q, stats, 'plain')),
      acceptedAnswer: {
        '@type': 'Answer',
        text: markdownToPlain(renderCategoryMarkers(f.a, stats, 'plain')),
      },
    })),
  }
}

// ---------- Validare (la salvarea din admin + test pe textele din migratia 030) ----------

// Promisiuni interzise (regula 9) — textul descrie ce CONSTATAM, nu ce garantam.
const FORBIDDEN_PHRASES = [
  'garantat', 'garantăm', 'garantam', 'economisești', 'economisesti', 'economisiți', 'economisiti',
  'cel mai mic preț din românia', 'cel mai mic pret din romania', 'cele mai mici prețuri',
  'cele mai mici preturi', 'prețuri imbatabile', 'preturi imbatabile', 'cel mai ieftin din',
]

export interface ContentIssue {
  field: string
  message: string
}

// Cifre scrise de mana langa „lei”, „RON” sau „%” (in afara marcajelor).
const HANDWRITTEN_PRICE_RE = /\d[\d.,]*\s*(?:de\s+)?(?:lei|ron)\b|\d[\d.,]*\s*%/i

export function validateCategoryText(field: string, text: string): ContentIssue[] {
  const issues: ContentIssue[] = []
  for (const m of text.matchAll(MARKER_RE)) {
    const key = m[1].trim()
    if (!(CAT_MARKER_KEYS as readonly string[]).includes(key)) {
      issues.push({ field, message: `marcaj necunoscut „${m[0]}” (chei permise: ${CAT_MARKER_KEYS.join(', ')})` })
    } else if (m[2] !== undefined && !COUNT_KEYS.includes(key as CatMarkerKey)) {
      issues.push({ field, message: `„${m[0]}”: forma cu substantiv merge doar la ${COUNT_KEYS.join(', ')}` })
    } else if (m[2] !== undefined && (!m[2].trim() || !m[3]?.trim())) {
      issues.push({ field, message: `„${m[0]}”: lipsește singularul sau pluralul` })
    }
  }
  // Ce ramane dupa scoaterea marcajelor valide: „{{” ramas = marcaj scris gresit
  const rest = text.replace(MARKER_RE, ' ')
  if (/\{\{|\}\}/.test(rest)) issues.push({ field, message: 'acolade „{{ }}” rămase — marcaj scris greșit' })
  if (HANDWRITTEN_PRICE_RE.test(rest)) {
    issues.push({ field, message: 'preț sau procent scris de mână — folosește marcajele {{cat:…}} (ex. {{cat:pret-median}}, {{cat:prag}})' })
  }
  const low = rest.toLowerCase()
  for (const p of FORBIDDEN_PHRASES) {
    if (low.includes(p)) issues.push({ field, message: `formulare interzisă (promisiune): „${p}”` })
  }
  for (const w of findHealthClaims(rest)) {
    issues.push({ field, message: `afirmație de sănătate interzisă (regula 8): „${w}”` })
  }
  return issues
}

export function validateCategoryContent(intro: string, faq: CategoryFaqItem[]): ContentIssue[] {
  const issues = validateCategoryText('text', intro)
  if (faq.length > MAX_FAQ) issues.push({ field: 'FAQ', message: `maxim ${MAX_FAQ} întrebări` })
  faq.forEach((f, i) => {
    if (!f.q.trim() || !f.a.trim()) issues.push({ field: `întrebarea ${i + 1}`, message: 'întrebarea și răspunsul sunt obligatorii' })
    issues.push(...validateCategoryText(`întrebarea ${i + 1}`, f.q))
    issues.push(...validateCategoryText(`răspunsul ${i + 1}`, f.a))
  })
  return issues
}

// FAQ din coloana JSONB (poate fi orice daca cineva a scris direct in DB) → lista curata
export function parseFaq(raw: unknown): CategoryFaqItem[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((f) => ({ q: String((f as CategoryFaqItem)?.q ?? '').trim(), a: String((f as CategoryFaqItem)?.a ?? '').trim() }))
    .filter((f) => f.q && f.a)
}
