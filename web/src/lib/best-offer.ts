import pool from './db'
import { OFFER_AVAILABLE_SQL } from './availability'
import { pickBestOffer, type OfferCandidate, type BestOffer } from './best-offer-pick'

// Regula și tipurile stau în best-offer-pick.ts (pur, fără DB); aici doar citirea din DB.
export { pickBestOffer, isEligibleOffer, type OfferCandidate, type BestOffer } from './best-offer-pick'

// Cea mai bună ofertă pentru fiecare produs dintr-un articol — UN SINGUR query pentru toate
// produsele (fără câte un query pe card). Produsele fără ofertă eligibilă lipsesc din Map.
export async function getBestOffers(productIds: readonly string[]): Promise<Map<string, BestOffer>> {
  const ids = [...new Set(productIds.filter((id) => /^\d{1,18}$/.test(id)))]
  const result = new Map<string, BestOffer>()
  if (!ids.length) return result

  // last_checked vine ca Date (driverul pg), nu ::text: textul Postgres („… 10:00:00+02”) nu e
  // ISO și nu se parsează sigur cu new Date() — l-am trata drept neconfirmat.
  const { rows } = await pool.query<Omit<OfferCandidate, 'last_checked'> & { product_id: string; last_checked: Date | null }>(`
    SELECT o.product_id::text AS product_id, o.id::text AS offer_id, r.name AS retailer_name,
           o.current_price::float AS current_price, o.affiliate_url, o.in_stock,
           o.last_checked, (r.paused_at IS NOT NULL) AS retailer_paused
    FROM offers o
    JOIN retailers r ON r.id = o.retailer_id
    WHERE o.product_id = ANY($1::bigint[])
      AND o.current_price IS NOT NULL
      AND o.affiliate_url IS NOT NULL
      AND ${OFFER_AVAILABLE_SQL}
  `, [ids])

  const byProduct = new Map<string, OfferCandidate[]>()
  for (const r of rows) {
    const list = byProduct.get(r.product_id) ?? []
    list.push({ ...r, last_checked: r.last_checked ? new Date(r.last_checked).toISOString() : null })
    byProduct.set(r.product_id, list)
  }
  const now = new Date()
  for (const [pid, list] of byProduct) {
    const best = pickBestOffer(list, now)
    if (best) result.set(pid, best)
  }
  return result
}
