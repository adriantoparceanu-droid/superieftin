// Validarea fisierelor cu texte de categorie (content/categorii/<slug>.json), importate cu
// `npm run categorii:import` (src/scripts/import-category-texts.ts).
//
// Contractul fisierului e documentat in content/categorii/README.md. Aici sunt DOAR verificarile
// fara baza de date (structura, marcaje, formulari interzise), ca sa poata fi testate unitar.
// Existenta categoriei, vizibilitatea si excluderile (regula 8) se verifica in script.
//
// ATENTIE — COPIE: validateCategoryText / validateCategoryContent / CAT_MARKER_KEYS / MAX_FAQ
// sunt copia exacta a celor din web/src/lib/category-markers.ts (validarea de la salvarea din
// Admin → Categorii → „text”). Worker-ul nu poate importa din web la build (tsconfig rootDir =
// src, iar Dockerfile-ul worker copiaza doar worker/). MODIFICA-LE IMPREUNA — testul
// category-texts.test.ts ruleaza ambele implementari pe aceleasi cazuri si pica la diferente.

import { findHealthClaims } from './guide-drafts.js'

export interface CategoryFaqItem {
  q: string
  a: string
}

export interface ContentIssue {
  field: string
  message: string
}

// ---------- Copia validarii din web/src/lib/category-markers.ts ----------

export const CAT_MARKER_KEYS = [
  'produse', 'magazine', 'lista-magazine', 'reduceri', 'cu-mediana',
  'pret-median', 'pret-p10', 'pret-p90', 'branduri-top', 'istoric-de-la', 'actualizat', 'prag',
] as const
type CatMarkerKey = (typeof CAT_MARKER_KEYS)[number]

// Cheile la care are sens forma cu substantiv ({{cat:produse|laptop|laptopuri}})
const COUNT_KEYS: CatMarkerKey[] = ['produse', 'magazine', 'reduceri', 'cu-mediana']

// Orice {{cat:…}} — si cele cu cheie gresita, ca sa le putem semnala la validare
const MARKER_RE = /\{\{\s*cat\s*:\s*([^{}|\n]*?)\s*(?:\|([^{}|\n]*)\|([^{}|\n]*))?\s*\}\}/g

export const MAX_FAQ = 6

// Promisiuni interzise (regula 9) — textul descrie ce CONSTATAM, nu ce garantam.
const FORBIDDEN_PHRASES = [
  'garantat', 'garantăm', 'garantam', 'economisești', 'economisesti', 'economisiți', 'economisiti',
  'cel mai mic preț din românia', 'cel mai mic pret din romania', 'cele mai mici prețuri',
  'cele mai mici preturi', 'prețuri imbatabile', 'preturi imbatabile', 'cel mai ieftin din',
]

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

// ---------- Fisierul de import ----------

export interface CategoryTextFact {
  claim: string
  source_type: 'db' | 'web'
  source: string
  status: string
}

export interface CategoryTextFile {
  slug: string
  intro_md: string               // deja trim-uit, ca la salvarea din admin
  faq: CategoryFaqItem[]         // trim-uit, randurile complet goale scoase (ca in admin)
  review: { facts: CategoryTextFact[]; warnings: string[] }   // doar intern, NU se scrie in DB
}

const TOP_KEYS = ['slug', 'intro_md', 'faq', 'review']
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
export const UNVERIFIED_MARK = '[DE VERIFICAT'

// Categoriile excluse (REGULI.md regula 8): Sanatate & Naturale cu tot ce e sub ea
// (EXCLUDED_AD_ROOTS din web/src/lib/seo/site.ts) + farmacia veterinara (afirmatii de sanatate,
// CLAUDE.md „Petmart”). Scriptul primeste slug-ul categoriei si slug-urile stramosilor ei.
export const EXCLUDED_ROOTS = ['sanatate-naturale']
export const EXCLUDED_SLUGS = ['farmacie-veterinara']

export function isExcludedCategory(slug: string, ancestorSlugs: string[]): boolean {
  return EXCLUDED_SLUGS.includes(slug) || EXCLUDED_ROOTS.includes(slug)
    || ancestorSlugs.some((s) => EXCLUDED_ROOTS.includes(s) || EXCLUDED_SLUGS.includes(s))
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

function isHttpUrl(s: string): boolean {
  try {
    const u = new URL(s)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

// Structura + aceeasi validare de continut ca la „Salvează” din admin + fisa de verificare.
// Intoarce fisierul normalizat DOAR daca nu exista nicio eroare.
export function validateCategoryFile(raw: unknown): { file: CategoryTextFile | null; errors: string[] } {
  const errors: string[] = []
  if (!isObj(raw)) return { file: null, errors: ['fișierul trebuie să fie un obiect JSON { slug, intro_md, faq, review }'] }

  for (const k of Object.keys(raw)) {
    if (!TOP_KEYS.includes(k)) errors.push(`câmp necunoscut „${k}” (permise: ${TOP_KEYS.join(', ')})`)
  }

  const slug = typeof raw.slug === 'string' ? raw.slug.trim() : ''
  if (!slug) errors.push('slug: lipsește')
  else if (!SLUG_RE.test(slug)) errors.push(`slug: „${slug}” — doar a-z, 0-9 și „-”`)

  const intro = typeof raw.intro_md === 'string' ? raw.intro_md.trim() : ''
  if (typeof raw.intro_md !== 'string') errors.push('intro_md: lipsește sau nu e text')
  else if (!intro) errors.push('intro_md: e gol')

  // FAQ: ca in saveCategoryContentAction — trim, randurile complet goale se ignora
  let faq: CategoryFaqItem[] = []
  if (raw.faq !== undefined && raw.faq !== null) {
    if (!Array.isArray(raw.faq)) errors.push('faq: trebuie să fie o listă de { "q", "a" }')
    else {
      raw.faq.forEach((f, i) => {
        if (!isObj(f) || (f.q !== undefined && typeof f.q !== 'string') || (f.a !== undefined && typeof f.a !== 'string')) {
          errors.push(`faq[${i}]: trebuie să fie { "q": text, "a": text }`)
        }
      })
      faq = raw.faq
        .map((f) => ({ q: String((f as CategoryFaqItem)?.q ?? '').trim(), a: String((f as CategoryFaqItem)?.a ?? '').trim() }))
        .filter((f) => f.q || f.a)
    }
  }

  // Validarea din admin (marcaje, preturi/procente scrise de mana, promisiuni, sanatate, max FAQ)
  for (const i of validateCategoryContent(intro, faq)) errors.push(`${i.field}: ${i.message}`)

  // Locurile marcate „de verificat” nu ajung pe site (ca la ghiduri)
  if ([intro, ...faq.flatMap((f) => [f.q, f.a])].some((t) => t.includes(UNVERIFIED_MARK))) {
    errors.push(`textul conține „${UNVERIFIED_MARK}…” — rezolvă marcajul înainte de import`)
  }

  // Fisa de verificare: obligatorie, toate faptele „confirmat”, sursa web = URL
  const review: CategoryTextFile['review'] = { facts: [], warnings: [] }
  if (!isObj(raw.review)) errors.push('review: lipsește (obiect { facts, warnings })')
  else {
    for (const k of Object.keys(raw.review)) {
      if (k !== 'facts' && k !== 'warnings') errors.push(`review: câmp necunoscut „${k}” (permise: facts, warnings)`)
    }
    if (!Array.isArray(raw.review.facts)) errors.push('review.facts: trebuie să fie o listă (poate fi goală)')
    else {
      raw.review.facts.forEach((f, i) => {
        const p = `review.facts[${i}]`
        if (!isObj(f)) { errors.push(`${p}: trebuie să fie un obiect`); return }
        const claim = typeof f.claim === 'string' ? f.claim.trim() : ''
        const source = typeof f.source === 'string' ? f.source.trim() : ''
        if (!claim) errors.push(`${p}.claim: lipsește`)
        if (f.source_type !== 'db' && f.source_type !== 'web') errors.push(`${p}.source_type: „db” sau „web”`)
        if (!source) errors.push(`${p}.source: lipsește`)
        else if (f.source_type === 'web' && !isHttpUrl(source)) errors.push(`${p}.source: la „web” trebuie un URL http/https`)
        if (f.status !== 'confirmat') errors.push(`${p}: „${claim || '?'}” are status „${String(f.status ?? '')}” — se importă doar fapte „confirmat”`)
        review.facts.push({ claim, source_type: f.source_type as 'db' | 'web', source, status: String(f.status ?? '') })
      })
    }
    if (raw.review.warnings !== undefined) {
      if (!Array.isArray(raw.review.warnings) || raw.review.warnings.some((w) => typeof w !== 'string')) {
        errors.push('review.warnings: trebuie să fie o listă de texte')
      } else review.warnings = raw.review.warnings.map((w) => (w as string).trim()).filter(Boolean)
    }
  }

  if (errors.length) return { file: null, errors }
  return { file: { slug, intro_md: intro, faq, review }, errors }
}

// Ce ar face importul pentru o categorie, comparand cu ce e acum in DB.
export type CategoryTextAction = 'create' | 'update' | 'unchanged'

export function planAction(current: { intro_md: string | null; faq: unknown }, file: CategoryTextFile): CategoryTextAction {
  const curFaq = normalizeDbFaq(current.faq)
  const hasText = !!current.intro_md?.trim() || curFaq.length > 0
  if (!hasText) return 'create'
  const same = (current.intro_md ?? '') === file.intro_md && JSON.stringify(curFaq) === JSON.stringify(file.faq)
  return same ? 'unchanged' : 'update'
}

// FAQ-ul din coloana JSONB → doar {q, a} in ordinea asta (jsonb nu pastreaza ordinea cheilor)
export function normalizeDbFaq(raw: unknown): CategoryFaqItem[] {
  if (!Array.isArray(raw)) return []
  return raw.map((f) => ({ q: String((f as CategoryFaqItem)?.q ?? ''), a: String((f as CategoryFaqItem)?.a ?? '') }))
}
