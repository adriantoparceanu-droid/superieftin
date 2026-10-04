import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTagBySlug, getTagProducts, getTagProductCount, PAGE_SIZE } from '@/lib/queries'
import { ProductList } from '@/components/listing/ProductList'
import { EmptyState, ListingHeader, MethodNote } from '@/components/listing/ListingParts'
import { Pagination } from '@/components/Pagination'
import { listingDescription, listingSeo, parsePageParam } from '@/lib/seo/listing'
import { withOg } from '@/lib/seo/og'
import { absUrl, roCount } from '@/lib/seo/site'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ page?: string }>
}

// Ca la /c/: cifre live, canonical propriu pe ?page=N, noindex cand nu e niciun produs
// disponibil, ?page= peste ultima pagina → 404 (lib/seo/listing.ts)
export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params
  const page = parsePageParam((await searchParams).page)
  const [tag, totalCount] = await Promise.all([getTagBySlug(slug), getTagProductCount(slug)])
  if (!tag) return {}
  const seo = listingSeo({
    basePath: `/t/${slug}`, page, totalPages: Math.ceil(totalCount / PAGE_SIZE),
    hasReorder: false, brand: null, empty: totalCount === 0,
  })
  if (seo.notFound) return {}
  const title = `${tag.name} — prețuri, istoric și reduceri reale${seo.titleSuffix}`
  const description = listingDescription(`Produse ${tag.name}`, { products: totalCount, retailers: 0, brands: 0, minPrice: null })
  return {
    title,
    description,
    alternates: { canonical: seo.canonical },
    ...(seo.robots ? { robots: seo.robots } : {}),
    openGraph: withOg({ title, description, url: absUrl(seo.canonical) }),
  }
}

export default async function TagPage({ params, searchParams }: Props) {
  const { slug } = await params
  const { page: pageStr } = await searchParams
  const currentPage = parsePageParam(pageStr)

  const [tag, products, totalCount] = await Promise.all([
    getTagBySlug(slug),
    getTagProducts(slug, currentPage),
    getTagProductCount(slug),
  ])

  if (!tag) notFound()

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)
  // ?page= peste ultima pagina → 404 adevarat (nu lista goala cu 200)
  if (currentPage > 1 && currentPage > totalPages) notFound()

  return (
    <>
      <ListingHeader crumbs={[{ label: 'Acasă', href: '/' }, { label: tag.name }]} title={tag.name}>
        <p className="tabular-nums">
          {roCount(totalCount, 'produse', 'produs')}
          {totalPages > 1 && ` · pagina ${currentPage} din ${totalPages}`}
        </p>
      </ListingHeader>

      {products.length > 0 ? (
        <>
          <MethodNote className="mb-3" />
          <h2 className="sr-only">Produse</h2>
          <ProductList products={products} />
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            buildUrl={(page) => `/t/${slug}${page > 1 ? `?page=${page}` : ''}`}
          />
        </>
      ) : (
        <EmptyState title="Niciun produs cu acest tag încă." />
      )}
    </>
  )
}
