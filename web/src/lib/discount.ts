export type DiscountVerdict =
  | 'real'       // pret < mediana * 0.90 — reducere verificata
  | 'good'       // pret < mediana * 0.95 — pret bun
  | 'normal'     // in intervalul ±5% fata de mediana
  | 'higher'     // pret > mediana * 1.05 — mai scump ca de obicei
  | 'no-data'    // date insuficiente

export interface DiscountInfo {
  verdict: DiscountVerdict
  discountPct: number | null   // pozitiv = reducere, negativ = mai scump
  label: string
  labelRo: string
}

export function calculateDiscount(
  currentPrice: number | null,
  medianPrice: number | null
): DiscountInfo {
  if (currentPrice == null || medianPrice == null || medianPrice === 0) {
    return { verdict: 'no-data', discountPct: null, label: 'no-data', labelRo: 'Monitorizăm prețul' }
  }

  const ratio = currentPrice / medianPrice
  const pct = Math.round((1 - ratio) * 1000) / 10  // pozitiv = reducere

  if (pct >= 10) {
    return { verdict: 'real', discountPct: pct, label: 'real-discount', labelRo: `Reducere reală −${pct}%` }
  }
  if (pct >= 5) {
    return { verdict: 'good', discountPct: pct, label: 'good-price', labelRo: `Preț bun −${pct}%` }
  }
  if (pct > -5) {
    return { verdict: 'normal', discountPct: pct, label: 'normal', labelRo: 'Preț obișnuit' }
  }
  return { verdict: 'higher', discountPct: pct, label: 'higher', labelRo: `Mai scump +${Math.abs(pct)}%` }
}

export function formatPrice(price: number | null): string {
  if (price == null) return 'N/A'
  return new Intl.NumberFormat('ro-RO', {
    style: 'currency',
    currency: 'RON',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(price)
}

export function verdictColor(verdict: DiscountVerdict): string {
  switch (verdict) {
    case 'real':   return 'bg-green-100 text-green-800 border-green-200'
    case 'good':   return 'bg-blue-100 text-blue-800 border-blue-200'
    case 'normal': return 'bg-gray-100 text-gray-600 border-gray-200'
    case 'higher': return 'bg-orange-100 text-orange-800 border-orange-200'
    default:       return 'bg-gray-50 text-gray-400 border-gray-100'
  }
}
