import Link from 'next/link'
import { VerdictBadge } from '@/components/VerdictBadge'
import { ABOVE_MEDIAN_PCT, REAL_DISCOUNT_PCT, type DiscountVerdict } from '@/lib/discount'

// Legenda celor trei verdicte (macheta „.how”), o singură dată, sus pe homepage — după ea,
// insignele de pe carduri se înțeleg fără explicații. Pragurile vin din lib/discount.ts,
// aceleași cu cele din calcul (nu le scriem de mână în text).
const ITEMS: [DiscountVerdict, string][] = [
  ['real', `cu ≥${REAL_DISCOUNT_PCT}% sub mediana pe 30 de zile`],
  ['normal', `la ±${REAL_DISCOUNT_PCT}% de mediană`],
  ['higher', `cu peste ${ABOVE_MEDIAN_PCT}% peste mediană`],
]

export function VerdictLegend() {
  return (
    <section aria-label="Ce înseamnă verdictele" className="pt-3.5 lg:pt-6">
      <ul className="grid gap-2 lg:grid-cols-3 lg:gap-3">
        {ITEMS.map(([verdict, text]) => (
          <li
            key={verdict}
            className="flex items-center gap-2.5 rounded-xl bg-surface px-3 py-2.5 text-[13px] text-ink-2 shadow-card lg:text-sm"
          >
            <VerdictBadge verdict={verdict} discountPct={null} className="min-w-[118px] justify-center" />
            <span>{text}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-ink-3">
        Pe carduri marcăm doar reducerile reale; verdictul complet e pe pagina produsului.{' '}
        <Link
          href="/ghiduri/metodologie"
          className="font-semibold text-red-ink underline-offset-2 hover:underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
        >
          Cum calculăm ›
        </Link>
      </p>
    </section>
  )
}
