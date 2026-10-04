import { REAL_DISCOUNT_PCT, verdictBadgeText, verdictColor, type DiscountVerdict } from '@/lib/discount'

// Insigna de verdict (redesign „Verdict întâi”, design §3): 4 stări, fiecare cu FORMĂ + SĂGEATĂ +
// CUVÂNT, nu doar culoare (daltonism). Pragurile sunt cele din lib/discount.ts (neschimbate).
//
// Două moduri de folosire:
//  - cu `verdict` (pagina de produs, unde avem calculateDiscount) → afișează oricare dintre stări;
//  - doar cu `discountPct` (listele: SQL-ul dă discount_pct NUMAI pentru reducerile reale) →
//    afișează insigna doar la reducere reală, altfel nimic — ca înainte de redesign.
interface VerdictBadgeProps {
  discountPct: number | null
  verdict?: DiscountVerdict
  size?: 'sm' | 'lg'
  className?: string
}

export function VerdictBadge({ discountPct, verdict, size = 'sm', className = '' }: VerdictBadgeProps) {
  const v: DiscountVerdict | null = verdict
    ?? (discountPct != null && discountPct >= REAL_DISCOUNT_PCT ? 'real' : null)
  if (!v) return null

  const sizing = size === 'lg'
    ? 'text-[15px] gap-1.5 pl-[9px] pr-[11px] py-[7px] rounded-lg'
    : 'text-[12.5px] gap-[5px] pl-[7px] pr-2 py-[5px] rounded-md'
  const icon = size === 'lg' ? 16 : 13

  return (
    <span
      className={`inline-flex items-center font-display font-extrabold leading-none whitespace-nowrap tabular-nums tracking-[.005em] ${sizing} ${verdictColor(v)} ${className}`}
    >
      <VerdictIcon verdict={v} size={icon} />
      {verdictBadgeText(v, discountPct)}
    </span>
  )
}

// Săgeata (jos = sub mediană, egal = în intervalul obișnuit, sus = peste). Fără istoric: doar text.
function VerdictIcon({ verdict, size }: { verdict: DiscountVerdict; size: number }) {
  const d = verdict === 'real' ? 'M12 5v13M6 12l6 6 6-6'
    : verdict === 'higher' ? 'M12 19V6M6 12l6-6 6 6'
    : verdict === 'normal' ? 'M5 9h14M5 15h14'
    : null
  if (!d) return null
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
