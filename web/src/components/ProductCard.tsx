import Image from 'next/image'
import Link from 'next/link'
import { calculateDiscount, formatPrice, verdictColor } from '@/lib/discount'
import type { ProductWithDiscount } from '@/lib/queries'

interface ProductCardProps {
  product: ProductWithDiscount
}

export function ProductCard({ product }: ProductCardProps) {
  const info = calculateDiscount(product.current_price, product.median_price)

  return (
    <article className="bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-md transition-shadow flex flex-col">
      <Link href={`/p/${product.slug}`} className="block relative aspect-square bg-gray-50">
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
          <div className="absolute inset-0 flex items-center justify-center text-gray-300 text-4xl">
            📱
          </div>
        )}
        {info.verdict === 'real' && (
          <div className="absolute top-2 left-2 bg-green-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
            −{info.discountPct}%
          </div>
        )}
        {info.verdict === 'good' && (
          <div className="absolute top-2 left-2 bg-blue-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
            −{info.discountPct}%
          </div>
        )}
      </Link>

      <div className="p-3 flex flex-col flex-1">
        <Link href={`/p/${product.slug}`}>
          <h2 className="text-sm font-medium text-gray-900 line-clamp-2 leading-snug hover:text-red-600 transition-colors mb-2">
            {product.name}
          </h2>
        </Link>

        <div className="mt-auto space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-lg font-bold text-gray-900">
              {formatPrice(product.current_price)}
            </span>
            {product.median_price && info.verdict !== 'normal' && info.verdict !== 'no-data' && (
              <span className="text-xs text-gray-400 line-through">
                {formatPrice(product.median_price)}
              </span>
            )}
          </div>

          <div className={`text-xs border rounded-full px-2 py-0.5 inline-block ${verdictColor(info.verdict)}`}>
            {info.labelRo}
          </div>

          <Link
            href={`/go/${product.offer_id}`}
            className="block w-full text-center text-sm font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg py-2 transition-colors"
            target="_blank"
            rel="noopener sponsored"
          >
            Cumpără →
          </Link>
        </div>
      </div>
    </article>
  )
}
