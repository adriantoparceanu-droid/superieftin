import Image from 'next/image'
import { PriceTag } from './PriceTag'
import { VerdictBadge } from './VerdictBadge'
import { AffiliateLink } from './analytics/AffiliateLink'
import { SelectItemLink } from './analytics/SelectItemLink'
import type { ProductWithDiscount } from '@/lib/queries'

interface ProductCardProps {
  product: ProductWithDiscount
}

export function ProductCard({ product }: ProductCardProps) {
  const gaItem = {
    item_name: product.name,
    item_category: product.category,
    item_brand: product.brand,
    price: product.current_price,
    affiliation: product.retailer_name,
  }

  return (
    <article className="bg-surface rounded-lg border border-line overflow-hidden hover:border-brand transition-colors flex flex-col">
      <SelectItemLink href={`/p/${product.slug}`} item={gaItem} className="block relative h-[120px] bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2">
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-contain p-3"
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[var(--color-line)] text-4xl">
            📦
          </div>
        )}
      </SelectItemLink>

      <div className="p-3 flex flex-col flex-1">
        <VerdictBadge discountPct={product.discount_pct} />

        <SelectItemLink href={`/p/${product.slug}`} item={gaItem} className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 rounded">
          {/* h3: cardul sta sub un titlu de sectiune (h2); cu h2 aici, homepage-ul avea 23 de h2 */}
          <h3 className="text-sm font-medium text-[var(--color-text)] line-clamp-2 leading-snug hover:text-red-ink transition-colors mt-1 mb-1">
            {product.name}
          </h3>
        </SelectItemLink>

        {product.brand && (
          <p className="text-xs text-muted mb-2">{product.brand}</p>
        )}

        <div className="mt-auto space-y-2">
          <PriceTag price={product.current_price} discountPct={product.discount_pct} />

          <AffiliateLink
            offerId={product.offer_id}
            productId={product.id}
            productName={product.name}
            merchantName={product.retailer_name}
            price={product.current_price}
            category={product.category}
            discountPct={product.discount_pct}
            className="block w-full text-center text-sm font-semibold bg-yellow-400 hover:bg-yellow-500 text-gray-900 rounded-md py-2 transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
          >
            Vezi la {product.retailer_name}
          </AffiliateLink>
        </div>
      </div>
    </article>
  )
}
