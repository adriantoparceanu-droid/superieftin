// Pragurile analizei de pret, fata de MEDIANA ultimelor 30 de zile (decise 2026-09-26).
// Aceeasi definitie se foloseste pe pagina de produs, pe /reduceri-reale/ si in reclame
// (in SQL: current_price < median_price * 0.95). Nu le schimba doar aici.
export const REAL_DISCOUNT_PCT = 5   // >= 5% sub mediana → reducere reala
export const ABOVE_MEDIAN_PCT = 5    // >  5% peste mediana → mai scump ca de obicei
// O „reducere reala” se afiseaza pe landing pages / homepage doar daca pretul a fost verificat
// in ultimele 48 de ore (in SQL: last_checked >= now() - interval '48 hours'). Altfel, daca un
// scraper se opreste cateva zile, am promite reduceri pe preturi care poate nu mai exista.
export const FRESH_HOURS = 48

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
  // „Peste obișnuit” (redesign): aceeași denumire ca insigna de verdict (components/VerdictBadge.tsx)
  return { verdict: 'higher', discountPct: pct, label: 'higher', labelRo: `Peste obișnuit +${formatPct(pct)}%` }
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

// „Verificat acum 3 ore” / „Verificat pe 31 august” — data reala, niciodata „azi” fix
export function formatVerified(checkedAt: string | Date): string {
  const d = new Date(checkedAt)
  const diffH = Math.floor((Date.now() - d.getTime()) / 3600000)
  if (diffH < 1) return 'Verificat acum mai puțin de o oră'
  if (diffH < 24) return `Verificat acum ${diffH} ${diffH === 1 ? 'oră' : 'ore'}`
  const day = new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'long', timeZone: 'Europe/Bucharest' }).format(d)
  return `Verificat pe ${day}`
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

// Clasele insignei de verdict (redesign, design §3) — pe tokeni, deci corecte și în modul
// întunecat: roșu plin = reducere reală (singurul alt roșu plin în afară de „Vezi oferta”),
// gri = preț obișnuit, chihlimbar = peste obișnuit, contur = fără istoric suficient.
export function verdictColor(verdict: DiscountVerdict): string {
  switch (verdict) {
    case 'real':   return 'bg-red text-white'
    case 'normal': return 'bg-neutral-tint text-ink-2'
    case 'higher': return 'bg-amber-tint text-amber-ink'
    default:       return 'bg-transparent text-ink-3 ring-1 ring-inset ring-line-2'
  }
}

// Textul insignei de verdict. „Reducere reală” trebuie să rămână scris EXACT așa: garda de
// reclame (worker/src/ads/campaigns/guard.ts + validate.ts) îl caută pe landing-ul /p/.
export function verdictBadgeText(verdict: DiscountVerdict, discountPct: number | null): string {
  switch (verdict) {
    case 'real':
      return discountPct != null ? `Reducere reală −${formatPct(discountPct)}%` : 'Reducere reală'
    case 'normal':
      return 'Preț obișnuit'
    case 'higher':
      return discountPct != null ? `Peste obișnuit +${formatPct(discountPct)}%` : 'Peste obișnuit'
    default:
      return 'Monitorizăm prețul'
  }
}
