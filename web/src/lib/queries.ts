import { unstable_cache } from 'next/cache'
import pool from './db'
import { maskPII } from './pii'
import { OFFER_AVAILABLE_SQL } from './availability'

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
  part_no: string | null          // codul producatorului / EAN din feed (JSON-LD: mpn sau gtin)
  category_id: number | null
  category_name: string | null    // numele categoriei (breadcrumb JSON-LD)
  parent_slug: string | null      // parintele categoriei, daca exista
  parent_name: string | null
  tags: string[]                  // slug-urile tag-urilor (refurbished, second-hand → itemCondition)
  offers: OfferRow[]              // DOAR ofertele disponibile (lib/availability.ts)
  alert_offer_id: string | null   // oferta pentru alerta de pret (si cand nu e nimic disponibil)
  last_seen: string | null        // ultima confirmare a oricarei oferte (pentru „indisponibil”)
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
  retailer_id: number
  retailer_name: string
}

export interface CategoryInfo {
  category: string          // slug
  count: number
  name?: string
  icon?: string | null
}

// Filtru de categorie dupa slug, incluzand subcategoriile (parintele isi aduna copiii).
// Folosit doar in modul optional "vezi tot" (?tot=1).
const CATEGORY_FILTER_SQL = `
  p.category_id IN (
    SELECT c.id FROM categories c
    WHERE c.slug = $1 OR c.parent_id = (SELECT id FROM categories WHERE slug = $1)
  )`

// Filtru strict: doar produsele categoriei selectate, fara subcategorii (drill-down).
// Implicit pe paginile de categorie — clientul vede exact ce a ales; subcategoriile
// se navigheaza separat, prin cardurile din pagina parinte.
const CATEGORY_FILTER_DIRECT = `
  p.category_id = (SELECT id FROM categories WHERE slug = $1)`

// Alege filtrul in functie de modul (agregat vs strict).
function categoryFilter(includeSub: boolean): string {
  return includeSub ? CATEGORY_FILTER_SQL : CATEGORY_FILTER_DIRECT
}

// Top reduceri reale: produse cu pret curent sub mediana ultimelor 30 de zile
export const getTopDiscounts = unstable_cache(
  async (limit = 24): Promise<ProductWithDiscount[]> => {
    const { rows } = await pool.query<ProductWithDiscount>(`
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
      JOIN (SELECT offer_id, median_30d AS median_price FROM offer_price_stats WHERE points_30d >= 2) mp ON mp.offer_id = o.id
      WHERE o.current_price IS NOT NULL
        AND ${OFFER_AVAILABLE_SQL}
        AND o.current_price < mp.median_price * 0.95
        -- doar preturi proaspete (FRESH_HOURS din lib/discount.ts)
        AND o.last_checked >= now() - INTERVAL '48 hours'
      ORDER BY discount_pct DESC
      LIMIT $1
    `, [limit])
    return rows
  },
  ['top-discounts'],
  { revalidate: 900, tags: ['discounts'] }
)

export interface LandingProduct extends ProductWithDiscount {
  last_checked: string | null
}

// Landing pages pentru reclame (/reduceri-reale/[categorie]): produsele categoriei (inclusiv
// subcategoriile) ordonate dupa pretul fata de mediana 30 de zile, cea mai buna oferta per
// produs. Doar oferte in stoc si CU LINK AFILIAT (trafic platit fara link afiliat = cost fara
// venit). Intoarce si produsele de langa prag: pagina le arata doar cand nu exista reduceri
// reale (discount_pct e NULL pentru ele). Pragul 0.95 = REAL_DISCOUNT_PCT din lib/discount.ts.
export const getLandingProducts = unstable_cache(
  async (category: string, limit = 48): Promise<LandingProduct[]> => {
    const { rows } = await pool.query<LandingProduct>(`
      WITH best AS (
        SELECT DISTINCT ON (p.id)
          p.id::text, p.name, p.slug, p.category, p.brand, p.image_url,
          o.id::text AS offer_id,
          o.current_price::float AS current_price,
          o.affiliate_url, o.in_stock, o.last_checked,
          r.name AS retailer_name, r.slug AS retailer_slug,
          mp.median_price::float AS median_price,
          o.current_price / mp.median_price AS ratio
        FROM products p
        JOIN offers o ON o.product_id = p.id
        JOIN retailers r ON r.id = o.retailer_id
        JOIN (SELECT offer_id, median_30d AS median_price FROM offer_price_stats WHERE points_30d >= 2) mp ON mp.offer_id = o.id
        WHERE ${CATEGORY_FILTER_SQL}
          AND o.current_price IS NOT NULL
          AND ${OFFER_AVAILABLE_SQL}
          AND o.affiliate_url IS NOT NULL
          -- doar preturi proaspete (FRESH_HOURS din lib/discount.ts)
          AND o.last_checked >= now() - INTERVAL '48 hours'
        ORDER BY p.id, o.current_price / mp.median_price ASC
      )
      SELECT *,
        CASE WHEN ratio < 0.95
          THEN ROUND(((1 - ratio) * 100)::numeric, 1)::float
          ELSE NULL
        END AS discount_pct
      FROM best
      ORDER BY ratio ASC
      LIMIT $2
    `, [category, limit])
    return rows
  },
  ['landing-products'],
  { revalidate: 900, tags: ['discounts', 'products'] }
)

// Cele mai ieftine produse (fallback cand nu sunt reduceri reale)
export const getCheapestProducts = unstable_cache(
  async (limit = 24): Promise<ProductWithDiscount[]> => {
    const { rows } = await pool.query<ProductWithDiscount>(`
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
      LEFT JOIN (SELECT offer_id, latest_price AS median_price FROM offer_price_stats) lh ON lh.offer_id = o.id
      WHERE o.current_price IS NOT NULL
        AND ${OFFER_AVAILABLE_SQL}
      ORDER BY o.current_price ASC
      LIMIT $1
    `, [limit])
    return rows
  },
  ['cheapest-products'],
  { revalidate: 3600, tags: ['products'] }
)

// Produse din categorie cu calculul discountului
export const PAGE_SIZE = 48

const SEARCH_SQL = `
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
  LEFT JOIN (SELECT offer_id, median_30d AS median_price FROM offer_price_stats) mp ON mp.offer_id = o.id
  WHERE o.current_price IS NOT NULL
    AND ${OFFER_AVAILABLE_SQL}
    AND (
      p.name ILIKE '%' || $1 || '%'
      OR p.brand ILIKE '%' || $1 || '%'
    )
`

export const searchProducts = unstable_cache(
  async (query: string, page = 1): Promise<ProductWithDiscount[]> => {
    const offset = (page - 1) * PAGE_SIZE
    const { rows } = await pool.query<ProductWithDiscount>(
      `${SEARCH_SQL} ORDER BY current_price ASC NULLS LAST LIMIT $2 OFFSET $3`,
      [query.trim(), PAGE_SIZE, offset]
    )
    return rows
  },
  ['search-products'],
  { revalidate: 300, tags: ['products'] }
)

export const searchProductCount = unstable_cache(
  async (query: string): Promise<number> => {
    const { rows } = await pool.query(
      `SELECT COUNT(DISTINCT p.id)::int AS count
       FROM products p
       JOIN offers o ON o.product_id = p.id
       WHERE o.current_price IS NOT NULL
         AND ${OFFER_AVAILABLE_SQL}
         AND (p.name ILIKE '%' || $1 || '%' OR p.brand ILIKE '%' || $1 || '%')`,
      [query.trim()]
    )
    return rows[0]?.count ?? 0
  },
  ['search-count'],
  { revalidate: 300, tags: ['products'] }
)

export const getCategoryProducts = unstable_cache(
  async (
    category: string,
    page = 1,
    sort: 'discount' | 'price' | 'name' = 'price',
    // Marcile bifate (?brand= repetat); null = toate. Vezi brandsForQuery (lib/listing-filters.ts).
    brands: string[] | null = null,
    includeSub = false
  ): Promise<ProductWithDiscount[]> => {
    const offset = (page - 1) * PAGE_SIZE
    const orderBy = sort === 'discount'
      ? 'discount_pct DESC NULLS LAST'
      : sort === 'price'
        ? 'current_price ASC NULLS LAST'
        : 'p.name ASC'

    const { rows } = await pool.query<ProductWithDiscount>(`
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
      LEFT JOIN (SELECT offer_id, median_30d AS median_price FROM offer_price_stats) mp ON mp.offer_id = o.id
      WHERE ${categoryFilter(includeSub)}
        AND o.current_price IS NOT NULL
        AND ${OFFER_AVAILABLE_SQL}
        AND ($4::text[] IS NULL OR p.brand = ANY($4::text[]))
      ORDER BY ${orderBy}
      LIMIT $2 OFFSET $3
    `, [category, PAGE_SIZE, offset, brands])
    return rows
  },
  ['category-products'],
  { revalidate: 3600, tags: ['products'] }
)

export const getCategoryProductCount = unstable_cache(
  async (category: string, brands: string[] | null = null, includeSub = false): Promise<number> => {
    const { rows } = await pool.query(`
      SELECT COUNT(DISTINCT p.id)::int AS count
      FROM products p
      JOIN offers o ON o.product_id = p.id
      WHERE ${categoryFilter(includeSub)}
        AND o.current_price IS NOT NULL
        AND ${OFFER_AVAILABLE_SQL}
        AND ($2::text[] IS NULL OR p.brand = ANY($2::text[]))
    `, [category, brands])
    return rows[0]?.count ?? 0
  },
  ['category-count'],
  { revalidate: 3600, tags: ['products'] }
)

// Marcile din categorie cu numarul de produse DISPONIBILE (aceeasi regula ca lista:
// OFFER_AVAILABLE_SQL + pret), pentru coloana de filtre. Independent de marcile bifate —
// coloana arata mereu toate optiunile. Ordine: cele mai multe produse intai.
// Cheia de cache e noua („-v2”): inainte functia intorcea string[], iar o intrare veche din
// cache cu forma veche ar strica pagina pana la expirare.
export const getCategoryBrands = unstable_cache(
  async (category: string, includeSub = false): Promise<{ brand: string; count: number }[]> => {
    const { rows } = await pool.query(`
      SELECT p.brand, COUNT(DISTINCT p.id)::int AS count
      FROM products p
      JOIN offers o ON o.product_id = p.id
      WHERE ${categoryFilter(includeSub)}
        AND p.brand IS NOT NULL
        AND p.brand != ''
        AND o.current_price IS NOT NULL
        AND ${OFFER_AVAILABLE_SQL}
      GROUP BY p.brand
      ORDER BY count DESC, p.brand ASC
    `, [category])
    return rows.map(r => ({ brand: r.brand as string, count: r.count as number }))
  },
  ['category-brands-v2'],
  { revalidate: 3600, tags: ['products'] }
)

// Fallback pentru categoriile-parinte fara produse proprii (ex. „Laptopuri & Calculatoare"):
// pagina lor implicita (fara ?tot=1) arata 0 produse, doar cardurile de subcategorii —
// vizitatorul nu vede nimic de cumparat. Aducem o selectie aleatorie din subcategorii,
// intotdeauna agregat (CATEGORY_FILTER_SQL), indiferent de parametrul includeSub al paginii.
export const getRandomCategoryProducts = unstable_cache(
  async (category: string, limit = 24): Promise<ProductWithDiscount[]> => {
    const { rows } = await pool.query<ProductWithDiscount>(`
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
      LEFT JOIN (SELECT offer_id, median_30d AS median_price FROM offer_price_stats) mp ON mp.offer_id = o.id
      WHERE ${CATEGORY_FILTER_SQL}
        AND o.current_price IS NOT NULL
        AND ${OFFER_AVAILABLE_SQL}
      ORDER BY random()
      LIMIT $2
    `, [category, limit])
    return rows
  },
  ['category-random-products'],
  { revalidate: 3600, tags: ['products'] }
)

export interface SubcategoryInfo {
  slug: string
  name: string
  icon: string | null
  count: number
}

// Subcategoriile vizibile ale unei categorii (dupa slug-ul parintelui), fiecare cu numarul
// de produse in stoc. Folosit pentru navigarea drill-down (carduri pe pagina parinte /
// pastile de "surori" pe pagina unui copil). Doar cele cu produse.
export const getSubcategories = unstable_cache(
  async (parentSlug: string): Promise<SubcategoryInfo[]> => {
    const { rows } = await pool.query<SubcategoryInfo>(`
      SELECT c.slug, c.name, c.icon,
             (SELECT COUNT(DISTINCT p.id)::int
              FROM products p JOIN offers o ON o.product_id = p.id
              WHERE p.category_id = c.id
                AND o.current_price IS NOT NULL AND ${OFFER_AVAILABLE_SQL}) AS count
      FROM categories c
      WHERE c.is_visible = true
        AND c.parent_id = (SELECT id FROM categories WHERE slug = $1)
      ORDER BY c.sort_order, c.id
    `, [parentSlug])
    return rows.filter((r) => r.count > 0)
  },
  ['subcategories'],
  { revalidate: 3600, tags: ['categories', 'products'] }
)

// Pagina de produs: detalii + toate ofertele
export const getProductDetail = unstable_cache(
  async (slug: string): Promise<ProductDetail | null> => {
    const productRes = await pool.query(`
      SELECT p.id::text, p.name, p.slug, p.category, p.brand, p.image_url, p.updated_at::text,
             p.part_no, p.category_id, c.name AS category_name, pc.slug AS parent_slug, pc.name AS parent_name,
             COALESCE((SELECT array_agg(t.slug ORDER BY t.slug) FROM product_tags pt JOIN tags t ON t.id = pt.tag_id
                       WHERE pt.product_id = p.id), '{}') AS tags
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN categories pc ON pc.id = c.parent_id
      WHERE p.slug = $1
    `, [slug])

    if (productRes.rows.length === 0) return null
    const product = productRes.rows[0]

    const offersRes = await pool.query<OfferRow>(`
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
        END AS discount_pct,
        ${OFFER_AVAILABLE_SQL} AS available
      FROM offers o
      JOIN retailers r ON r.id = o.retailer_id
      LEFT JOIN (SELECT offer_id, median_30d AS median_price FROM offer_price_stats) mp ON mp.offer_id = o.id
      WHERE o.product_id = $1
      ORDER BY o.current_price ASC NULLS LAST
    `, [product.id])

    // Ofertele negasite recent in feed-uri / scanari NU se afiseaza: linkul lor nu mai duce
    // nicaieri (decizia 2026-09-26). Le folosim doar pentru alerta si „vazut ultima data”.
    const all = offersRes.rows as (OfferRow & { available: boolean })[]
    const offers = all.filter((o) => o.available)
    const byRecent = [...all].sort((a, b) => (b.last_checked ?? '').localeCompare(a.last_checked ?? ''))
    return {
      ...product,
      offers,
      alert_offer_id: offers[0]?.offer_id ?? byRecent[0]?.offer_id ?? null,
      last_seen: byRecent[0]?.last_checked ?? null,
    }
  },
  ['product-detail-v2'],
  { revalidate: 3600, tags: ['products'] }
)

// Istoricul pretului pentru un produs (ultimele 90 de zile)
export const getPriceHistory = unstable_cache(
  async (productId: string): Promise<PricePoint[]> => {
    const { rows } = await pool.query<PricePoint>(`
      SELECT
        ph.price::float AS price,
        ph.recorded_at::text AS recorded_at,
        o.retailer_id,
        r.name AS retailer_name
      FROM price_history ph
      JOIN offers o ON o.id = ph.offer_id
      JOIN retailers r ON r.id = o.retailer_id
      WHERE o.product_id = $1
        AND ph.recorded_at >= now() - INTERVAL '90 days'
      ORDER BY ph.recorded_at ASC
    `, [productId])
    return rows
  },
  ['price-history'],
  { revalidate: 3600, tags: ['price-history'] }
)

// Prima inregistrare din istoric pentru produs (oricand, nu doar in fereastra de 90 de zile).
// Daca e mai noua de 90 de zile, /p/ nu scrie „90 de zile” (lib/seo/product-facts.ts).
// Ieftin: PK (offer_id, recorded_at) pe fiecare partitie.
export const getHistoryStart = unstable_cache(
  async (productId: string): Promise<string | null> => {
    const { rows } = await pool.query<{ first: string | null }>(`
      SELECT MIN(ph.recorded_at)::text AS first
      FROM price_history ph
      JOIN offers o ON o.id = ph.offer_id
      WHERE o.product_id = $1
    `, [productId])
    return rows[0]?.first ?? null
  },
  ['history-start'],
  { revalidate: 3600, tags: ['price-history'] }
)

// Categoriile vizibile (administrate in /admin), cu numarul de produse (inclusiv subcategorii)
export const getCategories = unstable_cache(
  async (): Promise<CategoryInfo[]> => {
    const { rows } = await pool.query<CategoryInfo>(`
      SELECT c.slug AS category, c.name, c.icon,
             (SELECT count(*)::int FROM products p
              WHERE p.category_id = c.id
                 OR p.category_id IN (SELECT id FROM categories ch WHERE ch.parent_id = c.id)) AS count
      FROM categories c
      WHERE c.is_visible = true AND c.parent_id IS NULL
      ORDER BY c.sort_order, c.id
    `)
    return rows.filter((r) => r.count > 0)
  },
  ['categories'],
  { revalidate: 3600, tags: ['categories', 'products'] }
)

export interface CategoryRecord {
  id: number
  name: string
  slug: string
  parent_id: number | null
  parent_name: string | null
  parent_slug: string | null
  is_visible: boolean        // false = ascunsa din admin → /c/<slug> raspunde 404
}

// Categoria dupa slug, cu parintele ei (pentru titlu + breadcrumbs)
export const getCategoryBySlug = unstable_cache(
  async (slug: string): Promise<CategoryRecord | null> => {
    const { rows } = await pool.query<CategoryRecord>(`
      SELECT c.id, c.name, c.slug, c.parent_id, pc.name AS parent_name, pc.slug AS parent_slug,
             (c.is_visible AND COALESCE(pc.is_visible, true)) AS is_visible
      FROM categories c LEFT JOIN categories pc ON pc.id = c.parent_id
      WHERE c.slug = $1
    `, [slug])
    return rows[0] ?? null
  },
  ['category-by-slug-v2'],
  { revalidate: 3600, tags: ['categories'] }
)

export interface MenuItem {
  id: number
  label: string
  href: string
  icon: string | null       // iconita categoriei (din /admin/categorii); null pt. link-uri custom
  parent_id: number | null
  children?: MenuItem[]
}

// Meniul site-ului, construit in /admin/meniu — arbore recursiv pe pana la 3 niveluri.
export const getMenu = unstable_cache(
  async (): Promise<MenuItem[]> => {
    const { rows } = await pool.query<{ id: number; label: string; category_slug: string | null; url: string | null; icon: string | null; parent_id: number | null }>(`
      SELECT m.id, m.label, c.slug AS category_slug, m.url, c.icon, m.parent_id
      FROM menu_items m LEFT JOIN categories c ON c.id = m.category_id
      WHERE m.is_visible = true
      ORDER BY m.parent_id NULLS FIRST, m.sort_order, m.id
    `)
    const toHref = (r: { category_slug: string | null; url: string | null }) =>
      r.category_slug ? `/c/${r.category_slug}` : (r.url ?? '/')

    // Grupare pe parinte, pastrand ordinea din query (sort_order)
    const byParent = new Map<number | null, typeof rows>()
    for (const r of rows) {
      if (!byParent.has(r.parent_id)) byParent.set(r.parent_id, [])
      byParent.get(r.parent_id)!.push(r)
    }
    const build = (parentId: number | null): MenuItem[] =>
      (byParent.get(parentId) ?? []).map((r) => {
        const children = build(r.id)
        return {
          id: r.id, label: r.label, href: toHref(r), icon: r.icon, parent_id: parentId,
          ...(children.length ? { children } : {}),
        }
      })
    return build(null)
  },
  ['menu'],
  { revalidate: 3600, tags: ['menu'] }
)

export interface Banner {
  id: number
  slot: string                  // 'main' | 'small_left' | 'small_right'
  type: 'image' | 'html'
  title: string | null
  image_url: string | null
  link_url: string | null
  alt: string | null
  html: string | null
}

// Bannerul activ pentru fiecare slot de pe homepage (unul per slot, dupa ordine).
// Gestionate din /admin/bannere. Returneaza o harta slot -> banner.
export const getBanners = unstable_cache(
  async (): Promise<Record<string, Banner>> => {
    const { rows } = await pool.query<Banner>(`
      SELECT DISTINCT ON (slot) id, slot, type, title, image_url, link_url, alt, html
      FROM banners
      WHERE is_active = true
      ORDER BY slot, sort_order, id DESC
    `)
    return Object.fromEntries(rows.map((r) => [r.slot, r]))
  },
  ['banners'],
  { revalidate: 3600, tags: ['banners'] }
)

// Imagine reprezentativa per categorie vizibila (pentru grila de pe homepage):
// produsul cu cele mai multe click-uri recente, altfel cel mai recent actualizat cu imagine
export const getCategoryThumbs = unstable_cache(
  async (): Promise<Record<string, string>> => {
    const { rows } = await pool.query<{ slug: string; image_url: string }>(`
      SELECT DISTINCT ON (c.id) c.slug, p.image_url
      FROM categories c
      JOIN products p ON (p.category_id = c.id
        OR p.category_id IN (SELECT id FROM categories ch WHERE ch.parent_id = c.id))
      JOIN offers o ON o.product_id = p.id AND ${OFFER_AVAILABLE_SQL} AND o.current_price IS NOT NULL
      WHERE c.is_visible = true AND c.parent_id IS NULL AND p.image_url IS NOT NULL
      ORDER BY c.id,
        (SELECT count(*) FROM click_events ce JOIN offers o2 ON o2.id = ce.offer_id
         WHERE o2.product_id = p.id AND ce.clicked_at > now() - interval '30 days') DESC,
        p.updated_at DESC
    `)
    return Object.fromEntries(rows.map((r) => [r.slug, r.image_url]))
  },
  ['category-thumbs'],
  { revalidate: 3600, tags: ['categories', 'products'] }
)

export interface PublicRetailer {
  name: string
  slug: string
  logo_url: string
}

// Retailerii activi cu logo (caruselul de pe homepage)
export const getActiveRetailersPublic = unstable_cache(
  async (): Promise<PublicRetailer[]> => {
    const { rows } = await pool.query<PublicRetailer>(`
      SELECT name, slug, logo_url FROM retailers
      WHERE is_active = true AND logo_url IS NOT NULL
        AND EXISTS (SELECT 1 FROM offers o WHERE o.retailer_id = retailers.id)
      ORDER BY name
    `)
    return rows
  },
  ['public-retailers'],
  { revalidate: 3600, tags: ['products'] }
)

// Produsele unui tag (pagina /t/[slug])
export const getTagBySlug = unstable_cache(
  async (slug: string): Promise<{ id: number; name: string; slug: string } | null> => {
    const { rows } = await pool.query('SELECT id, name, slug FROM tags WHERE slug = $1', [slug])
    return rows[0] ?? null
  },
  ['tag-by-slug'],
  { revalidate: 3600, tags: ['categories'] }
)

// Tag-urile transversale (Refurbished, Second Hand…) pentru meniul mobil — jetoane spre /t/<slug>.
// Tabel mic (câteva rânduri), cache 1 h ca meniul; nu le scriem de mână în componentă.
export const getMenuTags = unstable_cache(
  async (): Promise<{ slug: string; name: string }[]> => {
    const { rows } = await pool.query<{ slug: string; name: string }>(
      'SELECT slug, name FROM tags ORDER BY id'
    )
    return rows
  },
  ['menu-tags'],
  { revalidate: 3600, tags: ['categories', 'menu'] }
)

export const getTagProducts = unstable_cache(
  async (slug: string, page = 1): Promise<ProductWithDiscount[]> => {
    const offset = (page - 1) * PAGE_SIZE
    const { rows } = await pool.query<ProductWithDiscount>(`
      SELECT
        p.id::text, p.name, p.slug, p.category, p.brand, p.image_url,
        o.id::text AS offer_id, o.current_price::float AS current_price,
        o.affiliate_url, o.in_stock,
        r.name AS retailer_name, r.slug AS retailer_slug,
        mp.median_price::float AS median_price,
        CASE
          WHEN mp.median_price IS NOT NULL AND o.current_price < mp.median_price * 0.95
          THEN ROUND(((mp.median_price - o.current_price) / mp.median_price * 100)::numeric, 1)::float
          ELSE NULL
        END AS discount_pct
      FROM products p
      JOIN product_tags pt ON pt.product_id = p.id
      JOIN tags t ON t.id = pt.tag_id AND t.slug = $1
      JOIN offers o ON o.product_id = p.id
      JOIN retailers r ON r.id = o.retailer_id
      LEFT JOIN (SELECT offer_id, median_30d AS median_price FROM offer_price_stats) mp ON mp.offer_id = o.id
      WHERE o.current_price IS NOT NULL AND ${OFFER_AVAILABLE_SQL}
      ORDER BY current_price ASC NULLS LAST
      LIMIT $2 OFFSET $3
    `, [slug, PAGE_SIZE, offset])
    return rows
  },
  ['tag-products'],
  { revalidate: 3600, tags: ['products'] }
)

export const getTagProductCount = unstable_cache(
  async (slug: string): Promise<number> => {
    const { rows } = await pool.query(`
      SELECT count(DISTINCT p.id)::int AS count
      FROM products p
      JOIN product_tags pt ON pt.product_id = p.id
      JOIN tags t ON t.id = pt.tag_id AND t.slug = $1
      JOIN offers o ON o.product_id = p.id
      WHERE o.current_price IS NOT NULL AND ${OFFER_AVAILABLE_SQL}
    `, [slug])
    return rows[0]?.count ?? 0
  },
  ['tag-count'],
  { revalidate: 3600, tags: ['products'] }
)

// Toate produsele pentru sitemap (si generateStaticParams pe /p/).
// `lastmod` = momentul ULTIMEI SCHIMBARI DE PRET (nu products.updated_at, care se atinge la fiecare
// sync si facea ca 97% din sitemap sa fie „modificat azi” — Google ignora un lastmod care minte).
// Per oferta disponibila: prima inregistrare din ultimul sir de preturi egale cu pretul curent,
// cautata doar in ultimele 90 de zile (partitiile vechi nu se citesc; cheia (offer_id, recorded_at)
// face fiecare cautare un index scan scurt). Daca pretul NU s-a schimbat in 90 de zile, data reala
// e mai veche si n-o stim → null (fara <lastmod>; altfel data ar „aluneca” zilnic odata cu
// fereastra), cu exceptia ofertelor noi (create in fereastra) → prima lor inregistrare.
// Ordinea dupa id e stabila, ca impartirea sitemap-ului pe fisiere sa nu se miste.
export const getAllProductSlugs = unstable_cache(
  async (): Promise<Array<{ slug: string; lastmod: string | null }>> => {
    const { rows } = await pool.query(`
      SELECT p.slug, max(lc.changed_at) AS lastmod
      FROM products p
      JOIN offers o ON o.product_id = p.id AND ${OFFER_AVAILABLE_SQL}
      LEFT JOIN LATERAL (
        SELECT max(ph2.recorded_at) AS last_diff
        FROM price_history ph2
        WHERE ph2.offer_id = o.id
          AND ph2.recorded_at >= now() - INTERVAL '90 days'
          AND ph2.price IS DISTINCT FROM o.current_price
      ) d ON true
      LEFT JOIN LATERAL (
        SELECT min(ph.recorded_at) AS changed_at
        FROM price_history ph
        WHERE ph.offer_id = o.id
          AND ph.recorded_at >= now() - INTERVAL '90 days'
          AND ph.recorded_at > COALESCE(d.last_diff, '-infinity'::timestamptz)
          AND (d.last_diff IS NOT NULL OR o.created_at >= now() - INTERVAL '90 days')
      ) lc ON true
      -- doar produsele cu cel putin o oferta disponibila (cele „indisponibile” nu se indexeaza)
      GROUP BY p.id, p.slug
      ORDER BY p.id
    `)
    return rows.map((r) => ({ slug: r.slug as string, lastmod: r.lastmod ? new Date(r.lastmod).toISOString() : null }))
  },
  ['all-slugs-v2'],
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
      WHERE ${OFFER_AVAILABLE_SQL} AND o.current_price IS NOT NULL
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

// Logheaza un termen cautat (pentru raportul "cele mai cautate" din admin).
// Non-blocking: erorile se inghit, nu afecteaza raspunsul cautarii.
export async function logSearch(term: string, resultsCount: number): Promise<void> {
  try {
    await pool.query(
      'INSERT INTO search_queries (term, results_count) VALUES ($1, $2)',
      [maskPII(term).slice(0, 200), resultsCount]
    )
  } catch {
    // Non-critical — tabelul poate sa nu existe inca
  }
}
