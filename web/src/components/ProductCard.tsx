import Image from 'next/image'
import Link from 'next/link'
import { PriceTag } from './PriceTag'
import { VerdictBadge } from './VerdictBadge'
import type { ProductWithDiscount } from '@/lib/queries'

interface ProductCardProps {
  product: ProductWithDiscount
}

export function ProductCard({ product }: ProductCardProps) {
  return (
    <article className="bg-surface rounded-lg border border-line overflow-hidden hover:border-brand transition-colors flex flex-col">
      <Link href={`/p/${product.slug}`} className="block relative h-[120px] bg-gray-50">
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
      </Link>

      <div className="p-3 flex flex-col flex-1">
        <VerdictBadge discountPct={product.discount_pct} />

        <Link href={`/p/${product.slug}`}>
          <h2 className="text-sm font-medium text-[var(--color-text)] line-clamp-2 leading-snug hover:text-brand transition-colors mt-1 mb-1">
            {product.name}
          </h2>
        </Link>

        {product.brand && (
          <p className="text-xs text-muted mb-2">{product.brand}</p>
        )}

        <div className="mt-auto space-y-2">
          <PriceTag price={product.current_price} discountPct={product.discount_pct} />

          <Link
            href={`/go/${product.offer_id}`}
            className="block w-full text-center text-sm font-semibold bg-yellow-400 hover:bg-yellow-500 text-gray-900 rounded-md py-2 transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
            target="_blank"
            rel="noopener sponsored"
          >
            Vezi la {product.retailer_name}
          </Link>
        </div>
      </div>
    </article>
  )
}
