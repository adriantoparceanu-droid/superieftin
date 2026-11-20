import { getPublishedGuideSlugs } from '../guides/queries'
import { getBlogGuides } from '../guides/blog-queries'
import { getPublicCategories } from './queries'
import { indexableThemes } from './sitemap'
import type { LlmsData } from './llms'

// Datele comune pentru /llms.txt si /llms-full.txt. .catch: o sursa cazuta nu strica tot fisierul.
export async function loadLlmsData(): Promise<LlmsData> {
  const [guides, categories, blogGuides] = await Promise.all([
    getPublishedGuideSlugs().catch(() => []),
    getPublicCategories().catch(() => []),
    getBlogGuides().catch(() => []),
  ])
  // Aceleasi teme ca in sitemap (doar cele cu articole / cu pagina proprie)
  return { guides, themes: indexableThemes(categories, blogGuides).map((c) => ({ slug: c.slug, name: c.name })) }
}
