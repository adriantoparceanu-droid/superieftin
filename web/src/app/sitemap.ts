import type { MetadataRoute } from 'next'
import { getAllProductSlugs, getCategories } from '@/lib/queries'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.superieftin.ro'

// Generat la runtime, nu la build: la build hostul `postgres` nu se rezolvă,
// iar query-urile ar da eroare → sitemap gol. Datele sunt deja cache-uite 24h
// prin unstable_cache în queries.ts, deci nu lovim DB la fiecare request.
export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [slugs, categories] = await Promise.all([
    getAllProductSlugs().catch(() => [] as { slug: string; updated_at: string | null }[]),
    getCategories().catch(() => [] as { category: string }[]),
  ])

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 1,
    },
  ]

  const categoryRoutes: MetadataRoute.Sitemap = categories.map(({ category }) => ({
    url: `${SITE_URL}/c/${category}`,
    lastModified: new Date(),
    changeFrequency: 'hourly' as const,
    priority: 0.8,
  }))

  const productRoutes: MetadataRoute.Sitemap = slugs.map(({ slug, updated_at }) => ({
    url: `${SITE_URL}/p/${slug}`,
    lastModified: updated_at ? new Date(updated_at) : new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.6,
  }))

  return [...staticRoutes, ...categoryRoutes, ...productRoutes]
}
