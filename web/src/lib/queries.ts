import { unstable_cache } from 'next/cache'
import pool from './db'

export interface ProductWithDiscount {
  id: string
  name: string
  slug: string
  category: string
  brand: string | null
  image_url: string | null
  offer_id: string
  current_price: number | null
  affiliate_url: string | null
  in_stock: boolean
  retailer_name: string
  retailer_slug: string
  median_price: number | null
  discount_pct: number | null
}

export interface ProductDetail {
  id: string
  name: string
  slug: string
  category: string
  brand: string | null
  image_url: string | null
  updated_at: string
  offers: OfferRow[]
}

export interface OfferRow {
  offer_id: string
  current_price: number | null
  affiliate_url: string | null
  url: string
  in_stock: boolean
  last_checked: string | null
  retailer_name: string
  retailer_slug: string
  median_price: number | null
  discount_pct: number | null
}

export interface PricePoint {
  price: number
  recorded_at: string
}

export interface CategoryInfo {
  category: string
  count: number
}

// Top reduceri reale: produse cu pret curent sub mediana ultimelor 30 de zile
export const getTopDiscounts = unstable_cache(
  async (limit = 24): Promise<ProductWithDiscount[]> => {
    const { rows } = await pool.query<ProductWithDiscount>(`
      WITH median_prices AS (
        SELECT
          offer_id,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price) AS median_price,
          COUNT(*) AS data_points
        FROM price_history
        WHERE recorded_at >= now() - INTERVAL '30 days'
        GROUP BY offer_id
        HAVING COUNT(*) >= 2
      )
      SELECT
        p.id::text,
        p.name,
        p.slug,
        p.category,
        p.brand,
        p.image_url,
        o.id::text AS offer_id,
        o.current_price::float AS current_price,
        o.affiliate_url,
        o.in_stock,
        r.name AS retailer_name,
        r.slug AS retailer_slug,
        mp.median_price::float AS median_price,
        ROUND(((mp.median_price - o.current_price) / mp.median_price * 100)::numeric, 1)::float AS discount_pct
      FROM products p
      JOIN offers o ON o.product_id = p.id
      JOIN retailers r ON r.id = o.retailer_id
      JOIN median_prices mp ON mp.offer_id = o.id
      WHERE o.current_price IS NOT NULL
        AND o.in_stock = true
        AND o.current_price < mp.median_price * 0.95
      ORDER BY discount_pct DESC
      LIMIT $1
    `, [limit])
    return rows
  },
  ['top-discounts'],
  { revalidate: 900, tags: ['discounts'] }
)

// Cele mai ieftine produse (fallback cand nu sunt reduceri reale)
export const getCheapestProducts = unstable_cache(
  async (limit = 24): Promise<ProductWithDiscount[]> => {
    const { rows } = await pool.query<ProductWithDiscount>(`
      WITH latest_history AS (
        SELECT DISTINCT ON (offer_id)
          offer_id,
          price AS median_price
        FROM price_history
        ORDER BY offer_id, recorded_at DESC
      )
      SELECT
        p.id::text,
        p.name,
        p.slug,
        p.category,
        p.brand,
        p.image_url,
        o.id::text AS offer_id,
        o.current_price::float AS current_price,
        o.affiliate_url,
        o.in_stock,
        r.name AS retailer_name,
        r.slug AS retailer_slug,
        lh.median_price::float AS median_price,
        NULL::float AS discount_pct
      FROM products p
      JOIN offers o ON o.product_id = p.id
      JOIN retailers r ON r.id = o.retailer_id
      LEFT JOIN latest_history lh ON lh.offer_id = o.id
      WHERE o.current_price IS NOT NULL
        AND o.in_stock = true
      ORDER BY o.current_price ASC
      LIMIT $1
    `, [limit])
    return rows
  },
  ['cheapest-products'],
  { revalidate: 3600, tags: ['products'] }
)

// Produse din categorie cu calculul discountului
export const getCategoryProducts = unstable_cache(
  async (category: string, limit = 48, sort: 'discount' | 'price' | 'name' = 'price'): Promise<ProductWithDiscount[]> => {
    const orderBy = sort === 'discount'
      ? 'discount_pct DESC NULLS LAST'
      : sort === 'price'
        ? 'current_price ASC NULLS LAST'
        : 'p.name ASC'

    const { rows } = await pool.query<ProductWithDiscount>(`
      WITH median_prices AS (
        SELECT
          offer_id,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price) AS median_price
        FROM price_history
        WHERE recorded_at >= now() - INTERVAL '30 days'
        GROUP BY offer_id
      )
      SELECT
        p.id::text,
        p.name,
        p.slug,
        p.category,
        p.brand,
        p.image_url,
        o.id::text AS offer_id,
        o.current_price::float AS current_price,
        o.affiliate_url,
        o.in_stock,
        r.name AS retailer_name,
        r.slug AS retailer_slug,
        mp.median_price::float AS median_price,
        CASE
          WHEN mp.median_price IS NOT NULL AND o.current_price < mp.median_price * 0.95
          THEN ROUND(((mp.median_price - o.current_price) / mp.median_price * 100)::numeric, 1)::float
          ELSE NULL
        END AS discount_pct
      FROM products p
      JOIN offers o ON o.product_id = p.id
      JOIN retailers r ON r.id = o.retailer_id
      LEFT JOIN median_prices mp ON mp.offer_id = o.id
      WHERE p.category = $1
        AND o.current_price IS NOT NULL
        AND o.in_stock = true
      ORDER BY ${orderBy}
      LIMIT $2
    `, [category, limit])
    return rows
  },
  ['category-products'],
  { revalidate: 3600, tags: ['products'] }
)

// Pagina de produs: detalii + toate ofertele
export const getProductDetail = unstable_cache(
  async (slug: string): Promise<ProductDetail | null> => {
    const productRes = await pool.query(`
      SELECT id::text, name, slug, category, brand, image_url, updated_at::text
      FROM products
      WHERE slug = $1
    `, [slug])

    if (productRes.rows.length === 0) return null
    const product = productRes.rows[0]

    const offersRes = await pool.query<OfferRow>(`
      WITH median_prices AS (
        SELECT
          offer_id,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price) AS median_price
        FROM price_history
        WHERE recorded_at >= now() - INTERVAL '30 days'
        GROUP BY offer_id
      )
      SELECT
        o.id::text AS offer_id,
        o.current_price::float AS current_price,
        o.affiliate_url,
        o.url,
        o.in_stock,
        o.last_checked::text AS last_checked,
        r.name AS retailer_name,
        r.slug AS retailer_slug,
        mp.median_price::float AS median_price,
        CASE
          WHEN mp.median_price IS NOT NULL AND o.current_price < mp.median_price * 0.95
          THEN ROUND(((mp.median_price - o.current_price) / mp.median_price * 100)::numeric, 1)::float
          ELSE NULL
        END AS discount_pct
      FROM offers o
      JOIN retailers r ON r.id = o.retailer_id
      LEFT JOIN median_prices mp ON mp.offer_id = o.id
      WHERE o.product_id = $1
      ORDER BY o.current_price ASC NULLS LAST
    `, [product.id])

    return { ...product, offers: offersRes.rows }
  },
  ['product-detail'],
  { revalidate: 3600, tags: ['products'] }
)

// Istoricul pretului pentru un produs (ultimele 90 de zile)
export const getPriceHistory = unstable_cache(
  async (productId: string): Promise<PricePoint[]> => {
    const { rows } = await pool.query<PricePoint>(`
      SELECT
        ph.price::float AS price,
        ph.recorded_at::text AS recorded_at
      FROM price_history ph
      JOIN offers o ON o.id = ph.offer_id
      WHERE o.product_id = $1
        AND ph.recorded_at >= now() - INTERVAL '90 days'
      ORDER BY ph.recorded_at ASC
    `, [productId])
    return rows
  },
  ['price-history'],
  { revalidate: 3600, tags: ['price-history'] }
)

// Lista de categorii
export const getCategories = unstable_cache(
  async (): Promise<CategoryInfo[]> => {
    const { rows } = await pool.query<CategoryInfo>(`
      SELECT category, COUNT(*)::int AS count
      FROM products
      WHERE EXISTS (
        SELECT 1 FROM offers o
        WHERE o.product_id = products.id AND o.current_price IS NOT NULL
      )
      GROUP BY category
      ORDER BY count DESC
    `)
    return rows
  },
  ['categories'],
  { revalidate: 3600, tags: ['products'] }
)

// Toate produsele pentru sitemap
export const getAllProductSlugs = unstable_cache(
  async (): Promise<Array<{ slug: string; updated_at: string }>> => {
    const { rows } = await pool.query(`
      SELECT slug, updated_at::text FROM products ORDER BY updated_at DESC
    `)
    return rows
  },
  ['all-slugs'],
  { revalidate: 86400, tags: ['products'] }
)

// Toate produsele in stoc pentru feed Google Shopping
export const getProductsForFeed = unstable_cache(
  async (): Promise<Array<{
    id: string
    offer_id: string
    name: string
    slug: string
    category: string
    brand: string | null
    image_url: string | null
    current_price: number | null
    affiliate_url: string | null
  }>> => {
    const { rows } = await pool.query(`
      SELECT
        p.id::text,
        o.id::text AS offer_id,
        p.name,
        p.slug,
        p.category,
        p.brand,
        p.image_url,
        o.current_price::float AS current_price,
        o.affiliate_url
      FROM products p
      JOIN offers o ON o.product_id = p.id
      WHERE o.in_stock = true AND o.current_price IS NOT NULL
      ORDER BY p.name ASC
      LIMIT 5000
    `)
    return rows
  },
  ['products-feed'],
  { revalidate: 86400, tags: ['products'] }
)

// Inregistreaza un click (folosit de ruta /go)
export async function trackClick(offerId: string): Promise<void> {
  try {
    await pool.query(
      'INSERT INTO click_events (offer_id) VALUES ($1)',
      [offerId]
    )
  } catch {
    // Non-critical — tabelul poate sa nu existe inca
  }
}
