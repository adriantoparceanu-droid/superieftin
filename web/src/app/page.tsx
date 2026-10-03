import type { Metadata } from 'next'
import Link from 'next/link'
import {
  getTopDiscounts, getCheapestProducts, getCategories,
  getActiveRetailersPublic, getMenu, getCategoryProducts, getBanners,
  type Banner as BannerData,
} from '@/lib/queries'
import { ProductCard } from '@/components/ProductCard'
import { ProductCarousel } from '@/components/ProductCarousel'
import { CategoryGrid } from '@/components/CategoryGrid'
import { CategoryMenu } from '@/components/CategoryMenu'
import { Banner } from '@/components/Banner'
import { HeroBanners } from '@/components/HeroBanners'
import { AdConsentGate } from '@/components/consent/AdConsentGate'
import { BenefitsBar } from '@/components/BenefitsBar'
import { RetailerStrip } from '@/components/RetailerStrip'
import { getSiteFacts } from '@/lib/seo/site-facts'
import { withOg } from '@/lib/seo/og'
import { SITE_URL, roCount } from '@/lib/seo/site'

export const dynamic = 'force-dynamic'

// Titlul cu brand + ce face site-ul (template-ul „%s | superieftin.ro” nu se aplica pe radacina,
// deci titlul era fara brand). Descrierea are cifre live (lib/seo/site-facts.ts, cache 1 h).
const HOME_TITLE = 'superieftin.ro — comparator de prețuri cu istoric și reduceri reale'

export async function generateMetadata(): Promise<Metadata> {
  const facts = await getSiteFacts().catch(() => null)
  const tracked = facts && facts.products > 0
    ? `Urmărim zilnic ${roCount(facts.products, 'produse', 'produs')} de la ${roCount(facts.retailers, 'magazine online', 'magazin online')} din România. `
    : 'Urmărim zilnic prețurile magazinelor online din România. '
  const description = `${tracked}Comparăm prețul de azi cu mediana ultimelor 30 de zile — nu cu prețul vechi afișat de magazin.`
  return {
    title: { absolute: HOME_TITLE },
    description,
    alternates: { canonical: '/' },
    openGraph: withOg({ title: HOME_TITLE, description, url: `${SITE_URL}/` }),
  }
}

const FEATURED_SECTIONS = 3
const SECTION_PRODUCTS = 6

export default async function HomePage() {
  const [discounts, cheapest, categories, retailers, menu, banners] = await Promise.all([
    getTopDiscounts(12).catch(() => []),
    getCheapestProducts(12).catch(() => []),
    getCategories().catch(() => []),
    getActiveRetailersPublic().catch(() => []),
    getMenu().catch(() => []),
    getBanners().catch(() => ({} as Record<string, BannerData>)),
  ])

  const bannerMain = banners['main'] ?? null
  const bannerSmalls = [banners['small_left'], banners['small_right']].filter(Boolean)

  // Hero (fallback cand slotul mare n-are banner): produsul cu cea mai mare reducere reala
  const isRealDiscount = discounts.length > 0
  const heroProduct = discounts[0] ?? cheapest.find((p) => p.image_url) ?? null

  // Sectiuni featured: primele categorii din meniul administrabil
  const menuCategories = menu
    .filter((m) => m.href.startsWith('/c/'))
    .map((m) => ({ label: m.label, slug: m.href.replace('/c/', '') }))

  const featured = menuCategories.slice(0, FEATURED_SECTIONS)
  const featuredProducts = await Promise.all(
    featured.map((f) => getCategoryProducts(f.slug, 1, 'discount').then((p) => p.slice(0, SECTION_PRODUCTS)).catch(() => []))
  )

  // Caruselul „top reduceri": reduceri reale, altfel cele mai mici preturi
  const carouselProducts = isRealDiscount ? discounts : cheapest
  const totalProducts = categories.reduce((sum, c) => sum + c.count, 0)

  // JSON-LD WebSite (+ SearchAction) si Organization sunt acum in layout, pe toate paginile
  // (lib/seo/jsonld.ts), cu @id comun.

  const hero = <HeroBanners heroProduct={heroProduct} isRealDiscount={isRealDiscount} secondaryCategory={null} />

  return (
    <>
      {/* Rand principal stil Porto: meniu vertical (stanga) + coloana de bannere (dreapta):
          un banner mare sus + doua mici sub el, toate administrabile din /admin/bannere.
          Slotul mare cade pe hero-ul generat automat cat timp nu exista banner activ. */}
      <div className="grid lg:grid-cols-[250px_1fr] gap-4 items-start pt-2 mb-6">
        <CategoryMenu menu={menu} />
        {/* Bannerele se incadreaza intr-un cadru de max 970px (dimensiune standard Profitshare/IAB);
            continutul mai mic se scaleaza la latimea cadrului. Cele doua mici impart cadrul in doua. */}
        <div className="flex flex-col gap-4 min-w-0 w-full max-w-[970px]">
          {bannerMain?.type === 'html' ? (
            // Banner HTML de afiliere (scripturi Profitshare → cookie): doar cu acord „Publicitate”
            // si doar pe desktop; altfel hero-ul auto (cu cautare). Vezi AdConsentGate.
            <AdConsentGate fallback={hero}>
              <Banner banner={bannerMain} />
            </AdConsentGate>
          ) : bannerMain ? (
            <>
              {/* Banner-imagine (format desktop 970px): nu se afiseaza pe mobil */}
              <div className="hidden lg:block">
                <Banner banner={bannerMain} />
              </div>
              <div className="lg:hidden">{hero}</div>
            </>
          ) : (
            hero
          )}
          {bannerSmalls.length > 0 && (
            <div className="hidden lg:grid lg:grid-cols-2 gap-4">
              {(['small_left', 'small_right'] as const).map((slot) => {
                const b = banners[slot]
                if (!b) return null
                return b.type === 'html'
                  ? <AdConsentGate key={slot}><Banner banner={b} /></AdConsentGate>
                  : <Banner key={slot} banner={b} />
              })}
            </div>
          )}
        </div>
      </div>

      <BenefitsBar />

      {/* Top reduceri / cele mai mici preturi — carusel */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold font-archivo text-[var(--color-text)]">
            {isRealDiscount ? '🔥 Top reduceri reale' : '💰 Cele mai mici prețuri acum'}
          </h2>
          {/* Legatura interna spre hubul /reduceri-reale (raport SEO, A8) */}
          <Link
            href="/reduceri-reale"
            className="text-sm text-brand hover:text-brand-dark font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 rounded"
          >
            Reduceri reale pe categorii →
          </Link>
        </div>
        {carouselProducts.length > 0 ? (
          <ProductCarousel products={carouselProducts} />
        ) : (
          <div className="rounded-xl border border-line bg-surface p-6 text-sm text-muted text-center">
            Monitorizăm prețurile — reducerile reale apar pe măsură ce acumulăm date.
          </div>
        )}
      </section>

      {/* Departamente populare (categorii cu iconite) */}
      <section id="toate-categoriile" className="mb-10 scroll-mt-20">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold font-archivo text-[var(--color-text)]">Departamente populare</h2>
          {totalProducts > 0 && (
            <p className="text-xs text-muted">{totalProducts.toLocaleString('ro-RO')} produse monitorizate</p>
          )}
        </div>
        <CategoryGrid activeCategories={categories} />
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
            <p className="text-muted">Reducere reală = preț actual cu cel puțin 5% sub mediana de 30 de zile.</p>
          </div>
        </div>
      </section>
    </>
  )
}
