// Încărcarea ofertelor din care pickBestOffer (best-offer.ts) alege „cel mai ieftin magazin
// partener”. Folosit de `npm run cercetare` și de verificarea săptămânală a articolelor
// (guide-health-job.ts). DOAR citire.
import type pg from 'pg'
import { ALERT_OFFER_AVAILABLE_SQL } from './alert-sql.js'
import { pickBestOffer, type OfferCandidate } from './best-offer.js'

export interface ProductOffer extends OfferCandidate {
  productId: number
  retailerId: number
  retailerName: string
  median30d: number | null
  min30d: number | null
  max30d: number | null
  priceChanges60d: number
}

// Toate ofertele cu preț ale produselor date, fiecare cu `available` calculat după aceeași regulă
// ca OFFER_AVAILABLE_SQL din web. Statisticile vin precalculate din offer_price_stats (nu agregăm
// price_history aici). Un singur query pentru toată lista (fără N+1).
export async function fetchProductOffers(db: pg.Pool | pg.PoolClient, productIds: readonly number[]): Promise<ProductOffer[]> {
  if (!productIds.length) return []
  const res = await db.query<{
    offer_id: string; product_id: string; retailer_id: number; retailer_name: string; price: number | null
    available: boolean; affiliate_url: string | null; last_checked: Date | null
    median_30d: number | null; min_30d: number | null; max_30d: number | null; price_changes_60d: number | null
  }>(`
    SELECT o.id AS offer_id, o.product_id, o.retailer_id, r.name AS retailer_name,
           o.current_price::float AS price, ${ALERT_OFFER_AVAILABLE_SQL} AS available,
           o.affiliate_url, o.last_checked,
           s.median_30d::float AS median_30d, s.min_30d::float AS min_30d, s.max_30d::float AS max_30d,
           s.price_changes_60d
    FROM offers o
    JOIN retailers r ON r.id = o.retailer_id
    LEFT JOIN offer_price_stats s ON s.offer_id = o.id
    WHERE o.product_id = ANY($1::bigint[]) AND o.current_price IS NOT NULL
  `, [productIds])
  return res.rows.map((r) => ({
    offerId: Number(r.offer_id),
    productId: Number(r.product_id),
    retailerId: r.retailer_id,
    retailerName: r.retailer_name,
    price: r.price,
    available: r.available,
    affiliateUrl: r.affiliate_url,
    lastChecked: r.last_checked,
    median30d: r.median_30d,
    min30d: r.min_30d,
    max30d: r.max_30d,
    priceChanges60d: r.price_changes_60d ?? 0,
  }))
}

export interface ProductOfferSummary {
  best: ProductOffer | null
  // magazine distincte cu ofertă disponibilă (cu sau fără afiliat — cât de „comparabil” e produsul)
  storeCount: number
  // suma schimbărilor de preț din 60 de zile pe ofertele disponibile (ca „are poveste”, migrația 035)
  priceChanges60d: number
}

// Grupează ofertele pe produs și aplică regula ofertei alese.
export function summarizeByProduct(offers: readonly ProductOffer[]): Map<number, ProductOfferSummary> {
  const byProduct = new Map<number, ProductOffer[]>()
  for (const o of offers) {
    const list = byProduct.get(o.productId)
    if (list) list.push(o)
    else byProduct.set(o.productId, [o])
  }
  const out = new Map<number, ProductOfferSummary>()
  for (const [pid, list] of byProduct) {
    const available = list.filter((o) => o.available)
    out.set(pid, {
      best: pickBestOffer(list),
      storeCount: new Set(available.map((o) => o.retailerId)).size,
      priceChanges60d: available.reduce((s, o) => s + o.priceChanges60d, 0),
    })
  }
  return out
}
