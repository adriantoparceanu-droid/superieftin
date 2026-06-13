import type { Metadata } from 'next'
import Link from 'next/link'
import {
  getTopDiscounts, getCheapestProducts, getCategories, getCategoryThumbs,
  getActiveRetailersPublic, getMenu, getCategoryProducts,
} from '@/lib/queries'
import { ProductCard } from '@/components/ProductCard'
import { ProductCarousel } from '@/components/ProductCarousel'
import { CategoryGrid } from '@/components/CategoryGrid'
import { HeroBanners } from '@/components/HeroBanners'
import { BenefitsBar } from '@/components/BenefitsBar'
import { RetailerStrip } from '@/components/RetailerStrip'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Reduceri reale pe piața din România',
  description:
    'Comparăm prețurile față de mediana ultimelor 30 de zile — nu față de prețul vechi afișat de magazine. Fără trucuri, doar date reale.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'SuperIeftin.ro — Reduceri reale pe piața din România',
    description: 'Comparăm prețurile față de mediana ultimelor 30 de zile.',
  },
}

const FEATURED_SECTIONS = 3
const SECTION_PRODUCTS = 6

export default async function HomePage() {
  const [discounts, cheapest, categories, thumbs, retailers, menu] = await Promise.all([
    getTopDiscounts(12).catch(() => []),
    getCheapestProducts(12).catch(() => []),
    getCategories().catch(() => []),
    getCategoryThumbs().catch(() => ({}) as Record<string, string>),
    getActiveRetailersPublic().catch(() => []),
    getMenu().catch(() => []),
  ])

  // Hero: produsul cu cea mai mare reducere reala; fallback pe cel mai mic pret cu imagine
  const isRealDiscount = discounts.length > 0
  const heroProduct = discounts[0] ?? cheapest.find((p) => p.image_url) ?? null

  // Banner secundar + sectiuni featured: primele categorii din meniul administrabil
  const menuCategories = menu
    .filter((m) => m.href.startsWith('/c/'))
    .map((m) => ({ label: m.label, slug: m.href.replace('/c/', '') }))
  const secondaryCategory = menuCategories[0]
    ? { name: menuCategories[0].label, slug: menuCategories[0].slug, image: thumbs[menuCategories[0].slug] ?? null }
    : null

  const featured = menuCategories.slice(0, FEATURED_SECTIONS)
  const featuredProducts = await Promise.all(
    featured.map((f) => getCategoryProducts(f.slug, 1, 'discount').then((p) => p.slice(0, SECTION_PRODUCTS)).catch(() => []))
  )

  // Caruselul „top reduceri": reduceri reale, altfel cele mai mici preturi
  const carouselProducts = isRealDiscount ? discounts : cheapest
  const totalProducts = categories.reduce((sum, c) => sum + c.count, 0)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'superieftin.ro',
    url: 'https://www.superieftin.ro',
    description: 'Comparator de prețuri cu istoric — reduceri reale pe piața din România',
    potentialAction: {
      '@type': 'SearchAction',
      target: 'https://www.superieftin.ro/cautare?q={search_term_string}',
      'query-input': 'required name=search_term_string',
    },
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="pt-4">
        <HeroBanners heroProduct={heroProduct} isRealDiscount={isRealDiscount} secondaryCategory={secondaryCategory} />
      </div>

      <BenefitsBar />

      {/* Categorii cu imagini de produse */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold font-archivo text-[var(--color-text)]">Categorii</h2>
          {totalProducts > 0 && (
            <p className="text-xs text-muted">{totalProducts.toLocaleString('ro-RO')} produse monitorizate</p>
          )}
        </div>
        <CategoryGrid activeCategories={categories} />
      </section>

      {/* Top reduceri / cele mai mici preturi — carusel */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold font-archivo text-[var(--color-text)]">
            {isRealDiscount ? '🔥 Top reduceri reale verificate azi' : '💰 Cele mai mici prețuri acum'}
          </h2>
        </div>
        {carouselProducts.length > 0 ? (
          <ProductCarousel products={carouselProducts} />
        ) : (
          <div className="rounded-xl border border-line bg-surface p-6 text-sm text-muted text-center">
            Monitorizăm prețurile — reducerile reale apar pe măsură ce acumulăm date.
          </div>
        )}
      </section>

      {/* Sectiuni pe categorii (primele din meniul administrabil) */}
      {featured.map((f, i) =>
        featuredProducts[i].length > 0 ? (
          <section key={f.slug} className="mb-10">
            <div className="flex items-center justify-between mb-4 border-b-2 border-line pb-2">
              <h2 className="text-lg font-bold font-archivo text-[var(--color-text)] border-b-2 border-brand -mb-2.5 pb-2">
                {f.label}
              </h2>
              <Link
                href={`/c/${f.slug}`}
                className="text-sm text-brand hover:text-brand-dark font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 rounded"
              >
                Vezi toate →
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {featuredProducts[i].map((product) => (
                <ProductCard key={product.offer_id} product={product} />
              ))}
            </div>
          </section>
        ) : null
      )}

      <RetailerStrip retailers={retailers} />

      {/* Cum functioneaza */}
      <section className="rounded-xl border border-line bg-surface p-6 mb-4">
        <h2 className="font-semibold text-[var(--color-text)] mb-5 text-center">Cum verificăm reducerile</h2>
        <div className="grid sm:grid-cols-3 gap-6 text-sm">
          <div className="flex flex-col items-center text-center gap-2">
            <span className="text-4xl font-black font-archivo text-brand">1</span>
            <strong className="text-[var(--color-text)]">Colectăm prețuri zilnic</strong>
            <p className="text-muted">Sincronizăm ofertele retailerilor în fiecare zi.</p>
          </div>
          <div className="flex flex-col items-center text-center gap-2">
            <span className="text-4xl font-black font-archivo text-brand">2</span>
            <strong className="text-[var(--color-text)]">Calculăm mediana 30 de zile</strong>
            <p className="text-muted">Mediana elimină vârfurile artificiale de preț.</p>
          </div>
          <div className="flex flex-col items-center text-center gap-2">
            <span className="text-4xl font-black font-archivo text-brand">3</span>
            <strong className="text-[var(--color-text)]">Validăm reducerea</strong>
            <p className="text-muted">Reducere reală = preț actual cu cel puțin 5% sub medie.</p>
          </div>
        </div>
      </section>
    </>
  )
}
