import type { Metadata } from 'next'
import Link from 'next/link'
import { searchProducts, searchProductCount, PAGE_SIZE } from '@/lib/queries'
import { TrackSearch } from '@/components/analytics/TrackSearch'
import { ProductCard } from '@/components/ProductCard'
import { Pagination } from '@/components/Pagination'

export const dynamic = 'force-dynamic'

type Props = {
  searchParams: Promise<{ q?: string; page?: string }>
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { q } = await searchParams
  const query = q?.trim() ?? ''
  return {
    title: query ? `"${query}" — căutare prețuri` : 'Căutare — superieftin.ro',
    description: query
      ? `Rezultate pentru "${query}" — comparare prețuri și reduceri reale.`
      : 'Caută produse și compară prețuri pe superieftin.ro.',
    robots: { index: false, follow: false },
  }
}

export default async function SearchPage({ searchParams }: Props) {
  const { q, page: pageStr } = await searchParams
  const query = q?.trim() ?? ''
  const currentPage = Math.max(1, parseInt(pageStr ?? '1') || 1)

  const [products, totalCount] = query
    ? await Promise.all([
        searchProducts(query, currentPage),
        searchProductCount(query),
      ])
    : [[], 0]

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  function buildUrl(page: number) {
    const params = new URLSearchParams({ q: query })
    if (page > 1) params.set('page', String(page))
    return `/cautare?${params.toString()}`
  }

  return (
    <div>
      {query && <TrackSearch term={query} />}
      {/* Search bar */}
      <form action="/cautare" method="get" className="flex gap-2 mb-6 max-w-xl">
        <input
          name="q"
          type="search"
          defaultValue={query}
          placeholder="Caută produs, brand sau categorie..."
          autoFocus
          autoComplete="off"
          className="flex-1 px-4 py-2.5 rounded-lg border border-line bg-surface text-[var(--color-text)] text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2"
        />
        <button
          type="submit"
          className="px-5 py-2.5 bg-brand hover:bg-brand-dark text-white text-sm font-semibold rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        >
          Caută
        </button>
      </form>

      {/* Stare: fără query */}
      {!query && (
        <div className="text-center py-16 text-muted">
          <p className="text-5xl mb-4">🔍</p>
          <p className="text-base">Scrie un produs sau o marcă pentru a căuta.</p>
          <p className="text-sm mt-2">Exemplu: <em>Samsung Galaxy</em>, <em>iPhone 15</em>, <em>Xiaomi</em></p>
        </div>
      )}

      {/* Stare: query fără rezultate */}
      {query && products.length === 0 && (
        <div className="text-center py-16 text-muted">
          <p className="text-5xl mb-4">😔</p>
          <p className="text-base">Niciun rezultat pentru <strong className="text-[var(--color-text)]">&ldquo;{query}&rdquo;</strong>.</p>
          <p className="text-sm mt-2">Încearcă cu mai puține cuvinte sau verifică ortografia.</p>
          <Link href="/" className="mt-4 inline-block text-sm text-brand hover:underline">
            ← Înapoi la pagina principală
          </Link>
        </div>
      )}

      {/* Rezultate */}
      {query && products.length > 0 && (
        <>
          <p className="text-sm text-muted mb-4">
            {totalCount.toLocaleString('ro-RO')} rezultate pentru{' '}
            <strong className="text-[var(--color-text)]">&ldquo;{query}&rdquo;</strong>
            {totalPages > 1 && ` · pagina ${currentPage} din ${totalPages}`}
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {products.map(product => (
              <ProductCard key={product.offer_id} product={product} />
            ))}
          </div>

          <Pagination currentPage={currentPage} totalPages={totalPages} buildUrl={buildUrl} />
        </>
      )}
    </div>
  )
}
