// Pragurile analizei de pret, fata de MEDIANA ultimelor 30 de zile (decise 2026-09-26).
// Aceeasi definitie se foloseste pe pagina de produs, pe /reduceri-reale/ si in reclame
// (in SQL: current_price < median_price * 0.95). Nu le schimba doar aici.
export const REAL_DISCOUNT_PCT = 5   // >= 5% sub mediana → reducere reala
export const ABOVE_MEDIAN_PCT = 5    // >  5% peste mediana → mai scump ca de obicei

export type DiscountVerdict =
  | 'real'       // pret cu minim 5% sub mediana — reducere reala
  | 'normal'     // intre 5% sub si 5% peste mediana
  | 'higher'     // pret cu peste 5% peste mediana
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
  const pct = Math.round((1 - ratio) * 1000) / 10  // pozitiv = reducere (rotunjit, pentru afisare)

  // Decizia pe valoarea exacta (nu pe cea rotunjita), identic cu SQL-ul din queries.ts —
  // altfel un produs la 4,96% ar aparea „reducere” pe pagina, dar nu si pe /reduceri-reale/.
  if (ratio < 1 - REAL_DISCOUNT_PCT / 100) {
    return { verdict: 'real', discountPct: pct, label: 'real-discount', labelRo: `Reducere reală −${formatPct(pct)}%` }
  }
  if (ratio <= 1 + ABOVE_MEDIAN_PCT / 100) {
    return { verdict: 'normal', discountPct: pct, label: 'normal', labelRo: 'Preț obișnuit' }
  }
  return { verdict: 'higher', discountPct: pct, label: 'higher', labelRo: `Mai scump +${formatPct(pct)}%` }
}

// Procent in format romanesc, fara semn: 16.2 → „16,2”, 8 → „8”
export function formatPct(pct: number): string {
  return Math.abs(pct).toLocaleString('ro-RO', { maximumFractionDigits: 1 })
}

// Text scurt pentru diferenta fata de mediana: „2% sub mediană” / „3% peste mediană”
export function medianDeltaText(discountPct: number | null): string {
  if (discountPct == null || discountPct === 0) return 'egal cu mediana'
  return discountPct > 0 ? `${formatPct(discountPct)}% sub mediană` : `${formatPct(discountPct)}% peste mediană`
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
    case 'normal': return 'bg-gray-100 text-gray-600 border-gray-200'
    case 'higher': return 'bg-orange-100 text-orange-800 border-orange-200'
    default:       return 'bg-gray-50 text-gray-400 border-gray-100'
  }
}
