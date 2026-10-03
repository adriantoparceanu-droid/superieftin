// Validarea ciornelor de ghid scrise de AI (content/ghiduri/drafts/<slug>.json).
//
// Contractul fisierului e documentat in content/ghiduri/README.md. Aici sunt DOAR verificarile
// care nu au nevoie de baza de date (structura, valori permise, marcaje), ca sa poata fi testate
// unitar. Existenta produselor / categoriei se verifica in scriptul de import.
//
// De ce atat de strict: proprietarul nu scrie textul, doar il verifica. Un fisier gresit
// (camp lipsa, marcaj scris gresit) trebuie oprit la import cu un mesaj clar, nu descoperit
// abia pe pagina publica.

import { toSlug } from './slug.js'

export interface DraftFact {
  claim: string
  source_type: 'db' | 'web'
  source: string
  status: 'confirmat' | 'de_verificat'
  note?: string
}

export interface DraftReview {
  facts: DraftFact[]
  checklist: string[]
  warnings: string[]
}

export interface GuideDraft {
  slug: string
  title: string
  meta_description: string
  kind: 'produs' | 'categorie'
  category_slug: string | null
  summary: string
  body_md: string
  faq: { q: string; a: string }[]
  product_slugs: string[]
  review: DraftReview
  // Prezent DOAR in fisierele care se publica direct la import (content/ghiduri/publicate/,
  // decizia proprietarului din 2026-10-04). Lipsa = ciorna, ca inainte.
  publish: DraftPublish | null
}

export interface DraftPublish {
  author_slug: string     // guide_authors.slug — „Scris de”
  reviewer_slug: string   // guide_authors.slug — „Verificat de”
}

// Aceleasi tipuri ca in web/src/lib/guides/markers.ts (MARKER_TYPES) — modifica-le impreuna.
export const MARKER_TYPES = ['oferte', 'pret', 'istoric-pret', 'reducere', 'comparatie'] as const
// Slug-uri rezervate sub /ghiduri/ (ca RESERVED_GUIDE_SLUGS din web/src/lib/guides/format.ts)
export const RESERVED_GUIDE_SLUGS = ['metodologie']
const MAX_COMPARE = 6

// Orice {{ceva:…}} — ca sa prindem si marcajele scrise gresit (ex. {{oferta:…}}), pe care
// site-ul le-ar afisa ca text simplu.
const ANY_MARKER_RE = /\{\{\s*([a-z-]+)\s*:\s*([^{}\n]*?)\s*\}\}/gi

export const UNVERIFIED_MARK = '[DE VERIFICAT'

// Afirmatii de sanatate interzise (REGULI.md regula 8). Copie a HEALTH_CLAIMS / findHealthClaims
// din web/src/lib/guides/format.ts (worker-ul nu poate importa din web) — modifica-le impreuna.
const HEALTH_CLAIMS = ['vindeca', 'vindecă', 'trateaza', 'tratează', 'detoxifica', 'detoxifică', 'detoxifiere', 'previne boli', 'combate boli', 'elimina toxinele', 'elimină toxinele']

export function findHealthClaims(text: string): string[] {
  const low = text.toLowerCase()
  return [...new Set(HEALTH_CLAIMS.filter((w) => new RegExp(`(^|[^a-zăâîșț])${w}`, 'i').test(low)))]
}

// Pret scris de mana („1.299 lei”, „2499,99 RON”) — preturile vin DOAR din marcajele live.
const HANDWRITTEN_PRICE_RE = /\d[\d.,\s]*\s?(lei|ron)\b/i

// Conditiile de publicare — aceleasi ca in saveGuideAction (web/src/lib/admin/guide-actions.tsx):
// autor + verificator + meta + corp, fara afirmatii de sanatate, fara [DE VERIFICAT]. In plus,
// pentru ca aici nu mai trece un om prin „Fisa de verificare” din editor: toate afirmatiile din
// review.facts trebuie sa fie „confirmat” si nu se accepta preturi scrise de mana.
export function publishErrors(d: Omit<GuideDraft, 'publish'>, pub: DraftPublish): string[] {
  const errors: string[] = []
  if (pub.author_slug === pub.reviewer_slug) errors.push('publish: autorul și verificatorul trebuie să fie diferiți')
  if (!d.meta_description.trim()) errors.push('publish: lipsește descrierea meta')
  if (!d.body_md.trim()) errors.push('publish: lipsește corpul articolului')
  const faqText = d.faq.flatMap((f) => [f.q, f.a]).join('\n')
  const all = [d.title, d.meta_description, d.summary, d.body_md, faqText].join('\n')
  const claims = findHealthClaims(all)
  if (claims.length) errors.push(`publish: afirmații de sănătate interzise (regula 8): ${claims.join(', ')}`)
  const fields: Record<string, string> = { titlu: d.title, meta: d.meta_description, rezumat: d.summary, corp: d.body_md, FAQ: faqText }
  for (const [k, v] of Object.entries(fields)) {
    const n = countUnverified(v)
    if (n) errors.push(`publish: ${n} marcaj(e) [DE VERIFICAT] în ${k}`)
  }
  const todo = d.review.facts.filter((f) => f.status !== 'confirmat')
  if (todo.length) errors.push(`publish: ${todo.length} afirmație(i) din review.facts nu sunt „confirmat”: ${todo.map((f) => `„${f.claim}”`).join('; ')}`)
  for (const [k, v] of Object.entries({ rezumat: d.summary, corp: d.body_md, FAQ: faqText, meta: d.meta_description })) {
    const m = v.match(HANDWRITTEN_PRICE_RE)
    if (m) errors.push(`publish: preț scris de mână în ${k} („${m[0].trim()}”) — folosește marcajele live`)
  }
  return errors
}

export function countUnverified(text: string): number {
  return text.split(UNVERIFIED_MARK).length - 1
}

export interface MarkerCheck {
  refs: string[]        // referintele de produs din marcajele valide (unice)
  errors: string[]
}

// Verifica marcajele din corp: tip cunoscut, referinta prezenta, comparatie cu 2–6 produse.
export function checkMarkers(body: string): MarkerCheck {
  const refs = new Set<string>()
  const errors: string[] = []
  for (const m of body.matchAll(ANY_MARKER_RE)) {
    const type = m[1].toLowerCase()
    const list = m[2].split(',').map((r) => r.trim()).filter(Boolean)
    if (!(MARKER_TYPES as readonly string[]).includes(type)) {
      errors.push(`marcaj necunoscut „${m[0]}” (permise: ${MARKER_TYPES.join(', ')})`)
      continue
    }
    if (!list.length) {
      errors.push(`marcajul „${m[0]}” nu are produs`)
      continue
    }
    if (type === 'comparatie') {
      if (list.length < 2 || list.length > MAX_COMPARE) errors.push(`„${m[0]}”: comparația cere 2–${MAX_COMPARE} produse`)
    } else if (list.length > 1) {
      errors.push(`„${m[0]}”: marcajul ${type} ia un singur produs`)
    }
    list.forEach((r) => refs.add(r))
  }
  // Acolade ramase deschise / inchise fara pereche → marcaj rupt
  const stray = body.replace(ANY_MARKER_RE, '')
  if (/\{\{|\}\}/.test(stray)) errors.push('corpul conține „{{” sau „}}” fără un marcaj valid (marcaj scris greșit?)')
  return { refs: [...refs], errors }
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)

export interface ValidationResult {
  draft: GuideDraft | null
  errors: string[]
  markerRefs: string[]
}

// Valideaza un obiect JSON citit din fisier. Intoarce ciorna normalizata (spatii taiate,
// warnings implicit []) sau lista de erori. Nu arunca exceptii.
export function validateDraft(raw: unknown): ValidationResult {
  const errors: string[] = []
  if (!isObj(raw)) return { draft: null, errors: ['fișierul nu conține un obiect JSON'], markerRefs: [] }

  const need = (key: string): string => {
    const v = str(raw[key])
    if (!v) errors.push(`câmp obligatoriu lipsă sau gol: „${key}”`)
    return v ?? ''
  }

  const slug = need('slug')
  if (slug && toSlug(slug) !== slug) errors.push(`slug invalid „${slug}” (doar a-z, 0-9 și „-”; ex. „${toSlug(slug)}”)`)
  if (RESERVED_GUIDE_SLUGS.includes(slug)) errors.push(`slug-ul „${slug}” este rezervat`)
  const title = need('title')
  if (title.length > 200) errors.push('titlul depășește 200 de caractere')
  const meta = need('meta_description')
  if (meta.length > 300) errors.push('meta_description depășește 300 de caractere')
  const summary = need('summary')
  const body = need('body_md')

  const kind = raw.kind
  if (kind !== 'produs' && kind !== 'categorie') errors.push('„kind” trebuie să fie „produs” sau „categorie”')

  let categorySlug: string | null = null
  if (raw.category_slug != null && raw.category_slug !== 'null') {
    categorySlug = str(raw.category_slug)
    if (!categorySlug) errors.push('„category_slug” trebuie să fie text sau null')
  }

  const faq: { q: string; a: string }[] = []
  if (raw.faq != null) {
    if (!Array.isArray(raw.faq)) errors.push('„faq” trebuie să fie o listă')
    else raw.faq.forEach((f, i) => {
      const q = isObj(f) ? str(f.q) : null
      const a = isObj(f) ? str(f.a) : null
      if (!q || !a) errors.push(`faq[${i}]: lipsește „q” sau „a”`)
      else faq.push({ q, a })
    })
  }

  const productSlugs: string[] = []
  if (!Array.isArray(raw.product_slugs)) errors.push('„product_slugs” trebuie să fie o listă (poate fi goală)')
  else raw.product_slugs.forEach((p, i) => {
    const s = str(p)
    if (!s) errors.push(`product_slugs[${i}] nu este text`)
    else if (productSlugs.includes(s)) errors.push(`product_slugs: „${s}” apare de două ori`)
    else productSlugs.push(s)
  })

  // Fisa de verificare — obligatorie: fara ea proprietarul nu are ce verifica
  const review: DraftReview = { facts: [], checklist: [], warnings: [] }
  if (!isObj(raw.review)) errors.push('câmp obligatoriu lipsă: „review” (fișa de verificare)')
  else {
    const r = raw.review
    if (!Array.isArray(r.facts) || !r.facts.length) errors.push('„review.facts” trebuie să fie o listă nevidă')
    else r.facts.forEach((f, i) => {
      if (!isObj(f)) return errors.push(`review.facts[${i}] nu este obiect`)
      const claim = str(f.claim)
      const source = str(f.source)
      if (!claim) errors.push(`review.facts[${i}]: lipsește „claim”`)
      if (!source) errors.push(`review.facts[${i}]: lipsește „source”`)
      if (f.source_type !== 'db' && f.source_type !== 'web') errors.push(`review.facts[${i}]: „source_type” trebuie „db” sau „web”`)
      if (f.status !== 'confirmat' && f.status !== 'de_verificat') errors.push(`review.facts[${i}]: „status” trebuie „confirmat” sau „de_verificat”`)
      if (f.source_type === 'web' && source && !/^https?:\/\//i.test(source)) errors.push(`review.facts[${i}]: sursa web trebuie să fie un URL (http/https)`)
      const note = str(f.note)
      if (claim && source) {
        review.facts.push({
          claim, source,
          source_type: f.source_type as DraftFact['source_type'],
          status: f.status as DraftFact['status'],
          ...(note ? { note } : {}),
        })
      }
    })
    if (!Array.isArray(r.checklist) || !r.checklist.length) errors.push('„review.checklist” trebuie să fie o listă nevidă')
    else r.checklist.forEach((c, i) => {
      const s = str(c)
      if (!s) errors.push(`review.checklist[${i}] nu este text`)
      else review.checklist.push(s)
    })
    if (r.warnings != null) {
      if (!Array.isArray(r.warnings)) errors.push('„review.warnings” trebuie să fie o listă')
      else r.warnings.forEach((w, i) => {
        const s = str(w)
        if (!s) errors.push(`review.warnings[${i}] nu este text`)
        else review.warnings.push(s)
      })
    }
  }

  // Publicare directa (optional): { "author_slug": "...", "reviewer_slug": "..." }
  let publish: DraftPublish | null = null
  if (raw.publish != null) {
    const p = raw.publish
    const a = isObj(p) ? str(p.author_slug) : null
    const r = isObj(p) ? str(p.reviewer_slug) : null
    if (!a || !r) errors.push('„publish” trebuie să aibă „author_slug” și „reviewer_slug”')
    else publish = { author_slug: a, reviewer_slug: r }
  }

  const markers = checkMarkers(body)
  errors.push(...markers.errors.map((e) => `body_md: ${e}`))
  if (/\{\{/.test(summary)) errors.push('summary: rezumatul nu acceptă marcaje live')

  if (errors.length) return { draft: null, errors, markerRefs: markers.refs }
  const base = {
    slug, title, meta_description: meta, kind: kind as GuideDraft['kind'], category_slug: categorySlug,
    summary, body_md: body, faq, product_slugs: productSlugs, review,
  }
  if (publish) {
    const pubErrors = publishErrors(base, publish)
    if (pubErrors.length) return { draft: null, errors: pubErrors, markerRefs: markers.refs }
  }
  return {
    draft: { ...base, publish },
    errors: [],
    markerRefs: markers.refs,
  }
}
