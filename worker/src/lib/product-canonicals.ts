// Scrie products.canonical_product_id (migratia 035) din gruparea pe variante calculata de
// product-variants.ts (functii pure, testate). Rulat dupa refreshOfferPriceStats (sync.worker.ts):
// principala depinde de numarul de oferte disponibile si de first_recorded_at, care se schimba
// la fiecare feed-sync / scanare.
import pool from './db.js'
import { ALERT_OFFER_AVAILABLE_SQL } from './alert-sql.js'
import { assignCanonicals, type VariantCandidate } from './product-variants.js'

export interface CanonicalRefreshResult {
  candidates: number
  canonicalized: number                // variante cu canonical spre o principala
  groups: number
  changed: number                      // randuri din products modificate
}

// Recalculeaza products.canonical_product_id pentru tot catalogul. ~30k produse: o citire
// (subinterogari pe index), gruparea in memorie, apoi doua UPDATE-uri intr-o tranzactie (doar
// randurile care se schimba) — site-ul vede fie gruparea veche, fie cea noua.
export async function refreshProductCanonicals(): Promise<CanonicalRefreshResult> {
  const { rows } = await pool.query<{
    id: string; name: string; brand: string | null; category_id: number | null; tags: string[]
    available_offers: number; first_recorded_at: Date | null
  }>(`
    SELECT p.id::text, p.name, p.brand, p.category_id,
           COALESCE((SELECT array_agg(t.slug ORDER BY t.slug) FROM product_tags pt JOIN tags t ON t.id = pt.tag_id
                     WHERE pt.product_id = p.id), '{}') AS tags,
           (SELECT count(*)::int FROM offers o JOIN retailers r ON r.id = o.retailer_id
            WHERE o.product_id = p.id AND ${ALERT_OFFER_AVAILABLE_SQL}) AS available_offers,
           (SELECT min(s.first_recorded_at) FROM offers o JOIN offer_price_stats s ON s.offer_id = o.id
            WHERE o.product_id = p.id) AS first_recorded_at
    FROM products p
    WHERE p.category_id IS NOT NULL AND p.brand IS NOT NULL AND btrim(p.brand) <> ''
  `)
  const candidates: VariantCandidate[] = rows.map((r) => ({
    id: r.id, name: r.name, brand: r.brand, categoryId: r.category_id, tags: r.tags,
    availableOffers: r.available_offers, firstRecordedAt: r.first_recorded_at,
  }))
  const map = assignCanonicals(candidates)
  const ids = [...map.keys()]
  const targets = ids.map((id) => map.get(id)!)

  const client = await pool.connect()
  let changed = 0
  try {
    await client.query('BEGIN')
    const set = await client.query(`
      UPDATE products p SET canonical_product_id = m.cid
      FROM unnest($1::bigint[], $2::bigint[]) AS m(id, cid)
      WHERE p.id = m.id AND p.canonical_product_id IS DISTINCT FROM m.cid
    `, [ids, targets])
    const clear = await client.query(`
      UPDATE products SET canonical_product_id = NULL
      WHERE canonical_product_id IS NOT NULL AND id <> ALL ($1::bigint[])
    `, [ids])
    await client.query('COMMIT')
    changed = (set.rowCount ?? 0) + (clear.rowCount ?? 0)
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }
  return { candidates: candidates.length, canonicalized: ids.length, groups: new Set(targets).size, changed }
}
