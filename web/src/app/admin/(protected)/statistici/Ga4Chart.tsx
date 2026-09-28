'use client'

// Graficul pe zile din /admin/statistici: sesiuni + clickuri spre magazine (ambele din GA4).
// E componenta client pentru ca recharts deseneaza in browser (masoara latimea containerului).
// Doua axe verticale: sesiunile sunt de zeci de ori mai multe decat clickurile — pe aceeasi axa
// linia clickurilor ar fi lipita de zero.

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'

export interface ChartPoint {
  day: string                    // YYYY-MM-DD
  sessions: number | null        // null = zi fara date (linia se intrerupe, nu cade la 0)
  affiliate_clicks: number | null
}

// Aceleasi culori ca restul adminului: albastrul din graficul de pret + rosul brandului
const SESSIONS_COLOR = '#3182CE'
const CLICKS_COLOR = 'var(--color-brand)'
const AXIS_COLOR = '#718096'  // --color-muted

// „2026-09-27” → „27 sept.”. Citim data ca UTC ca sa nu o mute fusul orar al browserului cu o zi.
function formatDay(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

export function Ga4Chart({ data }: { data: ChartPoint[] }) {
  const points = data.map((d) => ({ ...d, label: formatDay(d.day) }))

  return (
    // min-w: adminul are sidebar fix; pe ecrane inguste graficul ar ramane de cativa pixeli si
    // recharts nu mai deseneaza nimic → pastram o latime minima si lasam pagina sa se deruleze.
    <div className="w-full min-w-[480px] h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#E2E8F0" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: AXIS_COLOR }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis
            yAxisId="sessions"
            tick={{ fontSize: 11, fill: SESSIONS_COLOR }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            width={44}
          />
          <YAxis
            yAxisId="clicks"
            orientation="right"
            tick={{ fontSize: 11, fill: CLICKS_COLOR }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            width={36}
          />
          <Tooltip
            formatter={(value) => (typeof value === 'number' ? value.toLocaleString('ro-RO') : '—')}
            contentStyle={{ fontSize: 12, border: '1px solid var(--color-line)', borderRadius: 8, background: 'var(--color-surface)' }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            yAxisId="sessions"
            type="monotone"
            dataKey="sessions"
            name="Sesiuni (axa stângă)"
            stroke={SESSIONS_COLOR}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            yAxisId="clicks"
            type="monotone"
            dataKey="affiliate_clicks"
            name="Clickuri spre magazine (axa dreaptă)"
            stroke={CLICKS_COLOR}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
