import { cache } from 'react'
import pool from '../db'
import { OFFER_AVAILABLE_SQL } from '../availability'
import { isIdRef } from './markers'

// Interogarile publice pentru ghiduri.
//
// De ce fara unstable_cache: paginile de ghid sunt deja cache-uite ca pagini intregi (ISR) si
// invalidate explicit din admin cu revalidatePath la salvare / publicare. Un al doilea strat de
// cache (unstable_cache) ar putea servi textul vechi dupa publicare (vezi „Cache gotcha” in
// CLAUDE.md). React cache() doar evita interogarea dubla in aceeasi randare (metadata + pagina).

export interface GuideAuthor {
  id: number
  name: string
  slug: string
  kind: 'organization' | 'person'
  bio: string | null
  url: string | null
}

export interface FaqItem {
  q: string
  a: string
}

export interface Guide {
  id: number
  slug: string
  title: string
  meta_description: string | null
  kind: 'produs' | 'categorie'
  body_md: string
  summary: string | null
  faq: FaqItem[]
  status: 'draft' | 'published'
  published_at: string | null
  updated_at: string
  category_slug: string | null
  category_name: string | null
  author: GuideAuthor | null
  reviewer: GuideAuthor | null
}

export interface GuideListItem {
  slug: string
  title: string
  meta_description: string | null
  summary: string | null
  kind: 'produs' | 'categorie'
  published_at: string | null
  updated_at: string
  category_slug: string | null
  category_name: string | null
}

const GUIDE_SELECT = `
  SELECT g.id, g.slug, g.title, g.meta_description, g.kind, g.body_md, g.summary, g.faq, g.status,
         g.published_at::text AS published_at, g.updated_at::text AS updated_at,
         g.category_slug, c.name AS category_name,
         CASE WHEN a.id IS NULL THEN NULL ELSE json_build_object(
           'id', a.id, 'name', a.name, 'slug', a.slug, 'kind', a.kind, 'bio', a.bio, 'url', a.url) END AS author,
         CASE WHEN rv.id IS NULL THEN NULL ELSE json_build_object(
           'id', rv.id, 'name', rv.name, 'slug', rv.slug, 'kind', rv.kind, 'bio', rv.bio, 'url', rv.url) END AS reviewer
  FROM guides g
  LEFT JOIN categories c ON c.slug = g.category_slug
  LEFT JOIN guide_authors a ON a.id = g.author_id
  LEFT JOIN guide_authors rv ON rv.id = g.reviewer_id`

// Ghid PUBLICAT dupa slug. Ciornele intorc null → pagina da 404 (nu sunt publice).
export const getPublishedGuide = cache(async (slug: string): Promise<Guide | null> => {
  const { rows } = await pool.query<Guide>(
    `${GUIDE_SELECT} WHERE g.slug = $1 AND g.status = 'published'`,
    [slug]
  )
  return rows[0] ?? null
})

// Lista publica, cele mai noi primele. Filtrul de categorie include subcategoriile
// (un ghid pe „telefoane-mobile” apare si la „telefoane-accesorii”).
export async function listPublishedGuides(categorySlug?: string | null, limit = 60): Promise<GuideListItem[]> {
  const { rows } = await pool.query<GuideListItem>(`
    SELECT g.slug, g.title, g.meta_description, g.summary, g.kind,
           g.published_at::text AS published_at, g.updated_at::text AS updated_at,
           g.category_slug, c.name AS category_name
    FROM guides g
    LEFT JOIN categories c ON c.slug = g.category_slug
    WHERE g.status = 'published'
      AND ($1::text IS NULL OR g.category_slug = $1 OR g.category_slug IN (
        SELECT ch.slug FROM categories ch WHERE ch.parent_id = (SELECT id FROM categories WHERE slug = $1)))
    ORDER BY g.published_at DESC NULLS LAST, g.id DESC
    LIMIT $2
  `, [categorySlug || null, limit])
  return rows
}

// Categoriile care au cel putin un ghid publicat (pentru filtrul de pe /ghiduri), grupate pe
// categoria-parinte: filtrul arata doar cele 3–4 categorii mari, nu zeci de subcategorii.
export async function getGuideCategories(): Promise<{ slug: string; name: string; count: number }[]> {
  const { rows } = await pool.query<{ slug: string; name: string; count: number }>(`
    SELECT COALESCE(par.slug, c.slug) AS slug, COALESCE(par.name, c.name) AS name, count(*)::int AS count
    FROM guides g
    JOIN categories c ON c.slug = g.category_slug
    LEFT JOIN categories par ON par.id = c.parent_id
    WHERE g.status = 'published'
    GROUP BY 1, 2
    ORDER BY count DESC, name
  `)
  return rows
}

// Pentru sitemap si llms.txt. Tabela poate lipsi daca web-ul ajunge pe server inaintea
// migratiei 023 → apelantii prind eroarea si merg mai departe fara ghiduri.
export async function getPublishedGuideSlugs(): Promise<{ slug: string; title: string; updated_at: string; meta_description: string | null }[]> {
  const { rows } = await pool.query(`
    SELECT slug, title, meta_description, updated_at::text AS updated_at
    FROM guides WHERE status = 'published'
    ORDER BY published_at DESC NULLS LAST
  `)
  return rows
}

// Sectiunea „Ghiduri despre acest produs” de pe /p/[slug]
export async function getGuidesForProduct(productId: string): Promise<{ slug: string; title: string }[]> {
  try {
    const { rows } = await pool.query<{ slug: string; title: string }>(`
      SELECT g.slug, g.title
      FROM guide_products gp JOIN guides g ON g.id = gp.guide_id
      WHERE gp.product_id = $1 AND g.status = 'published'
      ORDER BY g.published_at DESC NULLS LAST
      LIMIT 5
    `, [productId])
    return rows
  } catch {
    // Tabela lipseste (migratia 023 inca nerulata) — pagina de produs nu trebuie sa cada
    return []
  }
}

// ---------- Date live pentru blocurile din Markdown ----------

export interface LiveOffer {
  offer_id: string
  current_price: number
  retailer_name: string
  last_checked: string | null
  median_price: number | null   // mediana 30 de zile (offer_price_stats), doar cu >= 2 puncte
}

export interface LiveProduct {
  id: string
  name: string
  slug: string
  category: string
  brand: string | null
  image_url: string | null
  offers: LiveOffer[]           // DOAR ofertele disponibile (OFFER_AVAILABLE_SQL), cele mai ieftine primele
}

// Incarca produsele cerute de marcaje (id sau slug) cu ofertele disponibile acum.
// Mediana vine din offer_price_stats (precalculata de worker), NU din PERCENTILE_CONT pe istoric.
// Intoarce un Map ref → produs; un ref care lipseste din Map = produs sters/inexistent.
export const loadLiveProducts = cache(async (refsKey: string): Promise<Map<string, LiveProduct>> => {
  const refs = refsKey ? refsKey.split('\n') : []
  const result = new Map<string, LiveProduct>()
  if (!refs.length) return result
  const ids = refs.filter(isIdRef)
  const slugs = refs.filter((r) => !isIdRef(r))

  const { rows } = await pool.query<{
    id: string; name: string; slug: string; category: string; brand: string | null; image_url: string | null
    offer_id: string | null; current_price: number | null; retailer_name: string | null
    last_checked: string | null; median_price: number | null
  }>(`
    SELECT p.id::text, p.name, p.slug, p.category, p.brand, p.image_url,
           o.id::text AS offer_id, o.current_price::float AS current_price, r.name AS retailer_name,
           o.last_checked::text AS last_checked,
           CASE WHEN s.points_30d >= 2 THEN s.median_30d::float END AS median_price
    FROM products p
    LEFT JOIN offers o ON o.product_id = p.id AND o.current_price IS NOT NULL AND ${OFFER_AVAILABLE_SQL}
    LEFT JOIN retailers r ON r.id = o.retailer_id
    LEFT JOIN offer_price_stats s ON s.offer_id = o.id
    WHERE p.id = ANY($1::bigint[]) OR p.slug = ANY($2::text[])
    -- ordinea ofertelor = ca pe pagina de produs: pretul cel mai mic primul (nu comisionul)
    ORDER BY p.id, o.current_price ASC NULLS LAST
  `, [ids, slugs])

  const byId = new Map<string, LiveProduct>()
  for (const r of rows) {
    let p = byId.get(r.id)
    if (!p) {
      p = { id: r.id, name: r.name, slug: r.slug, category: r.category, brand: r.brand, image_url: r.image_url, offers: [] }
      byId.set(r.id, p)
    }
    if (r.offer_id && r.current_price != null) {
      p.offers.push({
        offer_id: r.offer_id,
        current_price: r.current_price,
        retailer_name: r.retailer_name ?? '',
        last_checked: r.last_checked,
        median_price: r.median_price,
      })
    }
  }
  for (const p of byId.values()) {
    result.set(p.id, p)
    result.set(p.slug, p)
  }
  return result
})

// Cheie stabila pentru cache() (React compara argumentele prin identitate → string, nu array)
export function refsKey(refs: string[]): string {
  return [...new Set(refs)].sort().join('\n')
}

// Produsele legate explicit de ghid (guide_products), in ordinea din admin
export async function getGuideProductIds(guideId: number): Promise<string[]> {
  const { rows } = await pool.query<{ product_id: string }>(
    'SELECT product_id::text FROM guide_products WHERE guide_id = $1 ORDER BY position, product_id',
    [guideId]
  )
  return rows.map((r) => r.product_id)
}
