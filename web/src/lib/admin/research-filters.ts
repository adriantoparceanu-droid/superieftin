// Reguli pure pentru Admin → Cercetare (/admin/cercetare): parsarea filtrelor din URL, URL-urile
// paginii si ordonarea. Fara baza de date — testate in research-filters.test.ts.
//
// Cercetarea = unealta INTERNA cu care proprietarul alege produsele pentru articole (istoricul de
// pret nu mai e public — docs/plans/2026-11-20-reorganizare-blog-design.md, §3).
import { REAL_DISCOUNT_PCT } from '../discount'
import { parsePage } from './alerts-format'

// Arborii de sanatate (Sanatate & Naturale, farmacie veterinara): din 20.11.2026 (decizia
// proprietarului) apar in cercetare, marcati „doar ne-medical”; produsele lor cu denumire de
// supliment/medicament (lib/medical-content.ts) sunt ascunse implicit — „toate=1” le arata marcate.
// Reclamele raman excluse pe acesti arbori (REGULI.md regula 8).
export { HEALTH_TREE_ROOTS as RESEARCH_HEALTH_ROOTS } from '../medical-content'

export const RESEARCH_PAGE_SIZE = 50

// Sortarile posibile (valorile din URL, in romana, ca restul adminului)
export const RESEARCH_SORTS = ['reducere', 'pret', 'magazine', 'schimbari'] as const
export type ResearchSort = (typeof RESEARCH_SORTS)[number]
export const DEFAULT_SORT: ResearchSort = 'reducere'

export const SORT_LABELS: Record<ResearchSort, string> = {
  reducere: 'Reducere față de mediană (mare → mică)',
  pret: 'Preț (mic → mare)',
  magazine: 'Nr. magazine (multe → puține)',
  schimbari: 'Schimbări de preț 60 z (multe → puține)',
}

// Plafonul bugetului: un URL ciudat nu trebuie sa ajunga in SQL ca numar absurd
export const MAX_BUDGET = 1_000_000

export interface ResearchParams {
  tema: string | null      // slug de categorie (parinte = cu subcategoriile; subcategorie = doar ea)
  buget: number | null     // pretul maxim, in lei (inclusiv)
  reale: boolean           // doar reduceri reale (pret < mediana 30 z × 0,95)
  toate: boolean           // arata si produsele medicale/suplimente din arborii de sanatate (marcate)
  sort: ResearchSort
  pagina: number
}

const first = (v: unknown): unknown => (Array.isArray(v) ? v[0] : v)

// Slug de categorie: litere mici, cifre, cratime. Orice altceva → fara filtru.
export function parseTheme(v: unknown): string | null {
  const s = first(v)
  if (typeof s !== 'string') return null
  const t = s.trim().toLowerCase()
  return /^[a-z0-9][a-z0-9-]{0,99}$/.test(t) ? t : null
}

// Bugetul in lei: „1500”, „1.500”, „1 500”, „1500,50”, „1500.5”. Gol / invalid / ≤ 0 → null.
// Punctul urmat de exact 3 cifre e separator de mii (format romanesc), altfel e zecimal.
export function parseBudget(v: unknown): number | null {
  const s = first(v)
  if (typeof s !== 'string') return null
  let t = s.trim().replace(/\s+/g, '').replace(/lei$/i, '')
  if (!t) return null
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) t = t.replace(/\./g, '')
  t = t.replace(',', '.')
  if (!/^\d+(\.\d+)?$/.test(t)) return null
  const n = Number(t)
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.min(n, MAX_BUDGET)
}

export function parseSort(v: unknown): ResearchSort {
  const s = first(v)
  return (RESEARCH_SORTS as readonly string[]).includes(s as string) ? (s as ResearchSort) : DEFAULT_SORT
}

// Casuta „doar reduceri reale” trimite „1”; orice altceva = debifat
export function parseRealOnly(v: unknown): boolean {
  return first(v) === '1'
}

export function parseResearchParams(sp: Record<string, string | string[] | undefined>): ResearchParams {
  return {
    tema: parseTheme(sp.tema),
    buget: parseBudget(sp.buget),
    reale: parseRealOnly(sp.reale),
    toate: parseRealOnly(sp.toate),   // aceeasi regula de casuta: doar „1” = bifat
    sort: parseSort(sp.sort),
    pagina: parsePage(sp.pagina),
  }
}

// URL-ul paginii cu parametrii curenti + modificari. Valorile implicite lipsesc din URL.
// Schimbarea oricarui filtru (fara pagina explicita) intoarce la pagina 1.
export function researchHref(cur: ResearchParams, change: Partial<ResearchParams> = {}): string {
  const filtersChanged = Object.keys(change).some((k) => k !== 'pagina')
  const next: ResearchParams = { ...cur, ...(filtersChanged ? { pagina: 1 } : {}), ...change }
  const p = new URLSearchParams()
  if (next.tema) p.set('tema', next.tema)
  if (next.buget != null) p.set('buget', String(next.buget))
  if (next.reale) p.set('reale', '1')
  if (next.toate) p.set('toate', '1')
  if (next.sort !== DEFAULT_SORT) p.set('sort', next.sort)
  if (next.pagina > 1) p.set('pagina', String(next.pagina))
  const s = p.toString()
  return `/admin/cercetare${s ? `?${s}` : ''}`
}

// ORDER BY pentru fiecare sortare — DOAR din aceasta lista fixa (nimic din URL nu ajunge in SQL).
// Coloanele sunt aliasurile din query-ul din lib/admin/research.ts. La egalitate: mai multe
// magazine, apoi pretul, apoi id-ul (ordine stabila intre pagini).
export function researchOrderBy(sort: ResearchSort): string {
  const tail = 'stores DESC, best_price ASC, product_id ASC'
  switch (sort) {
    case 'pret': return 'best_price ASC, stores DESC, product_id ASC'
    case 'magazine': return `stores DESC, best_price ASC, product_id ASC`
    case 'schimbari': return `price_changes_60d DESC, ${tail}`
    case 'reducere':
    default: return `discount_pct DESC NULLS LAST, ${tail}`
  }
}

// Diferenta fata de mediana, in % (pozitiv = sub mediana): 900 fata de 1000 → 10.
// null = fara mediana (sub 2 puncte in 30 de zile) sau date invalide.
export function discountVsMedian(price: number | null, median: number | null): number | null {
  if (price == null || median == null || !(median > 0) || !(price > 0)) return null
  return ((median - price) / median) * 100
}

// Regula site-ului: reducere reala = pret < mediana 30 z × (1 − 5%) — aceeasi ca in SQL
export function isRealDiscount(price: number | null, median: number | null): boolean {
  if (price == null || median == null || !(median > 0) || !(price > 0)) return false
  return price < median * (1 - REAL_DISCOUNT_PCT / 100)
}
