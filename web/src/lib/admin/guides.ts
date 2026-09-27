import pool from '../db'
import { OFFER_AVAILABLE_SQL } from '../availability'
import type { FaqItem, GuideAuthor } from '../guides/queries'
import type { ReviewNotes } from '../guides/review'

// Query-uri pentru /admin/ghiduri — fara cache, adminul vede mereu starea reala.

export interface AdminGuideRow {
  id: number
  slug: string
  title: string
  kind: 'produs' | 'categorie'
  status: 'draft' | 'published'
  published_at: string | null
  updated_at: string
  category_slug: string | null
  product_count: number
  generated_by: string | null
}

export async function listGuidesAdmin(): Promise<AdminGuideRow[]> {
  const { rows } = await pool.query<AdminGuideRow>(`
    SELECT g.id, g.slug, g.title, g.kind, g.status,
           g.published_at::text AS published_at, g.updated_at::text AS updated_at, g.category_slug, g.generated_by,
           (SELECT count(*)::int FROM guide_products gp WHERE gp.guide_id = g.id) AS product_count
    FROM guides g
    ORDER BY g.updated_at DESC
  `)
  return rows
}

export interface LinkedProduct {
  id: string
  name: string
  slug: string
}

export interface AdminGuide {
  id: number
  slug: string
  title: string
  meta_description: string | null
  kind: 'produs' | 'categorie'
  body_md: string
  summary: string | null
  faq: FaqItem[]
  author_id: number | null
  reviewer_id: number | null
  status: 'draft' | 'published'
  published_at: string | null
  updated_at: string
  category_slug: string | null
  // Fisa de verificare a ciornelor scrise de AI (migratia 024) — doar in admin, niciodata public
  review_notes: ReviewNotes | null
  generated_by: string | null
  products: LinkedProduct[]
}

export async function getGuideAdmin(id: number): Promise<AdminGuide | null> {
  const { rows } = await pool.query<Omit<AdminGuide, 'products'>>(`
    SELECT id, slug, title, meta_description, kind, body_md, summary, faq, author_id, reviewer_id, status,
           published_at::text AS published_at, updated_at::text AS updated_at, category_slug,
           review_notes, generated_by
    FROM guides WHERE id = $1
  `, [id])
  if (!rows[0]) return null
  const products = await pool.query<LinkedProduct>(`
    SELECT p.id::text, p.name, p.slug
    FROM guide_products gp JOIN products p ON p.id = gp.product_id
    WHERE gp.guide_id = $1 ORDER BY gp.position, p.id
  `, [id])
  return { ...rows[0], products: products.rows }
}

export async function getGuideAuthors(): Promise<GuideAuthor[]> {
  const { rows } = await pool.query<GuideAuthor>(
    'SELECT id, name, slug, kind, bio, url FROM guide_authors ORDER BY id'
  )
  return rows
}

export async function getProductsByIds(ids: string[]): Promise<(LinkedProduct & { category: string })[]> {
  if (!ids.length) return []
  const { rows } = await pool.query<LinkedProduct & { category: string }>(
    'SELECT id::text, name, slug, category FROM products WHERE id = ANY($1::bigint[])',
    [ids]
  )
  return rows
}

// Toate categoriile (parinti si subcategorii) pentru selectorul din editor
export async function getGuideCategoryOptions(): Promise<{ slug: string; label: string }[]> {
  const { rows } = await pool.query<{ slug: string; label: string }>(`
    SELECT c.slug, CASE WHEN p.name IS NOT NULL THEN p.name || ' › ' || c.name ELSE c.name END AS label
    FROM categories c LEFT JOIN categories p ON p.id = c.parent_id
    ORDER BY COALESCE(p.sort_order, c.sort_order), p.id NULLS FIRST, c.sort_order, c.id
  `)
  return rows
}

// Cautare de produse dupa nume, pentru legarea de ghid (ILIKE pe fiecare cuvant).
export async function searchProductsForGuide(q: string, limit = 15): Promise<(LinkedProduct & { offers: number })[]> {
  const words = q.trim().split(/\s+/).filter(Boolean).slice(0, 6)
  if (!words.length) return []
  if (/^\d+$/.test(q.trim())) {
    const { rows } = await pool.query(
      `SELECT p.id::text, p.name, p.slug,
              (SELECT count(*)::int FROM offers o WHERE o.product_id = p.id AND ${OFFER_AVAILABLE_SQL}) AS offers
       FROM products p WHERE p.id = $1`,
      [q.trim()]
    )
    return rows
  }
  const conds = words.map((_, i) => `p.name ILIKE $${i + 1}`).join(' AND ')
  const { rows } = await pool.query(`
    SELECT p.id::text, p.name, p.slug,
           (SELECT count(*)::int FROM offers o WHERE o.product_id = p.id AND ${OFFER_AVAILABLE_SQL}) AS offers
    FROM products p
    WHERE ${conds}
    ORDER BY offers DESC, length(p.name)
    LIMIT ${Number(limit)}
  `, words.map((w) => `%${w.replace(/[%_\\]/g, '\\$&')}%`))
  return rows
}

// „Candidati pentru ghiduri”: produsele cu cele mai multe clickuri reale spre magazine in
// ultimele N zile (ad_clicks — un rand per click prin /go, pastrat si dupa stergerea ofertei),
// cu reducerea curenta si numarul de oferte disponibile.
// Sanatate & Naturale e EXCLUSA (REGULI.md regula 8: fara reclame si fara afirmatii de sanatate).
export interface GuideCandidate {
  id: string
  name: string
  slug: string
  category_name: string | null
  clicks: number
  offers: number
  best_price: number | null
  discount_pct: number | null   // pozitiv = sub mediana 30 de zile (doar cu >= 2 puncte de pret)
  guides: number                // cate ghiduri il leaga deja
}

export async function getGuideCandidates(days = 30, limit = 30): Promise<GuideCandidate[]> {
  const { rows } = await pool.query<GuideCandidate>(`
    WITH clicks AS (
      SELECT product_id, count(*)::int AS clicks
      FROM ad_clicks
      WHERE created_at > now() - make_interval(days => $1) AND product_id IS NOT NULL
      GROUP BY product_id
    ),
    best AS (
      SELECT DISTINCT ON (o.product_id) o.product_id, o.current_price::float AS best_price,
             CASE WHEN s.points_30d >= 2 AND s.median_30d > 0
               THEN ROUND(((s.median_30d - o.current_price) / s.median_30d * 100)::numeric, 1)::float END AS discount_pct
      FROM offers o
      LEFT JOIN offer_price_stats s ON s.offer_id = o.id
      WHERE o.product_id IN (SELECT product_id FROM clicks)
        AND o.current_price IS NOT NULL AND ${OFFER_AVAILABLE_SQL}
      ORDER BY o.product_id, o.current_price ASC
    )
    SELECT p.id::text, p.name, p.slug, c.name AS category_name, cl.clicks,
           (SELECT count(*)::int FROM offers o WHERE o.product_id = p.id AND ${OFFER_AVAILABLE_SQL}) AS offers,
           b.best_price, b.discount_pct,
           (SELECT count(*)::int FROM guide_products gp WHERE gp.product_id = p.id) AS guides
    FROM clicks cl
    JOIN products p ON p.id = cl.product_id
    LEFT JOIN categories c ON c.id = p.category_id
    LEFT JOIN categories par ON par.id = c.parent_id
    LEFT JOIN best b ON b.product_id = p.id
    WHERE COALESCE(par.slug, c.slug, '') <> 'sanatate-naturale'
    ORDER BY cl.clicks DESC, b.discount_pct DESC NULLS LAST
    LIMIT $2
  `, [days, limit])
  return rows
}
