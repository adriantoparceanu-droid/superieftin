// Potrivirea regulilor „dupa denumire” (name_category_rules, migratia 020) — varianta web,
// pentru previzualizare si pentru aplicarea imediata pe produsele existente.
// ATENTIE: aceeasi logica e in worker/src/lib/nameRules.ts (aplicarea la import) —
// modifica-le impreuna. Normalizare: litere mici, fara diacritice, termen = cuvant intreg.

export function normalizeName(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export function parseTerms(terms: string): string[] {
  return terms.split(',').map((t) => normalizeName(t).trim().replace(/\s+/g, ' ')).filter(Boolean)
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function termsPattern(terms: string): string | null {
  const list = parseTerms(terms)
  if (!list.length) return null
  return `(^|[^a-z0-9])(${list.map(escapeRe).join('|')})([^a-z0-9]|$)`
}

// Echivalentul SQL al lui normalizeName pentru coloana p.name (diacriticele uzuale din feed-uri)
export const NAME_NORMALIZED_SQL =
  `translate(lower(p.name), 'ăâîșşțţáàäéèëíìïóòöőúùüűçñ', 'aaissttaaaeeeiiioooouuuucn')`

// Cuvintele cele mai frecvente dintr-o lista de denumiri (cate produse contin fiecare cuvant),
// ca proprietarul sa vada rapid ce tipuri de produse sunt intr-un grup nemapat.
const STOP = new Set(['cu', 'si', 'de', 'la', 'pentru', 'din', 'pe', 'in', 'the', 'and', 'with', 'for',
  'gb', 'tb', 'mb', 'ghz', 'mhz', 'inch', 'win', 'pro', 'ddr4', 'ddr5'])
export function topWords(names: string[], limit = 30): { word: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const n of names) {
    const words = new Set(normalizeName(n).split(/[^a-z0-9]+/).filter((w) => w.length >= 2 && !/^\d+$/.test(w) && !STOP.has(w)))
    for (const w of words) counts.set(w, (counts.get(w) ?? 0) + 1)
  }
  return [...counts.entries()].map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count).slice(0, limit)
}

// O regula „dupa denumire” gata de potrivit (in admin: scanarea feed-ului + previzualizarea
// din Surse feed → Alege categoriile). `pattern` = termsPattern(terms), trimis ca text catre
// browser (RegExp nu trece prin server actions).
export interface NameRuleForMatch {
  id: number
  retailerId: number | null
  action: 'map' | 'ignore'
  categoryId: number | null
  categoryLabel: string | null
  priority: number
  pattern: string
}

// Prima regula potrivita castiga: intai cele ale retailerului, apoi cele globale; in cadrul
// fiecarui grup in ordinea primita (priority, apoi id). ACEEASI logica ca matchNameRule din
// worker/src/lib/nameRules.ts — modifica-le impreuna.
export function firstMatchingRule<T extends { retailerId: number | null; re: RegExp }>(
  rules: T[], retailerId: number | null, name: string,
): T | null {
  const n = normalizeName(name)
  for (const scope of retailerId == null ? [null] : [retailerId, null]) {
    for (const r of rules) if (r.retailerId === scope && r.re.test(n)) return r
  }
  return null
}
