import type { PriceFactRow } from '@/lib/seo/product-facts'
import { ChartIcon, ClockIcon, StoreIcon } from './icons'
import { Parts } from './VerdictCard'

// „Pe scurt despre preț” (redesign, stilul C): 3 rânduri cu iconiță, generate STRICT din date de
// priceFactRows (lib/seo/product-facts.ts) — poziția prețului de azi, ultima schimbare, diferența
// dintre magazine. Fraze citabile de motoare și asistenți AI; fără verdict și fără promisiuni.

const ICONS = { chart: ChartIcon, clock: ClockIcon, store: StoreIcon }

export function PriceFacts({ rows }: { rows: PriceFactRow[] }) {
  if (!rows.length) return null
  return (
    <ul className="mt-2.5 flex flex-col gap-2.5 text-sm text-ink-2">
      {rows.map((r, i) => {
        const Icon = ICONS[r.icon]
        return (
          <li key={i} className="grid grid-cols-[20px_1fr] gap-2">
            <Icon className="mt-0.5 h-[18px] w-[18px] text-ink-3" />
            <span className="tabular-nums"><Parts parts={r.parts} /></span>
          </li>
        )
      })}
    </ul>
  )
}
