import type { Metadata } from 'next'
import Link from 'next/link'
import { searchProducts, searchProductCount, logSearch, PAGE_SIZE } from '@/lib/queries'
import { TrackSearch } from '@/components/analytics/TrackSearch'
import { ProductList } from '@/components/listing/ProductList'
import { EmptyState, ListingHeader, MethodNote } from '@/components/listing/ListingParts'
import { roCount } from '@/lib/seo/site'
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
    // noindex (rezultatele de cautare nu se indexeaza), dar follow: robotii pot urma linkurile
    // spre produse. Fara canonical (raport SEO, A9).
    robots: { index: false, follow: true },
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

  // Logheaza termenul o singura data per cautare (doar prima pagina), non-blocking.
  if (query && currentPage === 1) void logSearch(query, totalCount)

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  function buildUrl(page: number) {
    const params = new URLSearchParams({ q: query })
    if (page > 1) params.set('page', String(page))
    return `/cautare?${params.toString()}`
  }

  return (
    <div>
      {query && <TrackSearch term={query} />}
      <ListingHeader
        crumbs={[{ label: 'Acasă', href: '/' }, { label: 'Căutare' }]}
        title={query ? <>Rezultate pentru „{query}”</> : 'Caută un produs'}
      >
        {query && products.length > 0 && (
          <p className="tabular-nums">
            {roCount(totalCount, 'rezultate', 'rezultat')}
            {totalPages > 1 && ` · pagina ${currentPage} din ${totalPages}`}
          </p>
        )}
      </ListingHeader>

      {/* Formularul de căutare (GET, merge și fără JavaScript) */}
      <form action="/cautare" method="get" role="search" className="mb-4 flex max-w-xl gap-2">
        <input
          name="q"
          type="search"
          defaultValue={query}
          placeholder="Caută produs, brand sau categorie..."
          aria-label="Caută produs, brand sau categorie"
          autoFocus
          autoComplete="off"
          className="h-12 min-w-0 flex-1 rounded-xl bg-surface px-4 text-[15px] text-ink ring-[1.5px] ring-inset ring-line-2 placeholder:text-ink-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink"
        />
        {/* Cerneală, nu roșu: roșul plin e rezervat butonului „Vezi oferta” (design §3) */}
        <button
          type="submit"
          className="inline-flex h-12 items-center rounded-xl bg-ink px-5 font-display text-[15px] font-extrabold text-page transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
        >
          Caută
        </button>
      </form>

      {/* Stare: fără query */}
      {!query && (
        <EmptyState title="Scrie un produs sau o marcă pentru a căuta.">
          <p>Exemplu: <em>Samsung Galaxy</em>, <em>iPhone 15</em>, <em>Xiaomi</em></p>
        </EmptyState>
      )}

      {/* Stare: query fără rezultate */}
      {query && products.length === 0 && (
        <EmptyState title={<>Niciun rezultat pentru „{query}”.</>}>
          <p>Încearcă cu mai puține cuvinte sau verifică ortografia.</p>
          <Link href="/" className="mt-3 inline-block font-semibold text-ink underline underline-offset-[3px] hover:text-red-ink">
            ← Înapoi la pagina principală
          </Link>
        </EmptyState>
      )}

      {/* Rezultate */}
      {query && products.length > 0 && (
        <>
          <MethodNote className="mb-3" />
          <h2 className="sr-only">Produse</h2>
          <ProductList products={products} />
          <Pagination currentPage={currentPage} totalPages={totalPages} buildUrl={buildUrl} />
        </>
      )}
    </div>
  )
}
