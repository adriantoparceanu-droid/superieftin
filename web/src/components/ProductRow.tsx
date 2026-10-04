import Image from 'next/image'
import { VerdictBadge } from './VerdictBadge'
import { SelectItemLink } from './analytics/SelectItemLink'
import { MiniThermometer } from './listing/MiniThermometer'
import { gaItemOf, NoImage } from './ProductCard'
import { formatPrice } from '@/lib/discount'
import { listingView, otherStoresText } from '@/lib/listing-product'
import type { ProductWithDiscount } from '@/lib/queries'

// Rândul de listă de pe mobil (macheta direcției B, „.row” — densitate tip idealo): miniatură,
// insigna de verdict, numele pe 2 rânduri, prețul + „mediana X”, magazinul + „încă N magazine”
// și mini-termometrul. Tot rândul e un link spre /p/ (select_item în GA4), ca ProductCard.

export function ProductRow({ product }: { product: ProductWithDiscount }) {
  const v = listingView(product)
  const others = otherStoresText(v.stores)

  return (
    <SelectItemLink
      href={`/p/${product.slug}`}
      item={gaItemOf(product)}
      className="flex gap-3 border-b border-line bg-surface px-4 py-3 text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink"
    >
      {/* Dimensiuni fixe: fără salt de pagină la încărcarea imaginii */}
      <div className="relative h-[84px] w-[84px] shrink-0 overflow-hidden rounded-[10px] bg-surface-2 dark:bg-white">
        {product.image_url ? (
          <Image src={product.image_url} alt="" fill sizes="84px" className="object-contain p-1.5 mix-blend-multiply" unoptimized />
        ) : (
          <NoImage className="w-9 h-9" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <VerdictBadge verdict={v.info.verdict} discountPct={v.info.discountPct} className="max-w-full overflow-hidden" />
        <h3 className="mt-[5px] line-clamp-2 font-sans text-sm font-semibold leading-[1.3] tracking-normal text-ink [font-stretch:100%]">
          {product.name}
        </h3>
        <p className="mt-[5px] flex flex-wrap items-baseline gap-x-2">
          <span className="font-display text-[18.5px] font-extrabold tabular-nums">{formatPrice(product.current_price)}</span>
          {v.median && <span className="text-xs tabular-nums text-ink-3">mediana {v.median}</span>}
        </p>
        <div className="mt-0.5 flex items-center justify-between gap-2 text-xs text-ink-2">
          <span className="min-w-0 truncate">
            la <b className="font-bold text-ink">{product.retailer_name}</b>
            {others && <> · {others}</>}
          </span>
          {v.thermo && <MiniThermometer th={v.thermo} verdict={v.info.verdict} className="w-[72px] shrink-0" />}
        </div>
      </div>
    </SelectItemLink>
  )
}
