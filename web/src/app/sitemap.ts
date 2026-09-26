import type { MetadataRoute } from 'next'
import { getAllProductSlugs, getCategories, getSubcategories } from '@/lib/queries'
import { getPublishedGuideSlugs } from '@/lib/guides/queries'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.superieftin.ro'

// Generat la runtime, nu la build: la build hostul `postgres` nu se rezolvă,
// iar query-urile ar da eroare → sitemap gol. Datele sunt deja cache-uite 24h
// prin unstable_cache în queries.ts, deci nu lovim DB la fiecare request.
export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [slugs, categories, guides] = await Promise.all([
    getAllProductSlugs().catch(() => [] as { slug: string; updated_at: string | null }[]),
    getCategories().catch(() => [] as { category: string }[]),
    // .catch: tabela guides poate lipsi daca web-ul ajunge pe server inaintea migratiei 023
    getPublishedGuideSlugs().catch(() => [] as { slug: string; updated_at: string }[]),
  ])

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 1,
    },
    // Paginile de încredere (Despre, Contact, politici) — cerute de Google pentru site-urile de afiliere
    ...['despre', 'contact', 'confidentialitate', 'termeni', 'cookies', 'ghiduri/metodologie'].map((path) => ({
      url: `${SITE_URL}/${path}`,
      changeFrequency: 'monthly' as const,
      priority: 0.3,
    })),
  ]

  // Ghidurile publicate (ciornele nu apar), lastmod = ultima actualizare a textului
  const guideRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/ghiduri`, changeFrequency: 'weekly' as const, priority: 0.6,
      ...(guides[0] ? { lastModified: new Date(Math.max(...guides.map((g) => new Date(g.updated_at).getTime()))) } : {}) },
    ...guides.map((g) => ({
      url: `${SITE_URL}/ghiduri/${g.slug}`,
      lastModified: new Date(g.updated_at),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
  ]

  const categoryRoutes: MetadataRoute.Sitemap = categories.map(({ category }) => ({
    url: `${SITE_URL}/c/${category}`,
    lastModified: new Date(),
    changeFrequency: 'hourly' as const,
    priority: 0.8,
  }))

  // Landing pages pentru reclame (/reduceri-reale/…), pe categoriile-parinte + subcategorii.
  // Excluse: Sanatate & Naturale (fara reclame — vezi reduceri-reale/[categorie]/page.tsx).
  const landingSlugs = (await Promise.all(
    categories
      .filter(({ category }) => category !== 'sanatate-naturale')
      .map(async ({ category }) => [category, ...(await getSubcategories(category).catch(() => [])).map((s) => s.slug)])
  )).flat()
  const landingRoutes: MetadataRoute.Sitemap = landingSlugs.map((slug) => ({
    url: `${SITE_URL}/reduceri-reale/${slug}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.7,
  }))

  const productRoutes: MetadataRoute.Sitemap = slugs.map(({ slug, updated_at }) => ({
    url: `${SITE_URL}/p/${slug}`,
    lastModified: updated_at ? new Date(updated_at) : new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.6,
  }))

  return [...staticRoutes, ...guideRoutes, ...categoryRoutes, ...landingRoutes, ...productRoutes]
}
