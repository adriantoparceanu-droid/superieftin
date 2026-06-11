import { ProductCard } from './ProductCard'
import type { ProductWithDiscount } from '@/lib/queries'

// Carusel orizontal cu scroll-snap (CSS pur, fara JS) — stilul „Special Offers" din Porto
export function ProductCarousel({ products }: { products: ProductWithDiscount[] }) {
  return (
    <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 -mx-4 px-4 scrollbar-thin">
      {products.map((product) => (
        <div key={product.offer_id} className="snap-start shrink-0 w-44 sm:w-48">
          <ProductCard product={product} />
        </div>
      ))}
    </div>
  )
}
