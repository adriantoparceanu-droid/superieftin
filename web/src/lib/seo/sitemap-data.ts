import pool from '../db'
import { getPublishedGuideSlugs } from '../guides/queries'
import { getBlogGuides } from '../guides/blog-queries'
import { getPublicCategories } from './queries'
import { buildPageEntries, indexableThemes, type SitemapEntry } from './sitemap'

// Datele sitemap-ului (rutele app/sitemap.xml si app/sitemaps/[fisier]). Zeci de adrese, query-uri
// mici. .catch: o sursa cazuta nu goleste tot sitemap-ul.

// Autorii cu cel putin un articol publicat (ca autor sau verificator) — ceilalti dau 404 pe
// /autori/<slug> (lib/guides/queries.ts → getAuthorPage)
async function getAuthorSlugs(): Promise<{ slug: string }[]> {
  const { rows } = await pool.query<{ slug: string }>(`
    SELECT a.slug FROM guide_authors a
    WHERE EXISTS (SELECT 1 FROM guides g WHERE g.status = 'published' AND (g.author_id = a.id OR g.reviewer_id = a.id))
    ORDER BY a.slug
  `)
  return rows
}

export async function pageEntries(): Promise<SitemapEntry[]> {
  const [guides, categories, blogGuides, authors] = await Promise.all([
    getPublishedGuideSlugs().catch(() => []),
    getPublicCategories().catch(() => []),
    getBlogGuides().catch(() => []),
    getAuthorSlugs().catch(() => []),
  ])
  return buildPageEntries({ guides, themes: indexableThemes(categories, blogGuides), authors })
}
