import { latestLastmod, productSlice, sitemapFileNames, sitemapIndexXml } from '@/lib/seo/sitemap'
import { pageEntries, productEntries } from '@/lib/seo/sitemap-data'

// /sitemap.xml = SITEMAP INDEX (raport SEO 2026-10-04, A7). Acelasi URL ca vechiul sitemap unic,
// deci Search Console / robots.txt nu se schimba. Fisierele: /sitemaps/pagini.xml si
// /sitemaps/produse-N.xml (app/sitemaps/[fisier]/route.ts), cate 10.000 de produse.
//
// Generat la runtime, nu la build: la build hostul `postgres` nu se rezolva. Datele sunt deja in
// unstable_cache (lib/queries.ts, lib/seo/queries.ts), deci nu lovim DB-ul la fiecare cerere.
export const dynamic = 'force-dynamic'

export async function GET() {
  const [pages, products] = await Promise.all([pageEntries(), productEntries()])
  const files = sitemapFileNames(products.length)
  const xml = sitemapIndexXml(files.map((f, i) => ({
    path: `/sitemaps/${f}`,
    lastmod: i === 0 ? latestLastmod(pages) : latestLastmod(productSlice(products, i)),
  })))
  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  })
}
