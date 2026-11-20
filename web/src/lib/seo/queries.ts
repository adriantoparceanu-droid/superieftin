import { unstable_cache } from 'next/cache'
import pool from '../db'

// Query-uri pentru SEO (sitemap, llms.txt). Dupa trecerea in blog (20.11.2026) a ramas doar lista
// categoriilor publice — cifrele pe oferte (landing-uri, /t/, variante, similare) au plecat odata
// cu paginile /p/, /t/ si /reduceri-reale.

export interface PublicCategory { id: number; slug: string; name: string; parent_id: number | null }

// Categoriile publice (vizibile, cu parintele vizibil), in ordinea din meniu — sursa temelor din
// sitemap si llms.txt. Care dintre ele sunt teme indexabile decide indexableThemes (lib/seo/sitemap.ts),
// cu aceeasi regula ca pagina /c/ (lib/guides/blog.ts).
export const getPublicCategories = unstable_cache(
  async (): Promise<PublicCategory[]> => {
    const { rows } = await pool.query<PublicCategory>(`
      SELECT c.id, c.slug, c.name, c.parent_id
      FROM categories c LEFT JOIN categories pc ON pc.id = c.parent_id
      WHERE c.is_visible AND COALESCE(pc.is_visible, true)
      ORDER BY COALESCE(pc.sort_order, c.sort_order), COALESCE(pc.id, c.id), c.parent_id NULLS FIRST, c.sort_order, c.id
    `)
    return rows
  },
  ['seo-public-categories'],
  { revalidate: 3600, tags: ['categories'] }
)
