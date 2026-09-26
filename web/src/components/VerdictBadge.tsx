import { REAL_DISCOUNT_PCT } from '@/lib/discount'

interface VerdictBadgeProps {
  discountPct: number | null
}

export function VerdictBadge({ discountPct }: VerdictBadgeProps) {
  if (discountPct == null || discountPct < REAL_DISCOUNT_PCT) return null
  return (
    <span className="text-xs font-semibold text-brand">
      🔥 Reducere reală
    </span>
  )
}
