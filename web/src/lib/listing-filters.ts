// Filtrele paginii de categorie (/c/<categorie>): marci (selectie multipla) + sortare.
// Pure (fara DB, fara React), ca sa le putem testa: cd web && npm test
//
// Formatul URL-ului: marcile sunt un parametru REPETAT, ?brand=Samsung&brand=Apple
// (asa trimite browserul un <form method="get"> cu mai multe casute bifate cu acelasi
// name="brand" — deci filtrul merge si fara JavaScript). Vechiul ?brand=Samsung (o singura
// marca) e acelasi format, cu un singur element → linkurile vechi raman valide.

export type ListingSort = 'price' | 'discount' | 'name'

export const SORT_OPTIONS: { value: ListingSort; label: string }[] = [
  { value: 'price', label: 'Preț mic' },
  { value: 'discount', label: 'Reducere' },
  { value: 'name', label: 'Alfabetic' },
]

// Limita de marci bifate dintr-un URL: protejeaza query-ul (ANY($n) cu sute de valori)
// si cache-ul (fiecare combinatie = o intrare noua) de URL-uri fabricate de roboti.
export const MAX_BRANDS = 20
// O denumire de marca reala nu are 100 de caractere; mai lung = gunoi in URL
const MAX_BRAND_LENGTH = 100

export function parseSortParam(raw: string | string[] | undefined): ListingSort {
  const v = Array.isArray(raw) ? raw[0] : raw
  return v === 'discount' || v === 'price' || v === 'name' ? v : 'price'
}

// ?brand= din searchParams (string pentru o valoare, string[] pentru parametru repetat)
// → lista curata: fara spatii la capete, fara valori goale, fara dubluri, max MAX_BRANDS.
// Ordinea din URL se pastreaza (prima marca bifata apare prima in titlu).
export function parseBrandParam(raw: string | string[] | undefined): string[] {
  const values = raw == null ? [] : Array.isArray(raw) ? raw : [raw]
  const out: string[] = []
  for (const v of values) {
    const b = String(v).trim()
    if (!b || b.length > MAX_BRAND_LENGTH || out.includes(b)) continue
    out.push(b)
    if (out.length >= MAX_BRANDS) break
  }
  return out
}

// Pentru query-uri si cache: aceeasi selectie in alta ordine = aceeasi interogare.
// null = fara filtru de marca (query-urile folosesc „$n IS NULL OR p.brand = ANY($n)”).
export function brandsForQuery(brands: string[]): string[] | null {
  return brands.length ? [...brands].sort() : null
}

export interface ListingUrlState {
  sort: ListingSort
  brands: string[]
  tot: boolean
  page?: number
}

// URL-ul unei vederi a listei. Ordine fixa a parametrilor (sort, brand…, tot, page) si fara
// valorile implicite (sort=price, page=1) → acelasi URL pentru aceeasi vedere.
export function buildListingUrl(basePath: string, s: ListingUrlState): string {
  const params = new URLSearchParams()
  if (s.sort !== 'price') params.set('sort', s.sort)
  for (const b of s.brands) params.append('brand', b)
  if (s.tot) params.set('tot', '1')
  if (s.page && s.page > 1) params.set('page', String(s.page))
  const qs = params.toString()
  return `${basePath}${qs ? `?${qs}` : ''}`
}

// Bucata de titlu pentru marcile bifate: o marca → „ Samsung” (ca inainte), doua → „ Samsung,
// Apple”, mai multe → primele doua + „…” (titlul ramane scurt; paginile sunt oricum noindex).
export function brandTitlePart(brands: string[]): string {
  if (brands.length === 0) return ''
  if (brands.length <= 2) return ` ${brands.join(', ')}`
  return ` ${brands.slice(0, 2).join(', ')}…`
}

// --- Lista de marci din coloana de filtre -----------------------------------------------------

export interface BrandOption {
  brand: string
  count: number   // produse disponibile din categorie cu marca asta
}

// Cautare fara diacritice si fara majuscule: „lg” gaseste „LG”, „stiinta” gaseste „Știința”
export function normalizeForSearch(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

// Ordinea din coloana: marcile bifate mereu sus (chiar daca nu sunt in top sau nu mai au
// produse — altfel nu le-ai mai putea debifa), apoi restul dupa numarul de produse (desc),
// la egalitate alfabetic.
export function orderBrandOptions(options: BrandOption[], selected: string[]): BrandOption[] {
  const byCount = (a: BrandOption, b: BrandOption) => b.count - a.count || a.brand.localeCompare(b.brand, 'ro')
  const sel = new Set(selected)
  const known = new Map(options.map(o => [o.brand, o]))
  const top = selected.map(b => known.get(b) ?? { brand: b, count: 0 }).sort(byCount)
  const rest = options.filter(o => !sel.has(o.brand)).sort(byCount)
  return [...top, ...rest]
}

// Filtrarea dupa textul din „Caută marca…” (subsir, fara diacritice/majuscule)
export function filterBrandOptions(options: BrandOption[], query: string): BrandOption[] {
  const q = normalizeForSearch(query)
  if (!q) return options
  return options.filter(o => normalizeForSearch(o.brand).includes(q))
}

// Cate produse vei vedea dupa aplicare (butonul „Vezi N produse” din panoul de pe mobil).
// Un produs are o singura marca → produsele marcilor bifate sunt disjuncte, deci suma e exacta.
// Fara nicio marca bifata = toata lista (inclusiv produsele fara marca, care nu apar in coloana).
export function countForSelection(options: BrandOption[], selected: string[], total: number): number {
  if (selected.length === 0) return total
  const sel = new Set(selected)
  return options.reduce((sum, o) => sum + (sel.has(o.brand) ? o.count : 0), 0)
}
