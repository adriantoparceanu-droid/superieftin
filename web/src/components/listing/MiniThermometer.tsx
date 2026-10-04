import type { DiscountVerdict } from '@/lib/discount'
import type { Thermometer } from '@/lib/verdict'

// Mini-termometrul din liste (macheta „.mini-th”): bara min–max pe 30 de zile, zona de reducere
// reală (≥5% sub mediană) hașurată în stânga, liniuța = mediana, punctul = prețul de azi.
// Geometria vine din lib/verdict.ts → thermometer() (aceeași ca termometrul mare de pe /p/).
// Decorativ pentru cititoarele de ecran: insigna și „mediana X” de lângă el spun deja totul.
const DOT: Record<DiscountVerdict, string> = {
  real: 'bg-red',
  higher: 'bg-amber',
  normal: 'bg-ink',
  'no-data': 'bg-ink',
}

export function MiniThermometer({ th, verdict, className = '' }: { th: Thermometer; verdict: DiscountVerdict; className?: string }) {
  return (
    <div
      aria-hidden="true"
      title="Prețul de azi (punct) față de mediană (liniuță), pe intervalul minim–maxim din ultimele 30 de zile"
      className={`relative h-[5px] rounded-full bg-surface-2 ring-1 ring-inset ring-line ${className}`}
    >
      <span className="absolute inset-y-0 left-0 rounded-l-full bg-red-zone" style={{ width: `${th.realEnd}%` }} />
      <span className="absolute -top-[3px] -bottom-[3px] w-[1.5px] bg-ink-3" style={{ left: `${th.median}%` }} />
      <span
        className={`absolute top-1/2 -ml-[4.5px] -mt-[4.5px] h-[9px] w-[9px] rounded-full border-2 border-surface ${DOT[verdict]}`}
        style={{ left: `${th.today}%` }}
      />
    </div>
  )
}
