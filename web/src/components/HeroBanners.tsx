import Image from 'next/image'
import Link from 'next/link'
import type { ProductWithDiscount } from '@/lib/queries'

interface Props {
  heroProduct: ProductWithDiscount | null      // produsul-vedeta (cea mai mare reducere reala)
  isRealDiscount: boolean                      // false = fallback pe cel mai mic pret
  secondaryCategory: { name: string; slug: string; image: string | null } | null
}

// Hero in stil Porto: banner principal 2/3 + banner secundar 1/3, 100% CSS + date reale
export function HeroBanners({ heroProduct, isRealDiscount, secondaryCategory }: Props) {
  return (
    <section className="grid lg:grid-cols-3 gap-4 mb-6">
      {/* Banner principal */}
      <div className="lg:col-span-2 relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand to-brand-dark text-white p-7 sm:p-10 flex flex-col justify-between min-h-72">
        <div className="relative z-10 max-w-md">
          <p className="text-xs font-bold uppercase tracking-widest text-white/80 mb-2">
            {isRealDiscount ? 'Verificat azi' : 'Monitorizat zilnic'}
          </p>
          <h1 className="text-3xl sm:text-4xl font-black font-archivo leading-tight mb-3">
            Reduceri <span className="underline decoration-4 decoration-white/50">REALE</span>,<br />nu trucuri de marketing
          </h1>
          <p className="text-sm text-white/85 mb-5">
            Comparăm prețul de azi cu mediana ultimelor 30 de zile — reducerea e reală doar dacă e mai mic.
          </p>

          <form action="/cautare" method="get" className="flex gap-2 max-w-sm">
            <input
              name="q" type="search" placeholder="Caută produs sau brand..."
              className="flex-1 px-4 py-2.5 rounded-lg text-sm bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-white/70"
              autoComplete="off"
            />
            <button type="submit" className="px-5 py-2.5 bg-gray-900 hover:bg-black text-white text-sm font-semibold rounded-lg transition-colors">
              Caută
            </button>
          </form>
        </div>

        {heroProduct?.image_url && (
          <Link
            href={`/p/${heroProduct.slug}`}
            className="absolute right-4 bottom-4 sm:right-8 sm:top-1/2 sm:-translate-y-1/2 hidden sm:block group"
            title={heroProduct.name}
          >
            <div className="relative w-44 h-44 lg:w-52 lg:h-52 bg-white rounded-2xl shadow-xl p-3 group-hover:scale-105 transition-transform">
              <Image src={heroProduct.image_url} alt={heroProduct.name} fill sizes="208px" className="object-contain p-3" unoptimized />
              {isRealDiscount && heroProduct.discount_pct != null && (
                <span className="absolute -top-2 -left-2 bg-red-600 text-white text-sm font-black rounded-full px-2.5 py-1.5 shadow">
                  -{Math.round(heroProduct.discount_pct)}%
                </span>
              )}
              {heroProduct.current_price != null && (
                <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs font-bold rounded-full px-3 py-1 whitespace-nowrap">
                  {heroProduct.current_price.toLocaleString('ro-RO')} lei
                </span>
              )}
            </div>
          </Link>
        )}
      </div>

      {/* Banner secundar: prima categorie din meniu */}
      {secondaryCategory && (
        <Link
          href={`/c/${secondaryCategory.slug}`}
          className="relative overflow-hidden rounded-2xl bg-surface border border-line p-7 flex flex-col justify-between min-h-56 lg:min-h-72 group hover:border-brand transition-colors"
        >
          <div className="relative z-10">
            <p className="text-xs font-bold uppercase tracking-widest text-muted mb-2">În prim-plan</p>
            <h2 className="text-2xl font-black font-archivo text-[var(--color-text)] leading-tight mb-2">
              {secondaryCategory.name}
            </h2>
            <span className="text-sm font-semibold text-brand group-hover:underline">Vezi ofertele →</span>
          </div>
          {secondaryCategory.image && (
            <div className="relative h-32 mt-3">
              <Image src={secondaryCategory.image} alt={secondaryCategory.name} fill sizes="300px" className="object-contain group-hover:scale-105 transition-transform" unoptimized />
            </div>
          )}
        </Link>
      )}
    </section>
  )
}
