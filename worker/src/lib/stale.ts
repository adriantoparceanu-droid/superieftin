import pool from './db.js'

// O oferta negasita in niciun feed / scanare / price-check de atatea zile nu mai e afisata.
// (Pastreaza sincron cu OFFER_STALE_DAYS din web/src/lib/availability.ts.)
export const OFFER_STALE_DAYS = 3

// Marcheaza „fara stoc” TOATE ofertele neconfirmate de OFFER_STALE_DAYS, pentru orice
// retailer si orice sursa. Nu sterge nimic: istoricul ramane, iar oferta revine singura
// cand reapare intr-un feed (upsert-ul seteaza in_stock + last_checked = now()).
export async function markStaleOffers(days = OFFER_STALE_DAYS): Promise<number> {
  const res = await pool.query(
    `UPDATE offers SET in_stock = false
     WHERE in_stock = true
       AND (last_checked IS NULL OR last_checked < now() - make_interval(days => $1))`,
    [days],
  )
  return res.rowCount ?? 0
}
