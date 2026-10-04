import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getCategoryProducts, getCategoryProductCount, getCategoryBrands, getCategoryBySlug, getSubcategories, getRandomCategoryProducts, PAGE_SIZE } from '@/lib/queries'
import { X } from 'lucide-react'
import { ProductList } from '@/components/listing/ProductList'
import { EmptyState, ListInfo, ListingHeader, MethodNote } from '@/components/listing/ListingParts'
import { getCategoryStats } from '@/lib/category-content'
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
import { absUrl, lowerFirst, roCount } from '@/lib/seo/site'

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

  // Cifrele din antet, pentru toată categoria (cu subcategoriile): aceeași interogare ca textul
  // de sub listă (getCategoryStats, cache 1 h) — „M cu reducere reală” = exact regula de pe
  // /reduceri-reale/. Fără Sănătate & Naturale (regula 8: fără landing de reduceri acolo).
  const excludedFromAds = isExcludedFromAds(category.slug, category.parent_slug)
  const stats = await getCategoryStats(categorie).catch(() => null)
  const headerCount = stats?.produse ?? unfilteredCount
  const realCount = !excludedFromAds ? stats?.reduceri ?? null : null

  const productWord = (n: number) => roCount(n, 'produse', 'produs')
  // Numărul de produse al VEDERII curente (cu filtrele de marcă / „vezi tot”) + pagina
  const countText = `${productWord(totalCount)}${includeSub && hasChildren ? ' (inclusiv subcategoriile)' : ''}` +
    (totalPages > 1 ? ` · pagina ${currentPage} din ${totalPages}` : '')
  // Jetoanele de „categorii înrudite” n-au rost când singura soră e chiar categoria curentă
  const showSubNav = navSubs.length > 0 && !(navSubs.length === 1 && navSubs[0].slug === categorie)

  return (
    <>
      {products.length > 0 && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />

      <ListingHeader
        crumbs={[
          { label: 'Acasă', href: '/' },
          ...(category.parent_slug ? [{ label: category.parent_name!, href: `/c/${category.parent_slug}` }] : []),
          { label },
        ]}
        title={label}
      >
        {showRandomFallback ? (
          <p>Alege o subcategorie mai jos sau răsfoiește o selecție din toate.</p>
        ) : (
          <p className="tabular-nums">
            {productWord(headerCount)}
            {realCount != null && realCount > 0 && (
              <>
                {' · '}
                <Link href={`/reduceri-reale/${categorie}`} className="font-bold text-red-ink hover:underline underline-offset-2">
                  {realCount.toLocaleString('ro-RO')} cu reducere reală azi
                </Link>
              </>
            )}
          </p>
        )}
        {/* Legătura internă spre landing-ul de reduceri reale (fără Sănătate & Naturale — regula 8) */}
        {!excludedFromAds && (realCount == null || realCount === 0) && (
          <Link href={`/reduceri-reale/${categorie}`} className="mt-1 inline-block font-semibold text-red-ink hover:underline underline-offset-2">
            Vezi doar reducerile reale la {lowerFirst(label)} →
          </Link>
        )}
      </ListingHeader>

      {/* Navigare subcategorii: carduri spre copii (pe părinte) sau jetoane spre surori (pe copil) */}
      {showSubNav && (
        <nav aria-label={hasChildren ? 'Subcategorii' : 'Categorii înrudite'} className="mb-4">
          <h2 className="mb-2 font-sans text-xs font-bold uppercase tracking-[.08em] text-ink-3 [font-stretch:100%]">
            {hasChildren ? 'Alege o subcategorie' : 'Categorii înrudite'}
          </h2>
          {hasChildren ? (
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {navSubs.map(sub => (
                <li key={sub.slug}>
                  <Link
                    href={`/c/${sub.slug}`}
                    className="flex h-full items-center gap-2.5 rounded-xl bg-surface px-3 py-2.5 shadow-card ring-1 ring-inset ring-line/60 transition-shadow hover:ring-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
                  >
                    <CategoryIcon name={sub.icon} className="h-5 w-5 shrink-0 text-ink-2" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-ink">{sub.name}</span>
                      <span className="block text-xs tabular-nums text-ink-3">{productWord(sub.count)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <ul className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0">
              {navSubs.map(sub => {
                const active = sub.slug === categorie
                return (
                  <li key={sub.slug} className="shrink-0">
                    <Link
                      href={`/c/${sub.slug}`}
                      aria-current={active ? 'page' : undefined}
                      className={`inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[13px] font-semibold transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 ${
                        active ? 'bg-ink text-page' : 'bg-surface text-ink ring-1 ring-inset ring-line-2 hover:ring-ink'
                      }`}
                    >
                      {sub.name}
                      <span className={`tabular-nums text-xs font-medium ${active ? 'opacity-75' : 'text-ink-3'}`}>{sub.count.toLocaleString('ro-RO')}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
          {hasChildren && (
            <a href={buildTotUrl(!includeSub)} className="mt-2.5 inline-block text-sm font-semibold text-ink underline underline-offset-[3px] hover:text-red-ink">
              {includeSub ? `Vezi doar „${label}”` : 'Vezi tot, inclusiv subcategoriile'}
            </a>
          )}
        </nav>
      )}

      {/* Fără JavaScript butonul „Filtre” de pe mobil nu deschide nimic → arătăm coloana și pe
          ecranele mici (deasupra listei), ca filtrul să rămână folosibil */}
      {showFilters && (
        <noscript>
          <style>{'#filtre-categorie{display:block;margin-bottom:1rem}'}</style>
        </noscript>
      )}

      <div className={showFilters ? 'lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-6 lg:items-start' : ''}>
        {/* Coloana „Filtre” (desktop). Lipicioasă sub antet, cu scroll propriu dacă lista de mărci
            e mai înaltă decât ecranul. */}
        {showFilters && (
          <aside
            id="filtre-categorie"
            aria-label="Filtre"
            className="hidden lg:block lg:sticky lg:top-[7.5rem] lg:max-h-[calc(100dvh-8.5rem)] lg:overflow-y-auto lg:overscroll-contain rounded-2xl bg-surface p-4 shadow-card ring-1 ring-inset ring-line/60"
          >
            <h2 className="mb-3 text-lg font-extrabold text-ink">Filtre</h2>
            <BrandFilter key={filterKey} {...filterProps} mode="sidebar" />
          </aside>
        )}

        <div className="min-w-0">
          {!showRandomFallback && (
            <>
              {/* Bara „Filtre / Sortare” (macheta „.toolbar”): pe mobil lipită sub antet, de la o
                  margine la alta; pe desktop un rând simplu cu numărul de produse și sortarea */}
              <div className="sticky top-14 z-20 -mx-4 flex items-center gap-2 border-b border-line bg-page px-4 py-2 lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0 lg:pt-0 lg:pb-3">
                <p className="mr-auto hidden text-sm tabular-nums text-ink-3 lg:block" aria-live="polite">
                  {countText}
                </p>
                {showFilters && <MobileFilters key={filterKey} {...filterProps} />}
                <SortSelect key={`${sortValue}|${filterKey}|${includeSub}`} basePath={basePath} sort={sortValue} brands={selectedBrands} tot={includeSub} />
              </div>

              {/* Mărcile bifate, ca jetoane care se scot dintr-o atingere (macheta „.chips”) */}
              {selectedBrands.length > 0 && (
                <ul className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pt-2.5 pb-1 [scrollbar-width:none] lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0 lg:pt-0 lg:pb-3" aria-label="Mărci selectate">
                  {selectedBrands.map(b => (
                    <li key={b} className="shrink-0">
                      <Link
                        href={withoutBrand(b)}
                        scroll={false}
                        aria-label={`Scoate marca ${b}`}
                        className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full bg-ink px-3 text-[13px] font-semibold text-page transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
                      >
                        {b} <X size={14} aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                  {/* pe desktop „Șterge filtrele” e deja în coloană */}
                  <li className={`shrink-0 ${showFilters ? 'lg:hidden' : ''}`}>
                    <Link
                      href={buildListingUrl(basePath, { sort: sortValue, brands: [], tot: includeSub })}
                      scroll={false}
                      className="inline-flex h-8 items-center whitespace-nowrap rounded-full bg-surface px-3 text-[13px] font-semibold text-ink ring-1 ring-inset ring-line-2 hover:ring-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
                    >
                      Șterge filtrele
                    </Link>
                  </li>
                </ul>
              )}

              <div className="lg:hidden">
                <ListInfo>{countText}</ListInfo>
              </div>
              {products.length > 0 && <MethodNote className="mb-3 mt-1 lg:mt-0" />}
            </>
          )}

          {products.length > 0 ? (
            <>
              {/* Titlul de secțiune pentru cititoarele de ecran: cardurile au <h3> (ierarhie corectă) */}
              <h2 className="sr-only">Produse</h2>
              <ProductList products={products} withSidebar={showFilters} />
              <Pagination currentPage={currentPage} totalPages={totalPages} buildUrl={buildUrl} />
            </>
          ) : randomProducts.length > 0 ? (
            <div>
              <h2 className="mb-2 mt-2 font-sans text-xs font-bold uppercase tracking-[.08em] text-ink-3 [font-stretch:100%]">
                Selecție aleatorie din subcategorii
              </h2>
              <MethodNote className="mb-3" />
              <ProductList products={randomProducts} />
            </div>
          ) : (
            <EmptyState
              title={<>Niciun produs găsit{selectedBrands.length === 1 ? ` pentru marca ${selectedBrands[0]}` : selectedBrands.length > 1 ? ' pentru mărcile selectate' : ''}.</>}
            >
              {selectedBrands.length > 0 && (
                <a href={buildListingUrl(basePath, { sort: sortValue, brands: [], tot: includeSub })} className="font-semibold text-ink underline underline-offset-[3px] hover:text-red-ink">
                  Șterge filtrul de marcă
                </a>
              )}
            </EmptyState>
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
