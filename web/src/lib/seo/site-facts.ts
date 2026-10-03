import { unstable_cache } from 'next/cache'
import pool from '../db'
import { OFFER_AVAILABLE_SQL } from '../availability'
import { EXCLUDED_AD_ROOTS } from './site'

// Cifre live despre site (homepage, llms.txt): cate produse urmarim, la cate magazine, de cand
// avem istoric, cate reduceri reale sunt acum. Cache o ora.
//
// „De cand avem istoric” = min(products.created_at): tabela de produse e mica si produsele nu se
// sterg niciodata (CLAUDE.md), iar fiecare produs intra in istoric din ziua importului. NU folosim
// min(price_history.recorded_at): price_history e partitionat dupa data, cu cheia (offer_id,
// recorded_at), deci min() pe ea ar citi tot istoricul.

export interface SiteFacts {
  products: number            // produse cu cel putin o oferta disponibila acum
  retailers: number           // magazine cu oferte disponibile acum
  realDiscounts: number       // produse cu reducere reala acum, in categoriile cu landing (fara Sanatate & Naturale)
  historySince: string | null // ISO, prima zi de istoric
  generatedAt: string         // ISO
}

export const getSiteFacts = unstable_cache(
  async (): Promise<SiteFacts> => {
    const { rows } = await pool.query(`
      WITH avail AS (
        SELECT p.id AS pid, p.category_id, o.retailer_id, o.current_price, o.affiliate_url, o.last_checked, o.id AS offer_id
        FROM products p JOIN offers o ON o.product_id = p.id
        WHERE o.current_price IS NOT NULL AND ${OFFER_AVAILABLE_SQL}
      ),
      excluded AS (
        SELECT c.id FROM categories c
        LEFT JOIN categories pc ON pc.id = c.parent_id
        WHERE c.slug = ANY($1) OR pc.slug = ANY($1)
      )
      SELECT
        (SELECT count(DISTINCT pid)::int FROM avail) AS products,
        (SELECT count(DISTINCT retailer_id)::int FROM avail) AS retailers,
        (SELECT count(DISTINCT a.pid)::int FROM avail a
           JOIN offer_price_stats s ON s.offer_id = a.offer_id AND s.points_30d >= 2
          WHERE a.affiliate_url IS NOT NULL
            AND a.last_checked >= now() - INTERVAL '48 hours'
            AND a.current_price < s.median_30d * 0.95
            AND a.category_id IS NOT NULL AND a.category_id NOT IN (SELECT id FROM excluded)) AS real_discounts,
        (SELECT min(created_at) FROM products) AS history_since
    `, [EXCLUDED_AD_ROOTS])
    const r = rows[0] ?? {}
    return {
      products: r.products ?? 0,
      retailers: r.retailers ?? 0,
      realDiscounts: r.real_discounts ?? 0,
      historySince: r.history_since ? new Date(r.history_since).toISOString() : null,
      generatedAt: new Date().toISOString(),
    }
  },
  ['seo-site-facts'],
  { revalidate: 3600, tags: ['products'] }
)
