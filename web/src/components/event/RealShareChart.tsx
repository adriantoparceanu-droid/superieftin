import type { ChartPoint } from '@/lib/event-tracker'
import { dayLabel } from '@/lib/event-tracker'
import { roCount } from '@/lib/seo/site'

// Graficul zilnic al trackerului: ce procent din produsele reduse în ziua respectivă aveau o
// reducere reală. SVG desenat de mână (ca PriceStepChart, fără recharts), randat pe server —
// nu are nevoie de JavaScript. Barele stau într-un SVG întins (preserveAspectRatio="none", fără
// text în el, deci nimic nu se deformează); etichetele sunt HTML, ca să rămână lizibile pe telefon.
// Culorile = tokeni de design (corecte și în modul întunecat). Cifrele exacte: tabelul de sub grafic.

const SHORT = new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const short = (day: string) => SHORT.format(new Date(`${day}T00:00:00Z`))

export function RealShareChart({ points }: { points: ChartPoint[] }) {
  if (!points.length) return null
  const n = points.length
  const W = 100 * n          // o „coloană” de 100 de unități pe zi
  const H = 100              // 1 unitate = 1 procent
  const gap = n > 20 ? 18 : 28
  const last = points[n - 1]
  const ticks = n >= 3 ? [0, Math.floor((n - 1) / 2), n - 1] : n === 2 ? [0, 1] : [0]

  return (
    <figure className="mt-3">
      <div className="grid grid-cols-[34px_minmax(0,1fr)] gap-x-2">
        {/* Axa Y (HTML): 100% / 50% / 0% */}
        <div aria-hidden="true" className="relative h-44 text-[11px] tabular-nums text-ink-3 sm:h-52">
          <span className="absolute right-0 top-0 -translate-y-1/2">100%</span>
          <span className="absolute right-0 top-1/2 -translate-y-1/2">50%</span>
          <span className="absolute bottom-0 right-0 translate-y-1/2">0%</span>
        </div>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`Procentul reducerilor reale din produsele reduse, pe zile: ultima zi, ${dayLabel(last.day)}, ${last.pct}%.`}
          className="h-44 w-full overflow-visible sm:h-52"
        >
          {[0, 25, 50, 75, 100].map((y) => (
            <line key={y} x1={0} x2={W} y1={H - y} y2={H - y} stroke="var(--line)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          ))}
          {points.map((p, i) => (
            <rect
              key={p.day}
              x={i * 100 + gap / 2}
              width={100 - gap}
              y={H - p.pct}
              height={Math.max(p.pct, 0.6)}
              rx={0}
              fill={i === n - 1 ? 'var(--red)' : 'var(--ink-3)'}
              opacity={i === n - 1 ? 1 : 0.55}
            >
              <title>{`${dayLabel(p.day)}: ${p.pct}% din ${roCount(p.reduse, 'produse reduse', 'produsul redus')}`}</title>
            </rect>
          ))}
        </svg>
        {/* Axa X (HTML): prima zi, mijlocul, ultima zi */}
        <div />
        <div aria-hidden="true" className="relative mt-1 h-4 text-[11px] text-ink-3">
          {ticks.map((i) => (
            <span
              key={i}
              className="absolute whitespace-nowrap"
              style={{
                left: `${((i + 0.5) / n) * 100}%`,
                transform: i === 0 && n > 1 ? 'translateX(-20%)' : i === n - 1 && n > 1 ? 'translateX(-80%)' : 'translateX(-50%)',
              }}
            >
              {short(points[i].day)}
            </span>
          ))}
        </div>
      </div>
      <figcaption className="mt-2 text-[12.5px] text-ink-3">
        Ultima zi: <strong className="tabular-nums text-red-ink">{last.pct}%</strong> din produsele reduse aveau o reducere reală.
      </figcaption>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer font-semibold text-ink underline underline-offset-2">Vezi cifrele pe zile</summary>
        <table className="mt-2 w-full max-w-md border-collapse text-[13px] tabular-nums">
          <thead>
            <tr className="text-left text-ink-3">
              <th scope="col" className="py-1 pr-3 font-medium">Ziua</th>
              <th scope="col" className="py-1 pr-3 text-right font-medium">Produse reduse</th>
              <th scope="col" className="py-1 text-right font-medium">Reduceri reale</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.day} className="border-t border-line">
                <td className="py-1 pr-3 text-ink-2">{dayLabel(p.day)}</td>
                <td className="py-1 pr-3 text-right text-ink-2">{p.reduse.toLocaleString('ro-RO')}</td>
                <td className="py-1 text-right font-semibold text-ink">{p.pct}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}
