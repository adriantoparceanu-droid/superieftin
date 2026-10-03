import { parseSitemapFile, productSitemapCount, productSlice, urlsetXml } from '@/lib/seo/sitemap'
import { pageEntries, productEntries } from '@/lib/seo/sitemap-data'

// Fisierele listate de /sitemap.xml (index): pagini.xml + produse-1.xml, produse-2.xml…
// Un fisier care nu exista (ex. produse-9.xml cand avem doar 3) → 404.
export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ fisier: string }> }) {
  const file = parseSitemapFile((await params).fisier)
  if (!file) return new Response('Not found', { status: 404 })

  let entries
  if (file.kind === 'pages') {
    entries = await pageEntries()
  } else {
    const products = await productEntries()
    if (file.index > productSitemapCount(products.length)) return new Response('Not found', { status: 404 })
    entries = productSlice(products, file.index)
  }
  return new Response(urlsetXml(entries), {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  })
}
