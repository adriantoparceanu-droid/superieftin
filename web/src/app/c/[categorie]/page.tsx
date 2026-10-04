import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getCategoryProducts, getCategoryProductCount, getCategoryBrands, getCategoryBySlug, getSubcategories, getRandomCategoryProducts, PAGE_SIZE } from '@/lib/queries'
import { ProductCard } from '@/components/ProductCard'
import { Pagination } from '@/components/Pagination'
import { CategoryIcon } from '@/components/CategoryIcon'
import { CategoryContent } from '@/components/CategoryContent'
import { getCategoryStat } from '@/lib/seo/queries'
import { listingDescription, listingSeo, parsePageParam } from '@/lib/seo/listing'
import { isExcludedFromAds } from '@/lib/seo/categories'
import { withOg } from '@/lib/seo/og'
import { brandsForQuery, brandTitlePart, buildListingUrl, parseBrandParam, parseSortParam } from '@/lib/listing-filters'
import { BrandFilter } from '@/components/category/BrandFilter'
import { MobileFilters } from '@/components/category/MobileFilters'
import { SortSelect } from '@/components/category/SortSelect'
import { absUrl, lowerFirst } from '@/lib/seo/site'

export const dynamic = 'force-dynamic'

// Un parametru repetat (?brand=A&brand=B) vine ca string[]
type SearchParams = { sort?: string | string[]; brand?: string | string[]; page?: string | string[]; tot?: string | string[] }
type Props = {
  params: Promise<{ categorie: string }>
  searchParams: Promise<SearchParams>
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

// Parametrii vederii curente, normalizati la fel in metadata si in pagina.
// brands = marcile bifate (?brand= repetat, lib/listing-filters.ts); brandQuery = aceeasi lista
// sortata (sau null), pentru query-uri si cache.
function parseView(sp: SearchParams) {
  const brands = parseBrandParam(sp.brand)
  return {
    sort: parseSortParam(sp.sort),
    brands,
    brandQuery: brandsForQuery(brands),
    page: parsePageParam(first(sp.page)),
    includeSub: first(sp.tot) === '1',
  }
}

// Titlu/descriere din NUMELE categoriei (nu din slug) + cifre live; canonical propriu pe
// ?page=N; noindex pe ?brand= si pe categoriile fara produse disponibile (lib/seo/listing.ts).
export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { categorie } = await params
  const view = parseView(await searchParams)
  const category = await getCategoryBySlug(categorie)
  if (!category || !category.is_visible) return {}   // pagina raspunde 404 (not-found.tsx)

  const [stat, viewCount] = await Promise.all([
    getCategoryStat(categorie).catch(() => null),
    getCategoryProductCount(categorie, view.brandQuery, view.includeSub),
  ])
  const seo = listingSeo({
    basePath: `/c/${categorie}`,
    page: view.page,
    totalPages: Math.ceil(viewCount / PAGE_SIZE),
    hasReorder: view.sort !== 'price' || view.includeSub,
    brand: view.brands,
    empty: (stat?.products ?? viewCount) === 0,
  })
  if (seo.notFound) return {}

  const title = `${category.name}${brandTitlePart(view.brands)} — prețuri, istoric și reduceri reale${seo.titleSuffix}`
  const description = listingDescription(category.name, {
    products: stat?.products ?? viewCount,
    retailers: stat?.retailers ?? 0,
    brands: stat?.brands ?? 0,
    minPrice: stat?.min_price ?? null,
  })
  return {
    title,
    description,
    alternates: { canonical: seo.canonical },
    ...(seo.robots ? { robots: seo.robots } : {}),
    openGraph: withOg({ title, description, url: absUrl(seo.canonical) }),
  }
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { categorie } = await params
  const view = parseView(await searchParams)
  const sortValue = view.sort
  const selectedBrands = view.brands
  const currentPage = view.page
  const includeSub = view.includeSub
  const basePath = `/c/${categorie}`

  const category = await getCategoryBySlug(categorie)
  // Categoriile ascunse din admin nu sunt publice (inainte erau accesibile direct, cu 200)
  if (!category || !category.is_visible) notFound()

  // Subcategoriile pentru navigare: pe o pagina parinte -> copiii ei; pe o pagina copil ->
  // "surorile" (ceilalti copii ai aceluiasi parinte), ca sa poti sari lateral intre ele.
  const [products, totalCount, brands, ownSubs, siblings] = await Promise.all([
    getCategoryProducts(categorie, currentPage, sortValue, view.brandQuery, includeSub),
    getCategoryProductCount(categorie, view.brandQuery, includeSub),
    getCategoryBrands(categorie, includeSub),
    getSubcategories(categorie),
    category.parent_slug ? getSubcategories(category.parent_slug) : Promise.resolve([]),
  ])

  // Ce afisam ca navigare de subcategorii: copiii proprii (pe parinte) sau surorile (pe copil).
  const navSubs = ownSubs.length ? ownSubs : siblings
  const hasChildren = ownSubs.length > 0

  // Categoriile-parinte (ex. "Laptopuri & Calculatoare") nu au niciodata produse proprii —
  // fara asta pagina arata goala in modul implicit (fara ?tot=1). Aducem o selectie
  // aleatorie din subcategoriile afisate mai sus, ca vizitatorul sa vada mereu ceva.
  const showRandomFallback = products.length === 0 && hasChildren && selectedBrands.length === 0
  const randomProducts = showRandomFallback ? await getRandomCategoryProducts(categorie) : []

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)
  // ?page= peste ultima pagina → 404 adevarat, nu „Niciun produs găsit” cu 200 (soft 404)
  if (currentPage > 1 && currentPage > totalPages) notFound()
  const label = category.name
  const discountCount = products.filter(p => p.discount_pct != null).length

  // URL-urile vederii (lib/listing-filters.ts): paginatia pastreaza sortarea + marcile + „tot”
  const buildUrl = (page: number) => buildListingUrl(basePath, { sort: sortValue, brands: selectedBrands, tot: includeSub, page })
  // Link "vezi tot / doar categoria" — comuta agregarea subcategoriilor (doar cand exista copii)
  const buildTotUrl = (all: boolean) => buildListingUrl(basePath, { sort: sortValue, brands: selectedBrands, tot: all })
  // Pastila unei marci bifate → URL-ul fara ea (pagina se reseteaza)
  const withoutBrand = (b: string) => buildListingUrl(basePath, { sort: sortValue, brands: selectedBrands.filter(x => x !== b), tot: includeSub })

  // Coloana de filtre: doar cand exista marci de ales (sau una bifata care trebuie debifata)
  // si nu pe selectia aleatorie din subcategorii (nimic de filtrat acolo)
  const showFilters = !showRandomFallback && (brands.length > 0 || selectedBrands.length > 0)
  // Produsele listei fara filtrul de marca, pentru „Vezi N produse” din panoul de pe mobil
  const unfilteredCount = selectedBrands.length
    ? await getCategoryProductCount(categorie, null, includeSub)
    : totalCount
  const filterProps = { basePath, options: brands, selected: selectedBrands, sort: sortValue, tot: includeSub, total: unfilteredCount }
  // `key` din marcile din URL: dupa navigare componenta client porneste cu bifele noi
  const filterKey = selectedBrands.join('\u0000')

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
      {products.length > 0 && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />}
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
        {/* Numarul de produse sta in bara de deasupra grilei (langa sortare); aici raman doar
            reducerile de pe pagina si pagina curenta */}
        {showRandomFallback ? (
          <p className="text-sm text-muted mt-1">Alege o subcategorie mai jos, sau răsfoiește o selecție din toate</p>
        ) : (discountCount > 0 || totalPages > 1) && (
          <p className="text-sm text-muted mt-1">
            {[
              discountCount > 0 ? `${discountCount} cu reducere reală pe această pagină` : null,
              totalPages > 1 ? `pagina ${currentPage} din ${totalPages}` : null,
            ].filter(Boolean).join(' · ')}
          </p>
        )}
        {/* Legatura interna spre landing-ul de reduceri reale (fara Sanatate & Naturale — regula 8) */}
        {!isExcludedFromAds(category.slug, category.parent_slug) && (
          <Link href={`/reduceri-reale/${categorie}`} className="inline-block mt-2 text-sm text-red-ink hover:underline">
            Vezi doar reducerile reale la {lowerFirst(label)} →
          </Link>
        )}
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
                      : 'bg-surface border-line hover:border-brand hover:text-red-ink'
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
            <a href={buildTotUrl(!includeSub)} className="inline-block mt-3 text-sm text-red-ink hover:underline">
              {includeSub
                ? `Vezi doar „${label}"`
                : 'Vezi tot, inclusiv subcategoriile'}
            </a>
          )}
        </div>
      )}

      {/* Fara JavaScript butonul „Filtre” de pe mobil nu deschide nimic → aratam coloana si pe
          ecranele mici (deasupra listei), ca filtrul sa ramana folosibil */}
      {showFilters && (
        <noscript>
          <style>{'#filtre-categorie{display:block;margin-bottom:1.5rem}'}</style>
        </noscript>
      )}

      <div className={showFilters ? 'lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-6 lg:items-start' : ''}>
        {/* Coloana „Filtre” (desktop). Sticky sub antetul fix (h-14), cu scroll propriu daca
            lista de marci e mai inalta decat ecranul. */}
        {showFilters && (
          <aside
            id="filtre-categorie"
            aria-label="Filtre"
            className="hidden lg:block lg:sticky lg:top-[4.5rem] lg:max-h-[calc(100dvh-5.5rem)] lg:overflow-y-auto lg:overscroll-contain rounded-xl border border-line bg-surface p-4"
          >
            <h2 className="text-base font-semibold text-[var(--color-text)] mb-3">Filtre</h2>
            <BrandFilter key={filterKey} {...filterProps} mode="sidebar" />
          </aside>
        )}

        <div className="min-w-0">
          {/* Bara de deasupra grilei: numarul de produse | Filtre (mobil) + Sortare */}
          {!showRandomFallback && (
            <div className="mb-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted" aria-live="polite">
                  <strong className="text-[var(--color-text)] tabular">{totalCount.toLocaleString('ro-RO')}</strong>{' '}
                  {totalCount === 1 ? 'produs' : 'produse'}
                  {includeSub && hasChildren && ' (inclusiv subcategoriile)'}
                </p>
                <div className="flex items-center gap-2">
                  {showFilters && <MobileFilters key={filterKey} {...filterProps} />}
                  <SortSelect key={`${sortValue}|${filterKey}|${includeSub}`} basePath={basePath} sort={sortValue} brands={selectedBrands} tot={includeSub} />
                </div>
              </div>

              {/* Marcile bifate, ca pastile care se pot scoate una cate una (utile mai ales pe
                  mobil, unde coloana nu se vede) */}
              {selectedBrands.length > 0 && (
                <ul className="mt-3 flex flex-wrap items-center gap-2" aria-label="Mărci selectate">
                  {selectedBrands.map(b => (
                    <li key={b}>
                      <Link
                        href={withoutBrand(b)}
                        scroll={false}
                        aria-label={`Scoate marca ${b}`}
                        className="inline-flex items-center gap-1 rounded-full border border-brand bg-surface px-2.5 py-1 text-xs font-medium text-red-ink hover:bg-brand hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1"
                      >
                        {b} <span aria-hidden="true">×</span>
                      </Link>
                    </li>
                  ))}
                  {/* pe desktop „Șterge filtrele” e deja in coloana */}
                  <li className={showFilters ? 'lg:hidden' : ''}>
                    <Link
                      href={buildListingUrl(basePath, { sort: sortValue, brands: [], tot: includeSub })}
                      scroll={false}
                      className="text-xs text-muted underline underline-offset-2 hover:text-[var(--color-text)] rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                    >
                      Șterge filtrele
                    </Link>
                  </li>
                </ul>
              )}
            </div>
          )}

          {/* Grid produse */}
          {products.length > 0 ? (
            <>
              {/* Titlul de sectiune pentru cititoarele de ecran: cardurile au <h3> (ierarhie corecta) */}
              <h2 className="sr-only">Produse</h2>
              <div className={`grid grid-cols-2 sm:grid-cols-3 gap-3 ${showFilters ? 'xl:grid-cols-4' : 'lg:grid-cols-4'}`}>
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
          ) : randomProducts.length > 0 ? (
            <div>
              <h2 className="sr-only">Produse</h2>
              <span className="text-xs font-semibold text-muted uppercase tracking-wide">
                Selecție aleatorie din subcategorii
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mt-2">
                {randomProducts.map(product => (
                  <ProductCard key={product.offer_id} product={product} />
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-16 text-muted">
              <p className="text-5xl mb-4">📦</p>
              <p>
                Niciun produs găsit
                {selectedBrands.length === 1 ? ` pentru marca ${selectedBrands[0]}` : selectedBrands.length > 1 ? ' pentru mărcile selectate' : ''}.
              </p>
              {selectedBrands.length > 0 && (
                <a href={buildListingUrl(basePath, { sort: sortValue, brands: [], tot: includeSub })} className="mt-3 inline-block text-sm text-red-ink hover:underline">
                  Șterge filtrul de marcă
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Text + întrebări frecvente (pachetul SEO B, migrația 030) — doar pe pagina 1 fără filtre,
          ca variantele ?page / ?brand / ?sort / ?tot să nu repete același text */}
      {currentPage === 1 && selectedBrands.length === 0 && sortValue === 'price' && !includeSub && (
        <CategoryContent slug={categorie} name={label} />
      )}
    </>
  )
}
