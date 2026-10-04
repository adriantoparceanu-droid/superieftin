import { formatPrice } from '../discount'
import { roCount } from './site'

// Reguli de indexare pentru paginile-lista (/c/<categorie>, /t/<tag>): canonical, robots,
// paginare si 404. Pure (fara DB), ca sa le putem testa.
//
// De ce:
// - pagina 2, 3… are canonical PROPRIU (Google recomanda asta: altfel produsele de pe paginile
//   urmatoare se descopera greu, iar canonical spre pagina 1 e un semnal contradictoriu);
// - sortarea (?sort=) si „vezi tot” (?tot=1) sunt doar alte ordonari ale aceleiasi liste →
//   canonical spre pagina de baza;
// - filtrul de marca (?brand=, una sau mai multe marci) → noindex, follow (pana la decizia D5 despre pagini de marca);
// - lista goala (0 produse disponibile) → noindex, follow (altfel e „soft 404” in Search Console);
// - ?page= peste ultima pagina → 404 adevarat, nu „Niciun produs gasit” cu 200.

export interface ListingInput {
  basePath: string          // ex. /c/telefoane-mobile
  page: number              // pagina ceruta (1 = prima)
  totalPages: number        // pentru vederea curenta (cu filtrele aplicate)
  hasReorder: boolean       // ?sort= diferit de implicit sau ?tot=1
  brand: string | readonly string[] | null   // ?brand= (una sau mai multe marci bifate)
  empty: boolean            // lista nu are niciun produs disponibil (nici in subcategorii)
}

export interface ListingSeo {
  notFound: boolean
  canonical: string
  robots: { index: false; follow: true } | null   // null = implicit (index, follow)
  titleSuffix: string       // „ — pagina 2” sau ''
}

// „?page=abc” / „?page=-3” → 1 (ca in paginile existente)
export function parsePageParam(raw: string | undefined): number {
  return Math.max(1, parseInt(raw ?? '1') || 1)
}

export function listingSeo(i: ListingInput): ListingSeo {
  const notFound = i.page > 1 && i.page > i.totalPages
  // Orice marca bifata (una sau mai multe) = vedere filtrata
  const hasBrand = Array.isArray(i.brand) ? i.brand.length > 0 : !!i.brand
  const filtered = i.hasReorder || hasBrand
  const canonical = !filtered && i.page > 1 ? `${i.basePath}?page=${i.page}` : i.basePath
  const robots = hasBrand || i.empty ? { index: false as const, follow: true as const } : null
  return { notFound, canonical, robots, titleSuffix: i.page > 1 ? ` — pagina ${i.page}` : '' }
}

// --- Texte de metadata cu cifre live --------------------------------------------------------

export interface ListingStats {
  products: number
  retailers: number
  brands: number
  minPrice: number | null
}

// Meta description pentru /c/ si /t/: fapte (cate produse, cate magazine/marci, de la ce pret),
// FARA promisiuni de reducere sau procente (REGULI.md, regula 9).
export function listingDescription(name: string, s: ListingStats): string {
  if (s.products === 0) {
    return `${name}: momentan niciun produs disponibil la magazinele monitorizate. Urmărim prețurile zilnic.`
  }
  const parts = [`${name}: ${roCount(s.products, 'produse', 'produs')}`]
  if (s.retailers > 0) parts[0] += ` de la ${roCount(s.retailers, 'magazine', 'magazin')}`
  if (s.brands > 1) parts[0] += ` și ${roCount(s.brands, 'mărci')}`
  parts[0] += ', cu istoric de preț.'
  if (s.minPrice != null) parts.push(`Prețuri de la ${formatPrice(s.minPrice)}.`)
  parts.push('Vezi prețul de azi față de mediana ultimelor 30 de zile.')
  return parts.join(' ')
}
