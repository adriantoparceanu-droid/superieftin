'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import type { PricePoint } from '@/lib/queries'

interface PriceHistoryChartProps {
  data: PricePoint[]
  currentPrice: number | null
  medianPrice: number | null
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' })
}

function formatLei(value: number) {
  return `${value.toLocaleString('ro-RO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} lei`
}

export function PriceHistoryChart({ data, currentPrice, medianPrice }: PriceHistoryChartProps) {
  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center h-32 rounded-lg text-sm text-muted" style={{ background: 'var(--color-page)' }}>
        Date insuficiente — istoricul se construiește cu fiecare scraping.
      </div>
    )
  }

  const chartData = data.map(d => ({
    date: formatDate(d.recorded_at),
    price: d.price,
    fullDate: d.recorded_at,
  }))

  const prices = data.map(d => d.price)
  const minP = Math.floor(Math.min(...prices) * 0.97)
  const maxP = Math.ceil(Math.max(...prices) * 1.03)

  return (
    <div className="w-full h-48">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-brand)" stopOpacity={0.15} />
              <stop offset="95%" stopColor="var(--color-brand)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: '#718096' }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[minP, maxP]}
            tick={{ fontSize: 11, fill: '#718096' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={v => `${v}`}
            width={48}
          />
          <Tooltip
            formatter={(value) => [typeof value === 'number' ? formatLei(value) : value, 'Preț']}
            labelFormatter={label => `Data: ${label}`}
            contentStyle={{ fontSize: 12, border: '1px solid var(--color-line)', borderRadius: 8, background: 'var(--color-surface)' }}
          />
          {medianPrice && (
            <ReferenceLine
              y={medianPrice}
              stroke="#718096"
              strokeDasharray="4 2"
              label={{ value: 'medie 30z', position: 'insideTopRight', fontSize: 10, fill: '#718096' }}
            />
          )}
          {currentPrice && (
            <ReferenceLine
              y={currentPrice}
              stroke="var(--color-brand)"
              strokeDasharray="4 2"
              label={{ value: 'acum', position: 'insideBottomRight', fontSize: 10, fill: 'var(--color-brand)' }}
            />
          )}
          <Area
            type="monotone"
            dataKey="price"
            stroke="var(--color-brand)"
            strokeWidth={2}
            fill="url(#priceGrad)"
            dot={false}
            activeDot={{ r: 4, fill: 'var(--color-brand)' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
