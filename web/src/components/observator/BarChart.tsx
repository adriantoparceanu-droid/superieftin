// Grafic cu bare, SVG desenat pe server (fără JavaScript în browser, fără recharts): seria
// săptămânală din „Când să cumperi” și variațiile lunare din /indice. Culorile vin din tokeni
// (var(--red), var(--ink-3)…), deci funcționează și în modul întunecat.
//
// Valorile pot fi și negative (variații de preț): linia de bază e la zero. Fiecare bară are un
// <title> (apare la hover și e citit de cititoarele de ecran); pagina pune oricum și un tabel cu
// aceleași cifre, pentru cine nu vede graficul.

export interface Bar {
  key: string
  value: number | null
  tick: string          // eticheta de sub bară (scurtă)
  title: string         // textul complet pentru <title>
  highlight?: boolean   // bară scoasă în evidență (ex. cele mai multe reduceri reale)
}

const W = 720
const H = 220
const PAD_L = 36
const PAD_R = 8
const PAD_T = 14
const PAD_B = 28

export function BarChart({ bars, ariaLabel, format, maxTicks = 8 }: {
  bars: Bar[]
  ariaLabel: string
  format: (v: number) => string
  maxTicks?: number
}) {
  if (!bars.length) return null
  const values = bars.map((b) => b.value ?? 0)
  const max = Math.max(0, ...values)
  const min = Math.min(0, ...values)
  const span = max - min || 1
  const plotH = H - PAD_T - PAD_B
  const y = (v: number) => PAD_T + ((max - v) / span) * plotH
  const zero = y(0)
  const step = (W - PAD_L - PAD_R) / bars.length
  const barW = Math.max(2, Math.min(36, step * 0.7))
  // Etichetele de sub bare: cel mult `maxTicks`, distribuite uniform (altfel se suprapun)
  const every = Math.max(1, Math.ceil(bars.length / maxTicks))

  return (
    // Pe telefon graficul se derulează pe orizontală (min. 560 px), altfel etichetele ar ieși minuscule
    <figure className="mt-3 overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} className="block h-auto w-full min-w-[560px]">
        {/* gradații: maxim, zero, minim */}
        {[max, 0, ...(min < 0 ? [min] : [])].map((v, i) => (
          <g key={i}>
            <line x1={PAD_L} x2={W - PAD_R} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeWidth={v === 0 ? 1.5 : 1} strokeDasharray={v === 0 ? undefined : '3 4'} />
            <text x={PAD_L - 4} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--ink-3)">{format(v)}</text>
          </g>
        ))}
        {bars.map((b, i) => {
          const x = PAD_L + i * step + (step - barW) / 2
          const v = b.value
          const top = v == null ? zero : Math.min(y(v), zero)
          const h = v == null ? 0 : Math.max(1, Math.abs(y(v) - zero))
          return (
            <g key={b.key}>
              <title>{b.title}</title>
              {v == null ? (
                <line x1={x} x2={x + barW} y1={zero} y2={zero} stroke="var(--line-2)" strokeWidth={2} />
              ) : (
                <rect x={x} y={top} width={barW} height={h} rx={2} fill={b.highlight ? 'var(--red)' : 'var(--ink-3)'} opacity={b.highlight ? 1 : 0.55} />
              )}
              {i % every === 0 && (
                <text x={x + barW / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--ink-3)">{b.tick}</text>
              )}
            </g>
          )
        })}
      </svg>
    </figure>
  )
}
