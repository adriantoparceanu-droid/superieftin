import { isSitemapFile, urlsetXml } from '@/lib/seo/sitemap'
import { pageEntries } from '@/lib/seo/sitemap-data'

// Fisierele listate de /sitemap.xml (index): doar pagini.xml. Orice alt nume (inclusiv vechile
// produse-N.xml) → 404: Google renunta singur la un sitemap care nu mai exista.
export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ fisier: string }> }) {
  if (!isSitemapFile((await params).fisier)) return new Response('Not found', { status: 404 })
  return new Response(urlsetXml(await pageEntries()), {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  })
}
