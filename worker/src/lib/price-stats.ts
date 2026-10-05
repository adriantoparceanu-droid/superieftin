import pool from './db.js'

// Recalculeaza offer_price_stats (migratia 019): mediana pe 30 de zile, numarul de puncte si
// ultimul pret din istoric, pentru FIECARE oferta. Din migratia 032 si minimul/maximul pe
// aceeasi fereastra de 30 de zile (termometrul de pe /p/ si mini-termometrele din liste) —
// calculate in aceeasi agregare, ca cele trei valori sa fie mereu din acelasi set de puncte.
// Din migratia 033 si data primei inregistrari din istoric (first_recorded_at): regula SEO din
// 5 oct. 2026 indexeaza /p/ doar daca urmarim produsul de cel putin 30 de zile
// (web/src/lib/seo/product-index.ts); sitemap-ul ia MIN(first_recorded_at) pe ofertele produsului.
// Site-ul citeste doar tabela (JOIN), in loc sa agrege price_history la fiecare pagina. Rulat dupa fiecare scriere in istoric.
//
// Un singur UPSERT tranzactional: site-ul vede fie valorile vechi, fie cele noi, niciodata
// o tabela goala. Ofertele fara istoric raman cu median_30d NULL (ca inainte, LEFT JOIN).
export async function refreshOfferPriceStats(): Promise<number> {
  const res = await pool.query(`
    INSERT INTO offer_price_stats (offer_id, median_30d, min_30d, max_30d, points_30d, latest_price, first_recorded_at, computed_at)
    SELECT o.id, m.median, m.min_price, m.max_price, COALESCE(m.points, 0), l.price, f.recorded_at, now()
    FROM offers o
    LEFT JOIN (
      SELECT offer_id,
             PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price) AS median,
             MIN(price) AS min_price,
             MAX(price) AS max_price,
             COUNT(*)::int AS points
      FROM price_history
      WHERE recorded_at >= now() - INTERVAL '30 days'
      GROUP BY offer_id
    ) m ON m.offer_id = o.id
    LEFT JOIN (
      SELECT DISTINCT ON (offer_id) offer_id, price
      FROM price_history
      ORDER BY offer_id, recorded_at DESC
    ) l ON l.offer_id = o.id
    -- Prima inregistrare: o citire pe cheia primara (offer_id, recorded_at) a fiecarei partitii,
    -- oprita la primul rand (LIMIT 1) — ieftin, fara sa agregam tot istoricul.
    LEFT JOIN LATERAL (
      SELECT ph.recorded_at FROM price_history ph
      WHERE ph.offer_id = o.id
      ORDER BY ph.recorded_at
      LIMIT 1
    ) f ON true
    ON CONFLICT (offer_id) DO UPDATE SET
      median_30d = EXCLUDED.median_30d,
      min_30d = EXCLUDED.min_30d,
      max_30d = EXCLUDED.max_30d,
      points_30d = EXCLUDED.points_30d,
      latest_price = EXCLUDED.latest_price,
      first_recorded_at = EXCLUDED.first_recorded_at,
      computed_at = EXCLUDED.computed_at
  `)
  return res.rowCount ?? 0
}
