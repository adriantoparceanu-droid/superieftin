import { SITEMAP_FILES, latestLastmod, sitemapIndexXml } from '@/lib/seo/sitemap'
import { pageEntries } from '@/lib/seo/sitemap-data'

// /sitemap.xml = SITEMAP INDEX. Acelasi URL ca vechiul sitemap, deci Search Console / robots.txt
// nu se schimba. Un singur fisier: /sitemaps/pagini.xml (app/sitemaps/[fisier]/route.ts). Vechile
// /sitemaps/produse-N.xml au disparut odata cu paginile /p/ (blog de recomandari, 20 nov. 2026).
//
// Generat la runtime, nu la build: la build hostul `postgres` nu se rezolva.
export const dynamic = 'force-dynamic'

export async function GET() {
  const pages = await pageEntries()
  const xml = sitemapIndexXml(SITEMAP_FILES.map((f) => ({ path: `/sitemaps/${f}`, lastmod: latestLastmod(pages) })))
  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  })
}
