import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import pool from '../db'
import { searchWords, UNACCENT_FROM, UNACCENT_TO, type BlogGuide } from './blog'

// Query-urile paginilor de blog (homepage, teme /c/, cautare, /ghiduri). Logica de alegere e pura,
// in lib/guides/blog.ts. Fara unstable_cache pe articole: dupa publicare din admin, lista trebuie
// sa fie imediat la zi (vezi „Cache gotcha” in CLAUDE.md); query-ul e mic (zeci de articole).

// Toate articolele PUBLICATE, cu categoriile produselor legate (guide_products → products) si
// poza primului produs legat (imaginea cardului; fara poza → imaginea OG a articolului).
export const getBlogGuides = cache(async (): Promise<BlogGuide[]> => {
  const { rows } = await pool.query<BlogGuide>(`
    SELECT g.slug, g.title, g.meta_description,
           g.published_at::text AS published_at, g.updated_at::text AS updated_at,
           g.category_slug,
           COALESCE((SELECT array_agg(DISTINCT p.category_id) FROM guide_products gp
                     JOIN products p ON p.id = gp.product_id
                     WHERE gp.guide_id = g.id AND p.category_id IS NOT NULL), '{}') AS category_ids,
           (SELECT p.image_url FROM guide_products gp JOIN products p ON p.id = gp.product_id
             WHERE gp.guide_id = g.id AND p.image_url IS NOT NULL AND p.image_url <> ''
             ORDER BY gp.position, gp.product_id LIMIT 1) AS image_url,
           COALESCE(array_length(regexp_split_to_array(btrim(g.body_md), '\\s+'), 1), 0)::int AS words,
           a.name AS author_name
    FROM guides g
    LEFT JOIN guide_authors a ON a.id = g.author_id
    WHERE g.status = 'published'
  `)
  return rows
})

// Vizualizarile paginilor /ghiduri/<slug> pe ultimele 30 de zile (GA4, sincronizate zilnic de
// worker in ga4_daily_breakdown, kind = 'page'). Cache 1 h: datele se schimba o data pe zi.
// Tabela lipsa / GA4 neconfigurat → lista goala („Cele mai citite” = cele mai noi).
export const getGuidePageViews = unstable_cache(
  async (): Promise<{ path: string; views: number }[]> => {
    try {
      const { rows } = await pool.query<{ path: string; views: number }>(`
        SELECT key AS path, sum(page_views)::int AS views
        FROM ga4_daily_breakdown
        WHERE kind = 'page' AND key LIKE '/ghiduri/%' AND day >= current_date - 30
        GROUP BY key
      `)
      return rows
    } catch {
      return []
    }
  },
  ['guide-page-views-30d'],
  { revalidate: 3600 },
)

export interface ThemeCategory {
  id: number
  slug: string
  name: string
  parent_slug: string | null
  parent_name: string | null
  childIds: number[]
  childSlugs: string[]
  childNames: string[]
}

// Tema (categoria) + subcategoriile ei vizibile. null = inexistenta sau ascunsa (ea ori parintele).
export const getThemeCategory = cache(async (slug: string): Promise<ThemeCategory | null> => {
  const { rows } = await pool.query<ThemeCategory>(`
    SELECT c.id, c.slug, c.name, pc.slug AS parent_slug, pc.name AS parent_name,
           COALESCE((SELECT array_agg(ch.id ORDER BY ch.sort_order, ch.id) FROM categories ch WHERE ch.parent_id = c.id AND ch.is_visible), '{}') AS "childIds",
           COALESCE((SELECT array_agg(ch.slug ORDER BY ch.sort_order, ch.id) FROM categories ch WHERE ch.parent_id = c.id AND ch.is_visible), '{}') AS "childSlugs",
           COALESCE((SELECT array_agg(ch.name ORDER BY ch.sort_order, ch.id) FROM categories ch WHERE ch.parent_id = c.id AND ch.is_visible), '{}') AS "childNames"
    FROM categories c LEFT JOIN categories pc ON pc.id = c.parent_id
    WHERE c.slug = $1 AND c.is_visible AND COALESCE(pc.is_visible, true)
  `, [slug])
  return rows[0] ?? null
})

// Cautarea in articolele publicate: fiecare cuvant trebuie sa apara (oriunde) in titlu, rezumat,
// meta description sau corp — fara diacritice si fara diferente de majuscule. Potrivirile din
// titlu primele, apoi cele mai recent actualizate. Intoarce slug-urile, in ordine.
export async function searchGuideSlugs(q: string, limit = 50): Promise<string[]> {
  const words = searchWords(q)
  if (!words.length) return []
  const norm = (expr: string) => `translate(lower(${expr}), '${UNACCENT_FROM}', '${UNACCENT_TO}')`
  const hay = norm(`g.title || ' ' || COALESCE(g.summary, '') || ' ' || COALESCE(g.meta_description, '') || ' ' || g.body_md`)
  const conds = words.map((_, i) => `${hay} LIKE '%' || $${i + 1} || '%'`).join(' AND ')
  const inTitle = words.map((_, i) => `(${norm('g.title')} LIKE '%' || $${i + 1} || '%')::int`).join(' + ')
  const { rows } = await pool.query<{ slug: string }>(`
    SELECT g.slug FROM guides g
    WHERE g.status = 'published' AND ${conds}
    ORDER BY ${inTitle} DESC, g.updated_at DESC
    LIMIT ${Number(limit) | 0}
  `, words)
  return rows.map((r) => r.slug)
}
