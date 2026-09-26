// Potrivirea regulilor „dupa denumire” (tabela name_category_rules, migratia 020).
// ATENTIE: aceeasi logica exista si in web/src/lib/admin/nameMatch.ts (previzualizare +
// aplicare pe produsele existente) — modifica-le impreuna.
//
// Normalizare: litere mici, fara diacritice. Un termen se potriveste ca CUVANT INTREG
// („pc” prinde „PC Office”, nu „PCIe”); poate avea mai multe cuvinte („hard disk”).

export function normalizeName(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export function parseTerms(terms: string): string[] {
  return terms.split(',').map((t) => normalizeName(t).trim().replace(/\s+/g, ' ')).filter(Boolean)
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Sursa regex-ului (aceeasi forma e folosita si in SQL, cu operatorul ~)
export function termsPattern(terms: string): string | null {
  const list = parseTerms(terms)
  if (!list.length) return null
  return `(^|[^a-z0-9])(${list.map(escapeRe).join('|')})([^a-z0-9]|$)`
}

export interface NameRule {
  retailerId: number | null
  action: 'map' | 'ignore'
  categoryId: number | null
  categorySlug: string | null
  priority: number
  id: number
  re: RegExp
}

// Prima regula potrivita castiga: intai cele ale retailerului, apoi cele globale; in cadrul
// fiecarui grup, dupa priority apoi id.
export function matchNameRule(rules: NameRule[], retailerId: number, name: string): NameRule | null {
  const n = normalizeName(name)
  for (const scope of [retailerId, null]) {
    for (const r of rules) if (r.retailerId === scope && r.re.test(n)) return r
  }
  return null
}
