import pool from './db.js'

// Recalculeaza offer_price_stats (migratia 019): mediana pe 30 de zile, numarul de puncte si
// ultimul pret din istoric, pentru FIECARE oferta. Din migratia 032 si minimul/maximul pe
// aceeasi fereastra de 30 de zile (termometrul de pe /p/ si mini-termometrele din liste) —
// calculate in aceeasi agregare, ca cele trei valori sa fie mereu din acelasi set de puncte.
// Din migratia 033 si data primei inregistrari din istoric (first_recorded_at): regula SEO din
// 5 oct. 2026 indexeaza /p/ doar daca urmarim produsul de cel putin 30 de zile
// (web/src/lib/seo/product-index.ts); sitemap-ul ia MIN(first_recorded_at) pe ofertele produsului.
// Din migratia 035 si price_changes_60d: de cate ori s-a schimbat pretul intre doua puncte
// CONSECUTIVE din istoric, ambele in ultimele 60 de zile — conditia „are poveste” a indexarii /p/
// (≥ 2 magazine SAU ≥ 3 schimbari de pret, product-index.ts). Doua puncte la acelasi pret
// (snapshot-ul zilnic + feed-sync) nu sunt o schimbare.
// Site-ul citeste doar tabela (JOIN), in loc sa agrege price_history la fiecare pagina. Rulat dupa fiecare scriere in istoric.
//
// Un singur UPSERT tranzactional: site-ul vede fie valorile vechi, fie cele noi, niciodata
// o tabela goala. Ofertele fara istoric raman cu median_30d NULL (ca inainte, LEFT JOIN).
export async function refreshOfferPriceStats(): Promise<number> {
  const res = await pool.query(`
    INSERT INTO offer_price_stats (offer_id, median_30d, min_30d, max_30d, points_30d, latest_price, first_recorded_at, price_changes_60d, computed_at)
    SELECT o.id, m.median, m.min_price, m.max_price, COALESCE(m.points, 0), l.price, f.recorded_at, COALESCE(ch.changes, 0), now()
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
    -- Schimbarile de pret pe 60 de zile: LAG pe punctele din fereastra (doar partitiile recente,
    -- o singura sortare dupa cheia primara), apoi numaram trecerile la alt pret. Punctul de
    -- dinaintea ferestrei nu conteaza (prima valoare din fereastra n-are „precedent”).
    LEFT JOIN (
      SELECT offer_id, COUNT(*) FILTER (WHERE prev IS NOT NULL AND price <> prev)::int AS changes
      FROM (
        SELECT offer_id, price, LAG(price) OVER (PARTITION BY offer_id ORDER BY recorded_at) AS prev
        FROM price_history
        WHERE recorded_at >= now() - INTERVAL '60 days'
      ) w
      GROUP BY offer_id
    ) ch ON ch.offer_id = o.id
    ON CONFLICT (offer_id) DO UPDATE SET
      median_30d = EXCLUDED.median_30d,
      min_30d = EXCLUDED.min_30d,
      max_30d = EXCLUDED.max_30d,
      points_30d = EXCLUDED.points_30d,
      latest_price = EXCLUDED.latest_price,
      first_recorded_at = EXCLUDED.first_recorded_at,
      price_changes_60d = EXCLUDED.price_changes_60d,
      computed_at = EXCLUDED.computed_at
  `)
  return res.rowCount ?? 0
}
