import { unstable_cache } from 'next/cache'
import pool from './db'
import { maskPII } from './pii'
import { OFFER_AVAILABLE_SQL } from './availability'

// Query-urile publice ramase dupa trecerea in blog (20.11.2026): meniul, clickurile /go/,
// jurnalul cautarilor si fisa interna de produs din admin (/admin/cercetare/[slug]).

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
  category_slug: string | null    // slug-ul categoriei mapate
  category_visible: boolean | null
  parent_visible: boolean | null  // null = categoria nu are parinte
  tags: string[]                  // slug-urile tag-urilor (refurbished, second-hand → itemCondition)
  canonical_product_id: string | null  // principala grupului de variante (migratia 035, scris de worker); null = pagina proprie
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
  // Minimul / maximul pe 30 de zile ale ofertei (offer_price_stats, migratia 032) — termometrul
  // din fisa interna de produs. Completate doar de getProductDetail; NULL pana la prima recalculare.
  min_30d?: number | null
  max_30d?: number | null
  // Schimbarile de pret pe 60 de zile (offer_price_stats, migratia 035) — conditia „are poveste”
  // (fișa internă /admin/cercetare/[slug]). Completat doar de getProductDetail.
  price_changes_60d?: number
}

export interface PricePoint {
  price: number
  recorded_at: string
  retailer_id: number
  retailer_name: string
  offer_id: string   // seria „cel mai mic pret pe zi” foloseste doar ofertele disponibile azi
}

// Fisa interna de produs (/admin/cercetare/[slug]): detalii + toate ofertele
export const getProductDetail = unstable_cache(
  async (slug: string): Promise<ProductDetail | null> => {
    const productRes = await pool.query(`
      SELECT p.id::text, p.name, p.slug, p.category, p.brand, p.image_url, p.updated_at::text,
             p.part_no, p.category_id, p.canonical_product_id::text, c.name AS category_name, pc.slug AS parent_slug, pc.name AS parent_name,
             c.slug AS category_slug, c.is_visible AS category_visible, pc.is_visible AS parent_visible,
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
        mp.min_30d::float AS min_30d,
        mp.max_30d::float AS max_30d,
        COALESCE(mp.price_changes_60d, 0)::int AS price_changes_60d,
        CASE
          WHEN mp.median_price IS NOT NULL AND o.current_price < mp.median_price * 0.95
          THEN ROUND(((mp.median_price - o.current_price) / mp.median_price * 100)::numeric, 1)::float
          ELSE NULL
        END AS discount_pct,
        ${OFFER_AVAILABLE_SQL} AS available
      FROM offers o
      JOIN retailers r ON r.id = o.retailer_id
      LEFT JOIN (SELECT offer_id, median_30d AS median_price, min_30d, max_30d, price_changes_60d FROM offer_price_stats) mp ON mp.offer_id = o.id
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
  ['product-detail-v5'],
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
        r.name AS retailer_name,
        o.id::text AS offer_id
      FROM price_history ph
      JOIN offers o ON o.id = ph.offer_id
      JOIN retailers r ON r.id = o.retailer_id
      WHERE o.product_id = $1
        AND ph.recorded_at >= now() - INTERVAL '90 days'
      ORDER BY ph.recorded_at ASC
    `, [productId])
    return rows
  },
  ['price-history-v2'],
  { revalidate: 3600, tags: ['price-history'] }
)

// Prima inregistrare din istoric pentru produs (oricand, nu doar in fereastra de 90 de zile).
// Daca e mai noua de 90 de zile, fisa nu scrie „90 de zile” (lib/seo/product-facts.ts).
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
