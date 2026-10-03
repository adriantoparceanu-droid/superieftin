// Constante si mici utilitare SEO comune (fara acces la DB — se pot testa direct cu node --test).

// Domeniul canonic (CLAUDE.md: https://www.superieftin.ro, cu www). Vine din next.config.ts.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.superieftin.ro').replace(/\/+$/, '')

// Numele afisat al site-ului (og:site_name, JSON-LD Organization/WebSite)
export const SITE_NAME = 'superieftin.ro'

// Identificatorii stabili ai entitatilor din JSON-LD: aceeasi firma / acelasi site pe toate paginile,
// ca Google si asistentii AI sa lege ghidurile, produsele si homepage-ul de aceeasi entitate.
export const ORGANIZATION_ID = `${SITE_URL}/#organization`
export const WEBSITE_ID = `${SITE_URL}/#website`

// Radacinile excluse din reclame si din landing-urile /reduceri-reale/ (REGULI.md, regula 8).
// Oglinda lui excluded_categories din ads/config/guardrails.yaml (ads/ nu ajunge in imaginea web).
export const EXCLUDED_AD_ROOTS = ['sanatate-naturale']

// URL absolut pe domeniul canonic: „/p/x” → „https://www.superieftin.ro/p/x”
export function absUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path
  return `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`
}

// Numele categoriilor sunt in Title Case („Telefoane Mobile”); in fraza le vrem cu litere mici:
// „reduceri reale la telefoane mobile”. Acronimele raman neatinse („Suport TV” → „suport TV”).
// (Aceeasi regula ca in reduceri-reale/[categorie]/page.tsx.)
export function lowerFirst(s: string): string {
  return s.split(' ').map((w) => (/^[A-ZĂÂÎȘȚ]{2,}$/.test(w) ? w : w.toLocaleLowerCase('ro-RO'))).join(' ')
}

// Numar + substantiv cu „de” unde il cere gramatica romaneasca: 5 produse, 19 produse,
// 20 de produse, 101 produse, 120 de produse, 1.000 de produse. Separator de mii romanesc.
export function roCount(n: number, plural: string, singular?: string): string {
  const formatted = n.toLocaleString('ro-RO')
  if (n === 1 && singular) return `${formatted} ${singular}`
  const lastTwo = n % 100
  const needsDe = n !== 0 && (lastTwo === 0 || lastTwo >= 20)
  return `${formatted} ${needsDe ? 'de ' : ''}${plural}`
}

// Data in romana, ora Romaniei: „3 octombrie 2026”
export function formatRoDate(d: Date | string): string {
  return new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Bucharest' })
    .format(new Date(d))
}
