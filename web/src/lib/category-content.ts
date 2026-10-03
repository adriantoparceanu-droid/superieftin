// Textele pe categorii (migratia 030): intro + FAQ din DB si cifrele live pentru marcajele
// {{cat:…}} (vezi lib/category-markers.ts pentru sintaxa).
//
// Separat de lib/queries.ts intentionat: paginile /c/ sunt modificate in paralel de pachetul
// SEO tehnic (titlu, meta, canonical), iar aici e doar zona de continut.

import { unstable_cache } from 'next/cache'
import pool from './db'
import { OFFER_AVAILABLE_SQL } from './availability'
import { REAL_DISCOUNT_PCT, FRESH_HOURS } from './discount'
import { parseFaq, type CategoryFaqItem, type CategoryStats } from './category-markers'

export interface CategoryContent {
  intro_md: string | null
  faq: CategoryFaqItem[]
  content_updated_at: string | null
}

export const getCategoryContent = unstable_cache(
  async (slug: string): Promise<CategoryContent | null> => {
    const { rows } = await pool.query(`
      SELECT intro_md, faq, content_updated_at::text
      FROM categories WHERE slug = $1
    `, [slug])
    const r = rows[0]
    if (!r) return null
    return { intro_md: r.intro_md, faq: parseFaq(r.faq), content_updated_at: r.content_updated_at }
  },
  ['category-content'],
  { revalidate: 3600, tags: ['categories'] }
)

// Cifrele pentru marcaje, intr-o singura interogare. Aceleasi reguli ca restul site-ului:
// - doar oferte disponibile (OFFER_AVAILABLE_SQL), categoria + subcategoriile ei;
// - pretul unui produs = cea mai mica oferta disponibila;
// - „reducere reala” = exact regula de pe /reduceri-reale/ (getLandingProducts): mediana din
//   offer_price_stats cu minim 2 preturi in 30 de zile, pret verificat in ultimele FRESH_HOURS,
//   link afiliat, pret sub mediana cu cel putin REAL_DISCOUNT_PCT;
// - mediana NU se calculeaza din price_history (CLAUDE.md, „Mediana precalculata”);
//   PERCENTILE_CONT de aici e doar pe preturile curente ale produselor din categorie (sute–mii de randuri).
// - „de cand urmarim” = cea mai veche oferta inca disponibila (offers.created_at), nu
//   min(price_history) — ar scana istoricul partitionat.
export const getCategoryStats = unstable_cache(
  async (slug: string): Promise<CategoryStats> => {
    const ratio = 1 - REAL_DISCOUNT_PCT / 100
    const { rows } = await pool.query(`
      WITH av AS (
        SELECT p.id AS pid, NULLIF(trim(p.brand), '') AS brand, o.current_price AS price,
               o.retailer_id, o.created_at, o.affiliate_url, o.last_checked,
               s.median_30d, s.points_30d
        FROM products p
        JOIN offers o ON o.product_id = p.id
        LEFT JOIN offer_price_stats s ON s.offer_id = o.id
        WHERE p.category_id IN (
            SELECT c.id FROM categories c
            WHERE c.slug = $1 OR c.parent_id = (SELECT id FROM categories WHERE slug = $1))
          AND o.current_price IS NOT NULL
          AND ${OFFER_AVAILABLE_SQL}
      ),
      per_product AS (
        SELECT pid, min(brand) AS brand, min(price) AS price,
               bool_or(points_30d >= 2) AS has_median,
               bool_or(points_30d >= 2 AND affiliate_url IS NOT NULL
                       AND last_checked >= now() - make_interval(hours => $2::int)
                       AND price < median_30d * $3::numeric) AS is_real
        FROM av GROUP BY pid
      ),
      -- marcile grupate fara diferenta de majuscule („ASUS” = „Asus”); afisam forma cea mai des intalnita
      brands AS (
        SELECT mode() WITHIN GROUP (ORDER BY brand) AS brand, count(*) AS n
        FROM per_product WHERE brand IS NOT NULL
        GROUP BY lower(brand)
        ORDER BY n DESC, 1 LIMIT 5
      )
      SELECT
        (SELECT count(*) FROM per_product)::int AS produse,
        (SELECT count(DISTINCT retailer_id) FROM av)::int AS magazine,
        (SELECT coalesce(array_agg(r.name ORDER BY r.name), '{}') FROM retailers r
          WHERE r.id IN (SELECT DISTINCT retailer_id FROM av)) AS magazine_nume,
        (SELECT count(*) FILTER (WHERE is_real) FROM per_product)::int AS reduceri,
        (SELECT count(*) FILTER (WHERE has_median) FROM per_product)::int AS cu_mediana,
        (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY price) FROM per_product)::float AS pret_median,
        (SELECT percentile_cont(0.1) WITHIN GROUP (ORDER BY price) FROM per_product)::float AS pret_p10,
        (SELECT percentile_cont(0.9) WITHIN GROUP (ORDER BY price) FROM per_product)::float AS pret_p90,
        (SELECT coalesce(array_agg(brand ORDER BY n DESC, brand), '{}') FROM brands) AS branduri,
        (SELECT min(created_at) FROM av) AS istoric_de_la,
        now() AS actualizat
    `, [slug, FRESH_HOURS, ratio])
    const r = rows[0]
    return {
      produse: r.produse,
      magazine: r.magazine,
      magazineNume: r.magazine_nume,
      reduceri: r.reduceri,
      cuMediana: r.cu_mediana,
      pretMedian: r.pret_median,
      pretP10: r.pret_p10,
      pretP90: r.pret_p90,
      branduri: r.branduri,
      // pg intoarce timestamptz ca Date; il trimitem ca ISO (unstable_cache serializeaza JSON)
      istoricDeLa: r.istoric_de_la ? new Date(r.istoric_de_la).toISOString() : null,
      actualizat: new Date(r.actualizat).toISOString(),
    }
  },
  ['category-content-stats'],
  { revalidate: 3600, tags: ['products', 'categories'] }
)
