import { unstable_cache } from 'next/cache'
import pool from '../db'
import { OFFER_AVAILABLE_SQL } from '../availability'

// Query-uri pentru SEO (sitemap, metadata /c/ si /t/, hub /reduceri-reale, blocurile noi de pe
// /p/, llms.txt). Toate: doar oferte disponibile (OFFER_AVAILABLE_SQL), cache unstable_cache,
// fara agregari pe price_history (CLAUDE.md: „Mediana precalculată”, incidentul din 26 sep).

export interface CategoryStat {
  id: number
  slug: string
  name: string
  parent_id: number | null
  parent_slug: string | null
  parent_name: string | null
  visible: boolean          // categoria SI parintele ei sunt vizibile
  own_products: number      // produse disponibile direct in categorie
  products: number          // inclusiv subcategoriile (pe parinti)
  retailers: number         // magazine distincte (inclusiv subcategoriile)
  brands: number            // marci distincte (inclusiv subcategoriile)
  min_price: number | null  // cel mai mic pret disponibil acum (inclusiv subcategoriile)
}

// Toate categoriile cu cifrele lor live, intr-un singur query (o agregare pe ofertele disponibile,
// ~30k randuri pe prod). Arborele are 2 niveluri: fiecare oferta conteaza pentru categoria ei si
// pentru parinte.
export const getCategoryTreeStats = unstable_cache(
  async (): Promise<CategoryStat[]> => {
    const { rows } = await pool.query<CategoryStat>(`
      WITH a AS (
        SELECT p.id AS pid, p.category_id, NULLIF(p.brand, '') AS brand, o.retailer_id, o.current_price
        FROM products p
        JOIN offers o ON o.product_id = p.id
        WHERE p.category_id IS NOT NULL
          AND o.current_price IS NOT NULL
          AND ${OFFER_AVAILABLE_SQL}
      ),
      t AS (
        SELECT a.category_id AS cat_id, a.* FROM a
        UNION ALL
        SELECT c.parent_id AS cat_id, a.* FROM a JOIN categories c ON c.id = a.category_id WHERE c.parent_id IS NOT NULL
      ),
      agg AS (
        SELECT cat_id,
               count(DISTINCT pid)::int AS products,
               count(DISTINCT pid) FILTER (WHERE category_id = cat_id)::int AS own_products,
               count(DISTINCT retailer_id)::int AS retailers,
               count(DISTINCT brand)::int AS brands,
               min(current_price)::float AS min_price
        FROM t GROUP BY cat_id
      )
      SELECT c.id, c.slug, c.name, c.parent_id, pc.slug AS parent_slug, pc.name AS parent_name,
             (c.is_visible AND COALESCE(pc.is_visible, true)) AS visible,
             COALESCE(agg.own_products, 0) AS own_products,
             COALESCE(agg.products, 0) AS products,
             COALESCE(agg.retailers, 0) AS retailers,
             COALESCE(agg.brands, 0) AS brands,
             agg.min_price
      FROM categories c
      LEFT JOIN categories pc ON pc.id = c.parent_id
      LEFT JOIN agg ON agg.cat_id = c.id
      ORDER BY COALESCE(pc.sort_order, c.sort_order), COALESCE(pc.id, c.id), c.parent_id NULLS FIRST, c.sort_order, c.id
    `)
    return rows
  },
  ['seo-category-tree-stats'],
  { revalidate: 3600, tags: ['categories', 'products'] }
)

export async function getCategoryStat(slug: string): Promise<CategoryStat | null> {
  return (await getCategoryTreeStats()).find((c) => c.slug === slug) ?? null
}

// Tag-urile (Refurbished, Second Hand) cu numarul de produse disponibile
export const getTagStats = unstable_cache(
  async (): Promise<{ slug: string; name: string; products: number }[]> => {
    const { rows } = await pool.query(`
      SELECT t.slug, t.name,
             (SELECT count(DISTINCT p.id)::int
              FROM product_tags pt
              JOIN products p ON p.id = pt.product_id
              JOIN offers o ON o.product_id = p.id
              WHERE pt.tag_id = t.id AND o.current_price IS NOT NULL AND ${OFFER_AVAILABLE_SQL}) AS products
      FROM tags t
      ORDER BY t.name
    `)
    return rows
  },
  ['seo-tag-stats'],
  { revalidate: 3600, tags: ['categories', 'products'] }
)

// Numarul de reduceri reale ACUM per categorie (inclusiv subcategoriile pe parinti), cu EXACT
// conditiile din getLandingProducts (queries.ts): oferta disponibila, cu link afiliat, verificata
// in ultimele 48 de ore, mediana din >= 2 puncte, pret < 95% din mediana; un produs se numara o data.
export const getRealDiscountCounts = unstable_cache(
  async (): Promise<Record<string, number>> => {
    const { rows } = await pool.query<{ slug: string; n: number }>(`
      WITH d AS (
        SELECT DISTINCT p.id AS pid, p.category_id
        FROM products p
        JOIN offers o ON o.product_id = p.id
        JOIN offer_price_stats s ON s.offer_id = o.id AND s.points_30d >= 2
        WHERE p.category_id IS NOT NULL
          AND o.current_price IS NOT NULL
          AND ${OFFER_AVAILABLE_SQL}
          AND o.affiliate_url IS NOT NULL
          AND o.last_checked >= now() - INTERVAL '48 hours'
          AND o.current_price < s.median_30d * 0.95
      ),
      t AS (
        SELECT d.category_id AS cat_id, d.pid FROM d
        UNION
        SELECT c.parent_id, d.pid FROM d JOIN categories c ON c.id = d.category_id WHERE c.parent_id IS NOT NULL
      )
      SELECT c.slug, count(DISTINCT t.pid)::int AS n
      FROM t JOIN categories c ON c.id = t.cat_id
      GROUP BY c.slug
    `)
    return Object.fromEntries(rows.map((r) => [r.slug, r.n]))
  },
  ['seo-real-discount-counts'],
  { revalidate: 900, tags: ['discounts', 'products'] }
)

export interface ProductLink {
  id: string
  name: string
  slug: string
  brand: string | null
  price: number
}

// „Alte variante”: produse disponibile din aceeasi categorie al caror nume incepe cu aceeasi baza
// (lib/seo/product-facts.ts → variantBase). Comparatie de prefix cu left() — fara LIKE (baza poate
// contine % sau _). Filtrul pe category_id foloseste indexul idx_products_category_id.
export const getProductVariants = unstable_cache(
  async (productId: string, categoryId: number, base: string, limit = 8): Promise<ProductLink[]> => {
    const { rows } = await pool.query<ProductLink>(`
      SELECT DISTINCT ON (p.id) p.id::text, p.name, p.slug, p.brand, o.current_price::float AS price
      FROM products p
      JOIN offers o ON o.product_id = p.id
      WHERE p.category_id = $2
        AND p.id <> $1
        AND left(p.name, length($3)) = $3
        AND o.current_price IS NOT NULL
        AND ${OFFER_AVAILABLE_SQL}
      ORDER BY p.id, o.current_price ASC
    `, [productId, categoryId, base])
    return rows.sort((a, b) => a.price - b.price).slice(0, limit)
  },
  ['seo-product-variants'],
  { revalidate: 3600, tags: ['products'] }
)

// „Produse similare”: aceeasi categorie, aceeasi marca intai, apoi pretul cel mai apropiat
// (in ±30%). Exclude produsul si variantele lui (aceeasi baza de nume).
export const getSimilarProducts = unstable_cache(
  async (productId: string, categoryId: number, brand: string | null, price: number, base: string | null, limit = 6): Promise<ProductLink[]> => {
    const { rows } = await pool.query<ProductLink>(`
      WITH best AS (
        SELECT DISTINCT ON (p.id) p.id, p.name, p.slug, p.brand, o.current_price::float AS price
        FROM products p
        JOIN offers o ON o.product_id = p.id
        WHERE p.category_id = $2
          AND p.id <> $1
          AND ($5::text IS NULL OR left(p.name, length($5)) <> $5)
          AND o.current_price BETWEEN $4 * 0.7 AND $4 * 1.3
          AND ${OFFER_AVAILABLE_SQL}
        ORDER BY p.id, o.current_price ASC
      )
      SELECT id::text, name, slug, brand, price FROM best
      ORDER BY (brand IS NOT DISTINCT FROM $3) DESC, abs(price - $4) ASC, id
      LIMIT $6
    `, [productId, categoryId, brand, price, base, limit])
    return rows
  },
  ['seo-similar-products'],
  { revalidate: 3600, tags: ['products'] }
)
