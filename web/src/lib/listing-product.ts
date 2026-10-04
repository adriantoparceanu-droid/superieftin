// Ce afișează un produs într-o listă (cardul din grilă și rândul de pe mobil) — logica pură,
// testată în listing-product.test.ts. Fără importuri de server.
//
// De ce în TS și nu în SQL: query-urile de listă dau `discount_pct` DOAR pentru reducerile reale,
// iar listele arată acum toate cele 4 stări (Reducere reală / Preț obișnuit / Peste obișnuit /
// Monitorizăm prețul). Verdictul vine din aceeași funcție ca pe /p/ (calculateDiscount, pragurile
// din lib/discount.ts), deci lista și pagina de produs spun același lucru pentru aceeași ofertă.

import { calculateDiscount, formatAmount, type DiscountInfo } from './discount'
import { thermometer, type Thermometer } from './verdict'
import { roCount } from './seo/site'

export interface ListingInput {
  current_price: number | null
  median_price: number | null
  min_30d?: number | null
  max_30d?: number | null
  store_count?: number
}

export interface ListingView {
  info: DiscountInfo
  median: string | null       // „1.469” / „3.755,27” — mediana pe 30 de zile, fără monedă
  thermo: Thermometer | null  // mini-termometrul: doar cu min + max + mediană + preț (altfel nimic)
  stores: number | null       // numărul de magazine cu ofertă disponibilă (null = necunoscut)
}

export function listingView(p: ListingInput): ListingView {
  const info = calculateDiscount(p.current_price, p.median_price)
  const hasMedian = p.median_price != null && p.median_price > 0
  return {
    info,
    median: hasMedian ? formatAmount(p.median_price!) : null,
    thermo: hasMedian ? thermometer(p.min_30d ?? null, p.max_30d ?? null, p.median_price, p.current_price) : null,
    stores: p.store_count != null && p.store_count > 0 ? p.store_count : null,
  }
}

// Rândul de pe mobil: „încă un magazin” / „încă 2 magazine” / „încă 20 de magazine”; un singur
// magazin → nimic (nu scriem „încă 0 magazine”).
export function otherStoresText(stores: number | null): string | null {
  if (stores == null || stores < 2) return null
  const n = stores - 1
  return n === 1 ? 'încă un magazin' : `încă ${roCount(n, 'magazine')}`
}

// Cardul din grilă: „3 magazine” (doar de la 2 în sus).
export function storesText(stores: number | null): string | null {
  if (stores == null || stores < 2) return null
  return roCount(stores, 'magazine')
}
