interface VerdictBadgeProps {
  discountPct: number | null
}

export function VerdictBadge({ discountPct }: VerdictBadgeProps) {
  if (discountPct == null || discountPct < 5) return null
  return (
    <span className="text-xs font-semibold text-brand">
      🔥 Reducere reală
    </span>
  )
}
