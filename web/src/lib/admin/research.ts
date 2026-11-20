import pool from '../db'
import { OFFER_AVAILABLE_SQL } from '../availability'
import {
  RESEARCH_EXCLUDED_SLUGS, RESEARCH_PAGE_SIZE, researchOrderBy, type ResearchParams,
} from './research-filters'

// Admin → Cercetare: candidatii pentru articole (unealta interna; istoricul de pret nu mai e
// public). Fara cache: adminul e dinamic (layout-ul protejat citeste cookies()), fiecare
// incarcare citeste din DB.
//
// Regula „Mediana precalculata” (CLAUDE.md): lista NU agrega price_history pe loc — mediana,
// min/max pe 30 de zile si schimbarile de pret pe 60 de zile vin din offer_price_stats.

export interface ResearchTheme {
  id: number
  slug: string
  name: string
  is_visible: boolean
  children: { id: number; slug: string; name: string; is_visible: boolean }[]
}

// Temele din filtru: parintii cu subcategoriile lor (arborele are 2 niveluri), fara arborii
// exclusi. Include si categoriile ascunse (marcate in pagina) — cercetarea e interna.
export async function getResearchThemes(): Promise<ResearchTheme[]> {
  const { rows } = await pool.query<{ id: number; slug: string; name: string; is_visible: boolean; parent_id: number | null }>(`
    SELECT c.id, c.slug, c.name, c.is_visible, c.parent_id
    FROM categories c
    LEFT JOIN categories pc ON pc.id = c.parent_id
    WHERE c.slug <> ALL($1::text[]) AND COALESCE(pc.slug, '') <> ALL($1::text[])
    ORDER BY c.sort_order, c.name
  `, [RESEARCH_EXCLUDED_SLUGS])
  const parents = rows.filter((r) => r.parent_id == null)
  return parents.map((p) => ({
    id: p.id, slug: p.slug, name: p.name, is_visible: p.is_visible,
    children: rows.filter((r) => r.parent_id === p.id)
      .map(({ id, slug, name, is_visible }) => ({ id, slug, name, is_visible })),
  }))
}

export interface ResearchRow {
  product_id: string
  name: string
  slug: string
  brand: string | null
  category_name: string | null
  best_price: number            // cel mai bun pret disponibil cu link afiliat
  best_retailer: string         // magazinul ofertei de mai sus
  median_30d: number | null     // mediana 30 z a ofertei alese (doar cu ≥ 2 puncte)
  min_30d: number | null
  max_30d: number | null
  discount_pct: number | null   // (mediana − pret) / mediana × 100; pozitiv = sub mediana
  stores: number                // magazine distincte cu oferta disponibila + link afiliat
  price_changes_60d: number     // suma pe ofertele de mai sus (ca regula „are poveste”)
}

export interface ResearchResult {
  rows: ResearchRow[]
  total: number
}

// Candidatii: produse cu cel putin o oferta disponibila (OFFER_AVAILABLE_SQL) CU affiliate_url,
// in categorii mapate, in afara arborilor exclusi (Sanatate & Naturale, farmacie veterinara).
//
// „Cel mai bun pret” = regula cardului din articole (design §2): cel mai mic pret dintre ofertele
// disponibile cu link afiliat; la egalitate, oferta confirmata cel mai recent. Mediana / min / max
// sunt ale ACELEI oferte (fiecare magazin are istoricul lui — ca pe /p/). „Doar reduceri reale” =
// pretul ei < mediana × 0,95 (REAL_DISCOUNT_PCT, lib/discount.ts).
//
// Tema = slug de categorie: parintele aduce si subcategoriile, subcategoria doar pe ea.
export async function getResearchCandidates(params: ResearchParams): Promise<ResearchResult> {
  const offset = (params.pagina - 1) * RESEARCH_PAGE_SIZE
  const { rows } = await pool.query<ResearchRow & { total: number }>(`
    WITH cand AS (
      SELECT o.id, o.product_id, o.retailer_id, o.current_price, o.last_checked,
             CASE WHEN s.points_30d >= 2 AND s.median_30d > 0 THEN s.median_30d END AS median_30d,
             s.min_30d, s.max_30d, COALESCE(s.price_changes_60d, 0) AS price_changes_60d,
             c.name AS category_name
      FROM offers o
      JOIN products p ON p.id = o.product_id
      JOIN categories c ON c.id = p.category_id
      LEFT JOIN categories pc ON pc.id = c.parent_id
      LEFT JOIN offer_price_stats s ON s.offer_id = o.id
      WHERE ${OFFER_AVAILABLE_SQL}
        AND o.affiliate_url IS NOT NULL
        AND o.current_price > 0
        AND c.slug <> ALL($1::text[]) AND COALESCE(pc.slug, '') <> ALL($1::text[])
        AND ($2::text IS NULL OR c.slug = $2 OR pc.slug = $2)
    ),
    best AS (
      SELECT DISTINCT ON (product_id) *
      FROM cand
      ORDER BY product_id, current_price ASC, last_checked DESC NULLS LAST, id ASC
    ),
    agg AS (
      SELECT product_id, COUNT(DISTINCT retailer_id)::int AS stores,
             SUM(price_changes_60d)::int AS price_changes_60d
      FROM cand
      GROUP BY product_id
    ),
    lst AS (
      SELECT b.product_id, b.id AS offer_id, b.retailer_id, b.category_name,
             b.current_price AS best_price, b.median_30d, b.min_30d, b.max_30d,
             CASE WHEN b.median_30d IS NOT NULL
               THEN (b.median_30d - b.current_price) / b.median_30d * 100 END AS discount_pct,
             a.stores, a.price_changes_60d
      FROM best b
      JOIN agg a USING (product_id)
      WHERE ($3::numeric IS NULL OR b.current_price <= $3)
        AND (NOT $4::boolean OR (b.median_30d IS NOT NULL AND b.current_price < b.median_30d * 0.95))
    )
    SELECT l.product_id::text, p.name, p.slug, p.brand, l.category_name,
           l.best_price::float, r.name AS best_retailer,
           l.median_30d::float, l.min_30d::float, l.max_30d::float,
           ROUND(l.discount_pct::numeric, 1)::float AS discount_pct,
           l.stores, l.price_changes_60d,
           COUNT(*) OVER ()::int AS total
    FROM lst l
    JOIN products p ON p.id = l.product_id
    JOIN retailers r ON r.id = l.retailer_id
    ORDER BY ${researchOrderBy(params.sort)}
    LIMIT $5 OFFSET $6
  `, [RESEARCH_EXCLUDED_SLUGS, params.tema, params.buget, params.reale, RESEARCH_PAGE_SIZE, offset])

  // COUNT(*) OVER () vine pe fiecare rand. Dincolo de ultima pagina nu avem randuri, deci nici
  // total (0) — pagina arata atunci un link inapoi la pagina 1.
  const total = rows[0]?.total ?? 0
  return { rows: rows.map(({ total, ...r }) => (void total, r)), total }
}

export interface ProductGuideRef {
  id: number
  slug: string
  title: string
  status: 'draft' | 'published'
}

// „Apare în ghidurile: …” din fisa interna — toate ghidurile (si ciornele), din guide_products
export async function getGuidesUsingProduct(productId: string): Promise<ProductGuideRef[]> {
  const { rows } = await pool.query<ProductGuideRef>(`
    SELECT g.id, g.slug, g.title, g.status
    FROM guide_products gp
    JOIN guides g ON g.id = gp.guide_id
    WHERE gp.product_id = $1
    ORDER BY (g.status = 'published') DESC, g.published_at DESC NULLS LAST, g.updated_at DESC
  `, [productId])
  return rows
}
