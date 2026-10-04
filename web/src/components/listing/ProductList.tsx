import { ProductCard } from '@/components/ProductCard'
import { ProductRow } from '@/components/ProductRow'
import type { ProductWithDiscount } from '@/lib/queries'

// Lista de produse a paginilor /c/, /t/, /cautare, /reduceri-reale/… (design §4 „Categorie”):
//  - sub md (telefon): listă densă pe rânduri (ProductRow), de la o margine la alta;
//  - de la md: grila de carduri (ProductCard) — 3 coloane, 4 de la xl lângă coloana de filtre
//    (`withSidebar`) sau de la lg fără ea.
// Ambele variante sunt în HTML, ascunse cu CSS după lățime (fără JavaScript, fără salt de
// pagină). Imaginile au loading="lazy", deci varianta ascunsă nu le descarcă.
export function ProductList({ products, withSidebar = false }: { products: ProductWithDiscount[]; withSidebar?: boolean }) {
  return (
    <>
      <ul className="-mx-4 border-t border-line md:hidden">
        {products.map((p) => (
          <li key={p.offer_id}>
            <ProductRow product={p} />
          </li>
        ))}
      </ul>
      <ul className={`hidden md:grid md:grid-cols-3 gap-3 ${withSidebar ? 'xl:grid-cols-4' : 'lg:grid-cols-4'}`}>
        {products.map((p) => (
          <li key={p.offer_id}>
            <ProductCard product={p} />
          </li>
        ))}
      </ul>
    </>
  )
}
