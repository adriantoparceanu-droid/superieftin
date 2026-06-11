import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getTagBySlug, getTagProducts, getTagProductCount, PAGE_SIZE } from '@/lib/queries'
import { ProductCard } from '@/components/ProductCard'
import { Pagination } from '@/components/Pagination'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ page?: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const tag = await getTagBySlug(slug)
  const title = `${tag?.name ?? slug} — prețuri și reduceri reale`
  return {
    title,
    description: `Toate produsele ${tag?.name ?? slug}, cu prețuri comparate între magazine.`,
    alternates: { canonical: `/t/${slug}` },
  }
}

export default async function TagPage({ params, searchParams }: Props) {
  const { slug } = await params
  const { page: pageStr } = await searchParams
  const currentPage = Math.max(1, parseInt(pageStr ?? '1') || 1)

  const [tag, products, totalCount] = await Promise.all([
    getTagBySlug(slug),
    getTagProducts(slug, currentPage),
    getTagProductCount(slug),
  ])

  if (!tag) notFound()

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  return (
    <>
      <nav className="text-sm text-muted mb-4 flex gap-1.5 items-center">
        <Link href="/" className="hover:text-[var(--color-text)] transition-colors rounded">Acasă</Link>
        <span>/</span>
        <span className="text-[var(--color-text)]">{tag.name}</span>
      </nav>

      <div className="mb-5">
        <h1 className="text-2xl font-black font-archivo text-[var(--color-text)]">{tag.name}</h1>
        <p className="text-sm text-muted mt-1">
          {totalCount.toLocaleString('ro-RO')} produse
          {totalPages > 1 && ` · pagina ${currentPage} din ${totalPages}`}
        </p>
      </div>

      {products.length > 0 ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {products.map((product) => (
              <ProductCard key={product.offer_id} product={product} />
            ))}
          </div>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            buildUrl={(page) => `/t/${slug}${page > 1 ? `?page=${page}` : ''}`}
          />
        </>
      ) : (
        <div className="text-center py-16 text-muted">
          <p className="text-5xl mb-4">🏷️</p>
          <p>Niciun produs cu acest tag încă.</p>
        </div>
      )}
    </>
  )
}
