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
//
// Performanta (22 oct. 2026, ~5 mil. puncte pe prod: 45–78 s inainte): o SINGURA citire a
// ultimelor 60 de zile da si mediana/min/max/puncte pe 30 de zile (FILTER) si schimbarile
// (LAG); ultimul si primul pret = cate o citire pe cheia primara (offer_id, recorded_at) per
// oferta, oprita la primul rand (inainte, ultimul pret sorta TOT istoricul, ~17 s). Randurile
// neschimbate NU se rescriu (WHERE ... IS DISTINCT FROM) — mai putin WAL si bloat; de aceea
// computed_at = momentul ultimei schimbari (nu e citit nicaieri). Intoarce randurile scrise.
export async function refreshOfferPriceStats(): Promise<number> {
  const res = await pool.query(`
    INSERT INTO offer_price_stats (offer_id, median_30d, min_30d, max_30d, points_30d, latest_price, first_recorded_at, price_changes_60d, computed_at)
    SELECT o.id, w.median, w.min_price, w.max_price, COALESCE(w.points, 0), l.price, f.recorded_at, COALESCE(w.changes, 0), now()
    FROM offers o
    -- Fereastra de 60 de zile, citita o singura data (partitiile recente, in ordinea cheii primare).
    -- Mediana/min/max/puncte = doar punctele din ultimele 30 de zile (FILTER). Schimbarile: LAG pe
    -- punctele din fereastra, numaram trecerile la alt pret; punctul de dinaintea ferestrei nu
    -- conteaza (prima valoare din fereastra n-are „precedent”).
    LEFT JOIN (
      SELECT offer_id,
             PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price) FILTER (WHERE recorded_at >= now() - INTERVAL '30 days') AS median,
             MIN(price) FILTER (WHERE recorded_at >= now() - INTERVAL '30 days') AS min_price,
             MAX(price) FILTER (WHERE recorded_at >= now() - INTERVAL '30 days') AS max_price,
             (COUNT(*) FILTER (WHERE recorded_at >= now() - INTERVAL '30 days'))::int AS points,
             (COUNT(*) FILTER (WHERE prev IS NOT NULL AND price <> prev))::int AS changes
      FROM (
        SELECT offer_id, price, recorded_at, LAG(price) OVER (PARTITION BY offer_id ORDER BY recorded_at) AS prev
        FROM price_history
        WHERE recorded_at >= now() - INTERVAL '60 days'
      ) w
      GROUP BY offer_id
    ) w ON w.offer_id = o.id
    -- Ultimul pret din istoric (oricat de vechi): citire pe cheia primara, de la partitia cea mai noua
    LEFT JOIN LATERAL (
      SELECT ph.price FROM price_history ph
      WHERE ph.offer_id = o.id
      ORDER BY ph.recorded_at DESC
      LIMIT 1
    ) l ON true
    -- Prima inregistrare: aceeasi citire pe cheia primara, de la partitia cea mai veche
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
      price_changes_60d = EXCLUDED.price_changes_60d,
      computed_at = EXCLUDED.computed_at
    WHERE (offer_price_stats.median_30d, offer_price_stats.min_30d, offer_price_stats.max_30d,
           offer_price_stats.points_30d, offer_price_stats.latest_price, offer_price_stats.first_recorded_at,
           offer_price_stats.price_changes_60d)
      IS DISTINCT FROM
          (EXCLUDED.median_30d, EXCLUDED.min_30d, EXCLUDED.max_30d, EXCLUDED.points_30d,
           EXCLUDED.latest_price, EXCLUDED.first_recorded_at, EXCLUDED.price_changes_60d)
  `)
  return res.rowCount ?? 0
}
