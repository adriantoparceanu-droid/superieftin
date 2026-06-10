import { formatPrice } from '@/lib/discount'

interface PriceTagProps {
  price: number | null
  discountPct: number | null
}

export function PriceTag({ price, discountPct }: PriceTagProps) {
  return (
    <div className="flex items-baseline gap-2 flex-wrap">
      <span className="text-xl font-black font-archivo tabular-nums text-[var(--color-text)]">
        {formatPrice(price)}
      </span>
      {discountPct != null && discountPct >= 5 && (
        <span className="text-xs font-semibold bg-brand-light text-brand rounded-full px-2 py-0.5">
          −{discountPct}%
        </span>
      )}
    </div>
  )
}
