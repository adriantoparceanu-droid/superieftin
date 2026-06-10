import type { Metadata } from 'next'
import { getTopDiscounts, getCheapestProducts, getCategories } from '@/lib/queries'
import { ProductCard } from '@/components/ProductCard'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Reduceri reale pe piața din România',
  description:
    'Comparăm prețurile reale față de mediana ultimelor 30 de zile. Fără trucuri de marketing, doar date reale.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'SuperIeftin.ro — Reduceri reale pe piața din România',
    description: 'Comparăm prețurile reale față de mediana ultimelor 30 de zile.',
  },
}

export default async function HomePage() {
  const [discounts, cheapest, categories] = await Promise.all([
    getTopDiscounts(24).catch(() => []),
    getCheapestProducts(24).catch(() => []),
    getCategories().catch(() => []),
  ])

  const hasRealDiscounts = discounts.length > 0
  const products = hasRealDiscounts ? discounts : cheapest

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'superieftin.ro',
    url: 'https://superieftin.ro',
    description: 'Comparator de prețuri cu istoric — reduceri reale pe piața din România',
    potentialAction: {
      '@type': 'SearchAction',
      target: 'https://superieftin.ro/cautare?q={search_term_string}',
      'query-input': 'required name=search_term_string',
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Hero */}
      <section className="text-center py-8">
        <h1 className="text-3xl font-black font-archivo text-[var(--color-text)] mb-3">
          Cele mai mari reduceri <span className="text-brand">REALE</span> azi
        </h1>
        <p className="text-muted max-w-xl mx-auto">
          Comparăm prețurile față de mediana ultimelor 30 de zile — nu față de prețul
          &ldquo;vechi&rdquo; afișat de magazine.
        </p>
      </section>

      {/* Categorii */}
      {categories.length > 0 && (
        <section className="mb-6 flex flex-wrap gap-2">
          {categories.map((cat) => (
            <a
              key={cat.category}
              href={`/c/${cat.category}`}
              className="text-sm bg-surface border border-line rounded-full px-3 py-1 hover:border-brand hover:text-brand transition-colors"
            >
              {cat.category.replace(/-/g, ' ')}
              <span className="ml-1 text-muted text-xs">({cat.count})</span>
            </a>
          ))}
        </section>
      )}

      {/* Produse */}
      <section>
        <h2 className="text-lg font-semibold mb-4 text-[var(--color-text)]">
          {hasRealDiscounts ? '🔥 Reduceri reale verificate' : '💰 Cele mai mici prețuri acum'}
        </h2>

        {!hasRealDiscounts && (
          <div className="bg-brand-light border border-brand/20 rounded-lg p-4 mb-6 text-sm text-brand">
            Monitorizăm prețurile — pe măsură ce acumulăm date, reducerile reale vor apărea automat.
            Revino în câteva zile!
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {products.map((product) => (
            <ProductCard key={product.offer_id} product={product} />
          ))}
        </div>

        {products.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-5xl mb-4">🔍</p>
            <p>Niciun produs disponibil momentan.</p>
            <p className="text-sm mt-1">Verifică mai târziu!</p>
          </div>
        )}
      </section>

      {/* Explicatie metodologie */}
      <section className="mt-12 bg-surface rounded-lg border border-line p-6">
        <h2 className="font-semibold text-[var(--color-text)] mb-3">Cum calculăm reducerea reală?</h2>
        <div className="grid sm:grid-cols-3 gap-4 text-sm text-muted">
          <div className="flex gap-3">
            <span className="text-2xl">📊</span>
            <div>
              <strong className="text-[var(--color-text)]">Colectăm prețuri zilnic</strong>
              <p className="mt-0.5">Monitorizăm prețul fiecărui produs la intervale regulate.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="text-2xl">📐</span>
            <div>
              <strong className="text-[var(--color-text)]">Calculăm mediana 30 de zile</strong>
              <p className="mt-0.5">Mediana elimină vârfurile artificiale de preț.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="text-2xl">✅</span>
            <div>
              <strong className="text-[var(--color-text)]">Validăm reducerea</strong>
              <p className="mt-0.5">Reducere reală = preț actual cu cel puțin 10% sub medie.</p>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
