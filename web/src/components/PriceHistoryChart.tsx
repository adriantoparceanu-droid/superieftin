'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import type { PricePoint } from '@/lib/queries'

interface PriceHistoryChartProps {
  data: PricePoint[]
  currentPrice: number | null
  medianPrice: number | null
}

// Paleta de culori per retailer (prima e brandul).
const COLORS = ['#E53E3E', '#3182CE', '#38A169', '#D69E2E', '#805AD5', '#DD6B20', '#319795', '#D53F8C']

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' })
}

function formatLei(value: number) {
  return `${value.toLocaleString('ro-RO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} lei`
}

export function PriceHistoryChart({ data, currentPrice, medianPrice }: PriceHistoryChartProps) {
  // Retailerii distincti, in ordinea aparitiei
  const retailers = [...new Set(data.map(d => d.retailer_name))]

  // Pivot pe zi: un rand per zi cu cate o coloana per retailer (ultimul pret din ziua aceea).
  // Datele vin sortate crescator, deci ultima scriere = cel mai recent pret al zilei.
  const byDay = new Map<string, Record<string, number | string>>()
  for (const d of data) {
    const dayKey = d.recorded_at.slice(0, 10)
    let row = byDay.get(dayKey)
    if (!row) { row = { fullDate: dayKey, date: formatDate(d.recorded_at) }; byDay.set(dayKey, row) }
    row[d.retailer_name] = d.price
  }
  const chartData = [...byDay.values()].sort((a, b) => String(a.fullDate).localeCompare(String(b.fullDate)))

  // Avem nevoie de cel putin 2 zile ca sa desenam o linie.
  if (chartData.length < 2) {
    return (
      <div className="flex items-center justify-center h-32 rounded-lg text-sm text-muted" style={{ background: 'var(--color-page)' }}>
        Date insuficiente — istoricul se construiește cu fiecare verificare.
      </div>
    )
  }

  const prices = data.map(d => d.price)
  const minP = Math.floor(Math.min(...prices) * 0.97)
  const maxP = Math.ceil(Math.max(...prices) * 1.03)

  return (
    <div className="w-full h-56">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
            formatter={(value) => (typeof value === 'number' ? formatLei(value) : value)}
            labelFormatter={label => `Data: ${label}`}
            contentStyle={{ fontSize: 12, border: '1px solid var(--color-line)', borderRadius: 8, background: 'var(--color-surface)' }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {medianPrice && (
            <ReferenceLine
              y={medianPrice}
              stroke="#718096"
              strokeDasharray="4 2"
              label={{ value: 'mediana 30 de zile', position: 'insideTopRight', fontSize: 10, fill: '#718096' }}
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
          {retailers.map((name, i) => (
            <Line
              key={name}
              type="monotone"
              dataKey={name}
              name={name}
              stroke={COLORS[i % COLORS.length]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
