import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getCategoryProducts, getCategoryProductCount, getCategoryBrands, getCategoryBySlug, getSubcategories, PAGE_SIZE } from '@/lib/queries'
import { ProductCard } from '@/components/ProductCard'
import { Pagination } from '@/components/Pagination'
import { CategoryIcon } from '@/components/CategoryIcon'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ categorie: string }>
  searchParams: Promise<{ sort?: string; brand?: string; page?: string; tot?: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { categorie } = await params
  const label = categorie.replace(/-/g, ' ')
  const title = `${label.charAt(0).toUpperCase() + label.slice(1)} — prețuri și reduceri reale`
  const description = `Comparator de prețuri pentru ${label}. Verificăm reducerile față de mediana prețurilor pe 30 de zile.`
  return {
    title,
    description,
    alternates: { canonical: `/c/${categorie}` },
    openGraph: { title, description },
  }
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { categorie } = await params
  const { sort = 'price', brand, page: pageStr, tot } = await searchParams

  const sortValue = (sort === 'discount' || sort === 'price' || sort === 'name') ? sort : 'price'
  const brandValue = brand || null
  const currentPage = Math.max(1, parseInt(pageStr ?? '1') || 1)
  const includeSub = tot === '1'

  const category = await getCategoryBySlug(categorie)
  if (!category) notFound()

  // Subcategoriile pentru navigare: pe o pagina parinte -> copiii ei; pe o pagina copil ->
  // "surorile" (ceilalti copii ai aceluiasi parinte), ca sa poti sari lateral intre ele.
  const [products, totalCount, brands, ownSubs, siblings] = await Promise.all([
    getCategoryProducts(categorie, currentPage, sortValue, brandValue, includeSub),
    getCategoryProductCount(categorie, brandValue, includeSub),
    getCategoryBrands(categorie, includeSub),
    getSubcategories(categorie),
    category.parent_slug ? getSubcategories(category.parent_slug) : Promise.resolve([]),
  ])

  // Ce afisam ca navigare de subcategorii: copiii proprii (pe parinte) sau surorile (pe copil).
  const navSubs = ownSubs.length ? ownSubs : siblings
  const hasChildren = ownSubs.length > 0

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)
  const label = category.name
  const discountCount = products.filter(p => p.discount_pct != null).length

  // Construiește URL cu toți parametrii curenți + pagina nouă
  function buildUrl(page: number) {
    const params = new URLSearchParams()
    if (sortValue !== 'price') params.set('sort', sortValue)
    if (brandValue) params.set('brand', brandValue)
    if (includeSub) params.set('tot', '1')
    if (page > 1) params.set('page', String(page))
    const qs = params.toString()
    return `/c/${categorie}${qs ? `?${qs}` : ''}`
  }

  // Construiește URL pentru brand (resetează pagina)
  function buildBrandUrl(b: string | null) {
    const params = new URLSearchParams()
    if (sortValue !== 'price') params.set('sort', sortValue)
    if (b) params.set('brand', b)
    if (includeSub) params.set('tot', '1')
    const qs = params.toString()
    return `/c/${categorie}${qs ? `?${qs}` : ''}`
  }

  // Construiește URL pentru sort (resetează pagina)
  function buildSortUrl(s: string) {
    const params = new URLSearchParams()
    if (s !== 'price') params.set('sort', s)
    if (brandValue) params.set('brand', brandValue)
    if (includeSub) params.set('tot', '1')
    const qs = params.toString()
    return `/c/${categorie}${qs ? `?${qs}` : ''}`
  }

  // Link "vezi tot / doar categoria" — comuta agregarea subcategoriilor (doar cand exista copii)
  function buildTotUrl(all: boolean) {
    const params = new URLSearchParams()
    if (sortValue !== 'price') params.set('sort', sortValue)
    if (brandValue) params.set('brand', brandValue)
    if (all) params.set('tot', '1')
    const qs = params.toString()
    return `/c/${categorie}${qs ? `?${qs}` : ''}`
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.superieftin.ro'
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${label.charAt(0).toUpperCase() + label.slice(1)} — prețuri`,
    numberOfItems: totalCount,
    itemListElement: products.slice(0, 10).map((p, i) => ({
      '@type': 'ListItem',
      position: (currentPage - 1) * PAGE_SIZE + i + 1,
      url: `${siteUrl}/p/${p.slug}`,
      name: p.name,
    })),
  }

  const breadcrumbItems = [
    { name: 'Acasă', item: siteUrl },
    ...(category.parent_slug ? [{ name: category.parent_name!, item: `${siteUrl}/c/${category.parent_slug}` }] : []),
    { name: label, item: `${siteUrl}/c/${categorie}` },
  ]
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbItems.map((b, i) => ({ '@type': 'ListItem', position: i + 1, ...b })),
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />

      {/* Breadcrumb */}
      <nav className="text-sm text-muted mb-4 flex gap-1.5 items-center">
        <Link href="/" className="hover:text-[var(--color-text)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded">Acasă</Link>
        {category.parent_slug && (
          <>
            <span>/</span>
            <Link href={`/c/${category.parent_slug}`} className="hover:text-[var(--color-text)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded">
              {category.parent_name}
            </Link>
          </>
        )}
        <span>/</span>
        <span className="text-[var(--color-text)]">{label}</span>
      </nav>

      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-black font-archivo text-[var(--color-text)] capitalize">{label}</h1>
        <p className="text-sm text-muted mt-1">
          {totalCount.toLocaleString('ro-RO')} produse
          {includeSub && hasChildren && ' (inclusiv subcategoriile)'}
          {brandValue && <> · marca <strong className="text-[var(--color-text)]">{brandValue}</strong></>}
          {discountCount > 0 && ` · ${discountCount} cu reducere reală`}
          {totalPages > 1 && ` · pagina ${currentPage} din ${totalPages}`}
        </p>
      </div>

      {/* Navigare subcategorii: carduri catre copii (pe parinte) sau surori (pe copil) */}
      {navSubs.length > 0 && (
        <div className="mb-6">
          <span className="text-xs font-semibold text-muted uppercase tracking-wide">
            {hasChildren ? 'Alege o subcategorie' : 'Categorii înrudite'}
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 mt-2">
            {navSubs.map(sub => {
              const active = sub.slug === categorie
              return (
                <Link
                  key={sub.slug}
                  href={`/c/${sub.slug}`}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                    active
                      ? 'bg-brand text-white border-brand'
                      : 'bg-surface border-line hover:border-brand hover:text-brand'
                  }`}
                >
                  <CategoryIcon name={sub.icon} className="w-5 h-5 shrink-0" />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium truncate">{sub.name}</span>
                    <span className={`block text-xs ${active ? 'text-white/80' : 'text-muted'}`}>
                      {sub.count.toLocaleString('ro-RO')} produse
                    </span>
                  </span>
                </Link>
              )
            })}
          </div>
          {hasChildren && (
            <a href={buildTotUrl(!includeSub)} className="inline-block mt-3 text-sm text-brand hover:underline">
              {includeSub
                ? `Vezi doar „${label}"`
                : 'Vezi tot, inclusiv subcategoriile'}
            </a>
          )}
        </div>
      )}

      {/* Filtre: Sort + Marcă */}
      <div className="flex flex-col gap-3 mb-6">
        {/* Sort */}
        <div className="flex gap-2 flex-wrap items-center">
          <span className="text-xs font-semibold text-muted uppercase tracking-wide mr-1">Sortare:</span>
          {[
            { value: 'price', label: 'Preț mic' },
            { value: 'discount', label: '🔥 Reducere' },
            { value: 'name', label: 'Alfabetic' },
          ].map(opt => (
            <a
              key={opt.value}
              href={buildSortUrl(opt.value)}
              className={`text-sm px-3 py-1.5 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1 ${
                sortValue === opt.value
                  ? 'bg-brand text-white border-brand'
                  : 'bg-surface text-[var(--color-text)] border-line hover:border-brand hover:text-brand'
              }`}
            >
              {opt.label}
            </a>
          ))}
        </div>

        {/* Marcă */}
        {brands.length > 0 && (
          <div className="flex gap-2 flex-wrap items-center">
            <span className="text-xs font-semibold text-muted uppercase tracking-wide mr-1">Marcă:</span>
            <a
              href={buildBrandUrl(null)}
              className={`text-sm px-3 py-1.5 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1 ${
                !brandValue
                  ? 'bg-brand text-white border-brand'
                  : 'bg-surface text-[var(--color-text)] border-line hover:border-brand hover:text-brand'
              }`}
            >
              Toate
            </a>
            {brands.map(b => (
              <a
                key={b}
                href={buildBrandUrl(b)}
                className={`text-sm px-3 py-1.5 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1 ${
                  brandValue === b
                    ? 'bg-brand text-white border-brand'
                    : 'bg-surface text-[var(--color-text)] border-line hover:border-brand hover:text-brand'
                }`}
              >
                {b}
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Grid produse */}
      {products.length > 0 ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {products.map(product => (
              <ProductCard key={product.offer_id} product={product} />
            ))}
          </div>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            buildUrl={buildUrl}
          />
        </>
      ) : (
        <div className="text-center py-16 text-muted">
          <p className="text-5xl mb-4">📦</p>
          <p>Niciun produs găsit{brandValue ? ` pentru marca ${brandValue}` : ''}.</p>
          {brandValue && (
            <a href={`/c/${categorie}`} className="mt-3 inline-block text-sm text-brand hover:underline">
              Șterge filtrul de marcă
            </a>
          )}
        </div>
      )}
    </>
  )
}
