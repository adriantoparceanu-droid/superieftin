import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { getProductDetail, getPriceHistory, getHistoryStart, getAllProductSlugs } from '@/lib/queries'
import { calculateDiscount, formatPrice, formatVerified } from '@/lib/discount'
import { TrackViewItem } from '@/components/analytics/TrackViewItem'
import { getGuidesForProduct } from '@/lib/guides/queries'
import { suggestAlertTarget } from '@/lib/price-alert'
import { emailAlertsEnabled } from '@/lib/email-alerts'
import { breadcrumbLd, ldScript, productLd } from '@/lib/seo/jsonld'
import { priceFactRows, variantBase, historyPartialSince, historyTitle, historyChartPhrase } from '@/lib/seo/product-facts'
import { addDays, dailyLowSeries, roDay } from '@/lib/price-series'
import { verdictCopy } from '@/lib/verdict'
import { VerdictCard } from '@/components/product/VerdictCard'
import { OfferList } from '@/components/product/OfferList'
import { PriceStepChart } from '@/components/product/PriceStepChart'
import { PriceAlertCard } from '@/components/product/PriceAlertCard'
import { PriceFacts } from '@/components/product/PriceFacts'
import { StickyBuyBar } from '@/components/product/StickyBuyBar'
import { getProductVariants, getSimilarProducts, type ProductLink } from '@/lib/seo/queries'
import { withOg } from '@/lib/seo/og'
import { absUrl } from '@/lib/seo/site'
import { productIndexDecision } from '@/lib/seo/product-index'

export const revalidate = 3600

type Props = { params: Promise<{ slug: string }> }

export const dynamicParams = true

export async function generateStaticParams() {
  try {
    const slugs = await getAllProductSlugs()
    return slugs.map(({ slug }) => ({ slug }))
  } catch {
    return []
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const product = await getProductDetail(slug)
  if (!product) return { title: 'Produs negăsit' }

  const bestOffer = product.offers[0]
  const price = bestOffer?.current_price
  // offers[0] = cea mai ieftina oferta DISPONIBILA acum (query-ul sorteaza dupa pret).
  // Nu scriem „cel mai mic preț”: poate fi citit ca minim istoric, ceea ce nu e mereu adevarat
  // (afirmatiile din reclame trebuie sa fie adevarate pe pagina — REGULI.md, regula 9).
  const titlePrice = price ? ` — preț azi de la ${formatPrice(price)}` : ''
  const title = `${product.name}${titlePrice}`
  // Un fapt verificabil in descriere (mediana), fara cuvantul „reducere” (raport SEO, A4)
  const median = bestOffer?.median_price
  // Produs urmarit de mai putin de 90 de zile → „istoricul prețului de la <data>”, nu „pe 90 de zile”
  const historyStart = await getHistoryStart(product.id).catch(() => null)
  const partialSince = historyPartialSince(historyStart)
  const description = `Prețul curent pentru ${product.name} la ${bestOffer?.retailer_name || 'magazine online'}` +
    (median ? `; mediana ultimelor 30 de zile: ${formatPrice(median)}` : '') +
    '. ' + historyChartPhrase(partialSince)

  // Regula de indexare (decizia SEO din 5 oct. 2026, lib/seo/product-index.ts): oferta disponibila
  // + urmarit de cel putin 30 de zile + categorie mapata si vizibila + nu Sanatate & Naturale.
  // Altfel pagina ramane pentru vizitatori (pret, oferte, alerta), dar cu noindex, follow.
  // Fara nicio oferta disponibila, dupa PRODUCT_GONE_DAYS raspunde 410 (src/proxy.ts) — neschimbat.
  // Daca istoricul nu se poate citi (DB), historyStart = null → noindex: mai bine o zi fara
  // index decat o pagina subtire indexata.
  const { indexable } = productIndexDecision({
    availableOffers: product.offers.length,
    historyStart,
    categoryId: product.category_id,
    categorySlug: product.category_slug,
    categoryVisible: product.category_visible,
    parentSlug: product.parent_slug,
    parentVisible: product.parent_visible,
  })

  return {
    title,
    description,
    alternates: { canonical: `/p/${slug}` },
    ...(indexable ? {} : { robots: { index: false, follow: true } }),
    openGraph: withOg({
      title,
      description,
      url: absUrl(`/p/${slug}`),
      images: product.image_url ? [{ url: product.image_url, alt: product.name }] : [],
    }),
  }
}

// Lista compacta de produse (doar nume + pret, fara verdict/procente — regula 9), pentru
// „Alte variante” si „Produse similare”: legaturi interne, ca pagina de produs sa nu fie o fundatura.
function ProductLinks({ title, items }: { title: string; items: ProductLink[] }) {
  if (!items.length) return null
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-lg font-extrabold text-ink">{title}</h2>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => (
          <li key={it.id}>
            <Link
              href={`/p/${it.slug}`}
              className="flex items-baseline justify-between gap-3 rounded-xl bg-surface px-3.5 py-2.5 shadow-card ring-1 ring-inset ring-transparent transition-shadow hover:ring-line-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <span className="line-clamp-2 text-sm text-ink">{it.name}</span>
              <span className="whitespace-nowrap font-display text-sm font-extrabold tabular-nums text-ink">{formatPrice(it.price)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

// Cardurile de sub primul ecran (macheta: .blk). Pe desktop, ofertele + alerta stau într-o
// singură coloană lipicioasă, deci acolo cardul își pierde fundalul (îl are coloana).
const card = 'rounded-2xl bg-surface p-3.5 shadow-card'
const cardInAside = 'lg:rounded-none lg:bg-transparent lg:p-0 lg:shadow-none'

const CONDITION_LABEL: Record<string, string> = { refurbished: 'Refurbished', 'second-hand': 'Second hand' }

export default async function ProductPage({ params }: Props) {
  const { slug } = await params
  const product = await getProductDetail(slug)
  const [history, trackedSince] = product
    ? await Promise.all([getPriceHistory(product.id), getHistoryStart(product.id).catch(() => null)])
    : [[], null]

  if (!product) notFound()
  const bestOffer = product.offers[0]

  // „Alte variante” (aceeasi baza de nume, ex. alte culori) + „Produse similare” (aceeasi categorie,
  // pret apropiat) — query-uri ieftine, cu cache (lib/seo/queries.ts). Doar pentru produsele cu
  // categorie si, la „similare”, cu un pret de azi.
  const base = variantBase(product.name)
  // Ghidurile publicate care leaga produsul (legatura interna produs ↔ ghid)
  const [guides, variants, similar] = await Promise.all([
    getGuidesForProduct(product.id),
    product.category_id && base
      ? getProductVariants(product.id, product.category_id, base).catch(() => [] as ProductLink[])
      : Promise.resolve([] as ProductLink[]),
    product.category_id && bestOffer?.current_price
      ? getSimilarProducts(product.id, product.category_id, product.brand, bestOffer.current_price, base).catch(() => [] as ProductLink[])
      : Promise.resolve([] as ProductLink[]),
  ])

  const discountInfo = bestOffer ? calculateDiscount(bestOffer.current_price, bestOffer.median_price) : null
  const copy = discountInfo && bestOffer ? verdictCopy(discountInfo, bestOffer.median_price) : null

  // Alerta de pret = actiunea secundara principala, langa „Vezi oferta” (decizia 2026-10-03).
  // Pragul propus: 5% sub min(pret azi, mediana 30 de zile) — lib/price-alert.ts; vizitatorul
  // poate scrie orice suma (cardul PriceAlertCard). Alerta e pe PRODUS: merge si fara oferte.
  const botUsername = process.env.TELEGRAM_BOT_USERNAME || null
  const alertTarget = bestOffer ? suggestAlertTarget(bestOffer.current_price, bestOffer.median_price) : null
  // Alerte pe email (double opt-in) — doar daca SMTP + secretul linkurilor sunt configurate
  const emailEnabled = emailAlertsEnabled()
  const hasAlert = Boolean(botUsername) || emailEnabled

  // JSON-LD (raport SEO, A4): Product cu AggregateOffer, Offer.url = pagina (nu /go/), sku/mpn/gtin,
  // itemCondition din tag-uri; fara oferte disponibile → fara Product (pagina e oricum noindex).
  // ATENTIE: ads:validate / ads-guard citesc acest marcaj (vezi lib/seo/jsonld.ts).
  const jsonLd = productLd({
    id: product.id,
    name: product.name,
    slug,
    image: product.image_url,
    brand: product.brand,
    partNo: product.part_no,
    tags: product.tags,
    offers: product.offers.map((o) => ({ price: o.current_price, retailer: o.retailer_name })),
  })

  // Breadcrumb cu numele categoriei si parintele ei (nu slug-ul)
  const categoryName = product.category_name ?? product.category.replace(/-/g, ' ')
  const breadcrumb = breadcrumbLd([
    { name: 'Acasă', path: '/' },
    ...(product.parent_slug && product.parent_name ? [{ name: product.parent_name, path: `/c/${product.parent_slug}` }] : []),
    { name: categoryName, path: `/c/${product.category}` },
    { name: product.name, path: `/p/${slug}` },
  ])

  // Seria „cel mai mic pret pe zi” (graficul + „Pe scurt”): doar ofertele disponibile azi, din
  // istoricul deja incarcat (90 de zile) — lib/price-series.ts.
  const series = dailyLowSeries(history, {
    offerIds: product.offers.map((o) => o.offer_id),
    todayPrice: bestOffer?.current_price ?? null,
  })
  // Fereastra afisata: de la prima inregistrare a produsului (regula „90 de zile doar cu 90+ zile
  // de date”). Daca seria magazinelor de azi incepe vizibil mai tarziu (un magazin nou), pornim de
  // acolo — niciodata nu sugeram mai multe date decat are graficul.
  const seriesStart = series[0]?.day ?? null
  const historyStart0 = trackedSince ?? history[0]?.recorded_at ?? null
  const historyStart = seriesStart
    && seriesStart > addDays(roDay(new Date()), -88)
    && (!historyStart0 || seriesStart > addDays(roDay(historyStart0), 1))
    ? `${seriesStart}T12:00:00Z`
    : historyStart0
  const facts = priceFactRows({
    series,
    todayPrice: bestOffer?.current_price ?? null,
    offerPrices: product.offers.map((o) => o.current_price).filter((p): p is number => p != null),
    trackedSince: historyStart,
  })

  const condition = product.tags.map((t) => CONDITION_LABEL[t]).find(Boolean)
  const details: [string, React.ReactNode][] = [
    ...(product.brand ? [['Marcă', product.brand] as [string, React.ReactNode]] : []),
    ...(product.part_no ? [['Cod producător', <span key="c" className="break-all">{product.part_no}</span>] as [string, React.ReactNode]] : []),
    ['Categorie', <Link key="cat" href={`/c/${product.category}`} className="underline-offset-2 hover:underline capitalize">{categoryName}</Link>],
    ...(condition ? [['Stare', condition] as [string, React.ReactNode]] : []),
  ]

  return (
    <>
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldScript(jsonLd) }} />}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldScript(breadcrumb) }} />
      <TrackViewItem
        item={{
          item_name: product.name,
          item_category: product.category,
          item_brand: product.brand,
          price: product.offers[0]?.current_price ?? null,
        }}
        value={product.offers[0]?.current_price ?? null}
      />

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="-mt-2 mb-2.5 flex items-center gap-1.5 overflow-hidden whitespace-nowrap text-[12.5px] text-ink-3">
        <Link href="/" className="hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded">Acasă</Link>
        {product.parent_slug && product.parent_name && (
          <>
            <span aria-hidden="true">›</span>
            <Link href={`/c/${product.parent_slug}`} className="hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded">{product.parent_name}</Link>
          </>
        )}
        <span aria-hidden="true">›</span>
        <Link href={`/c/${product.category}`} className="capitalize hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded">{categoryName}</Link>
        <span aria-hidden="true" className="hidden lg:inline">›</span>
        <span className="hidden min-w-0 truncate text-ink-2 lg:inline">{product.name}</span>
      </nav>

      {/* Ordinea pe mobil (design §4): titlu · verdict · oferte · istoric · alertă · pe scurt ·
          detalii. Pe desktop: 3 coloane (imagine + detalii · titlu + verdict · oferte lipicioase cu
          alerta), dedesubt graficul lângă „Pe scurt”. Un singur DOM: pe mobil coloanele sunt
          `contents` și copiii se așază după `order-*`; pe desktop coloanele devin blocuri în grilă. */}
      <div className="flex flex-col gap-3.5 lg:block">
        <div className="contents lg:grid lg:grid-cols-[280px_minmax(0,1fr)_360px] lg:items-start lg:gap-6 xl:grid-cols-[300px_minmax(0,1fr)_380px]">

          {/* Coloana 2: titlu + verdict */}
          <div className="contents lg:col-start-2 lg:row-start-1 lg:flex lg:flex-col lg:gap-3.5">
            <header className="order-1 flex items-start gap-3">
              <div className="relative h-[76px] w-[76px] shrink-0 overflow-hidden rounded-xl border border-line bg-white lg:hidden">
                {product.image_url ? (
                  <Image src={product.image_url} alt="" fill sizes="76px" className="object-contain p-1.5" unoptimized priority />
                ) : (
                  <span aria-hidden="true" className="absolute inset-0 grid place-items-center text-3xl">📦</span>
                )}
              </div>
              <div className="min-w-0">
                {product.brand && <div className="text-[11.5px] font-bold uppercase tracking-[.08em] text-ink-3">{product.brand}</div>}
                <h1 className="mt-0.5 text-[19px] font-extrabold leading-[1.22] text-ink lg:text-[28px] lg:leading-[1.15]">{product.name}</h1>
              </div>
            </header>

            <div className="order-2">
              {bestOffer ? (
                <VerdictCard offer={bestOffer} offerCount={product.offers.length} />
              ) : (
                // Produs indisponibil: fara oferte (lib/availability.ts) → pagina noindex; alerta ramane
                <section className="relative overflow-hidden rounded-2xl bg-surface p-4 shadow-card">
                  <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[5px] bg-line-2" />
                  <p className="text-xs font-bold uppercase tracking-[.08em] text-ink-3">Merită acum?</p>
                  <h2 className="mt-1.5 font-display text-[26px] font-black leading-tight text-ink-2" style={{ fontStretch: '84%' }}>
                    Momentan indisponibil
                  </h2>
                  <p className="mt-1.5 text-[14.5px] text-ink-2">
                    Nu e disponibil la magazinele monitorizate.{' '}
                    {product.last_seen ? `Ultima dată l-am găsit ${formatVerified(product.last_seen).replace(/^Verificat /, '')}. ` : ''}
                    {hasAlert ? 'Setează o alertă de preț și te anunțăm când reapare la prețul dorit.' : ''}
                  </p>
                </section>
              )}
            </div>

            {guides.length > 0 && (
              <section className={`order-8 ${card}`}>
                <h2 className="text-lg font-extrabold text-ink">Ghiduri despre acest produs</h2>
                <ul className="mt-1.5 space-y-1 text-sm">
                  {guides.map((g) => (
                    <li key={g.slug}>
                      <Link href={`/ghiduri/${g.slug}`} className="font-semibold text-red-ink hover:underline">{g.title}</Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          {/* Coloana 3 (desktop: lipicioasă): ofertele + alerta */}
          <aside
            aria-label="Prețuri și alertă"
            className="contents lg:sticky lg:top-[132px] lg:col-start-3 lg:row-start-1 lg:block lg:rounded-2xl lg:bg-surface lg:px-[18px] lg:py-4 lg:shadow-card"
          >
            {bestOffer && (
              <section id="oferte" aria-labelledby="oferte-titlu" className={`order-3 ${card} ${cardInAside}`}>
                <h2 id="oferte-titlu" className="text-lg font-extrabold text-ink lg:text-[19px]">
                  {product.offers.length > 1 ? `Prețuri în ${product.offers.length} magazine` : 'Prețul de azi'}
                </h2>
                <p className="mb-1 mt-0.5 text-[12.5px] text-ink-3">
                  {product.offers.length > 1
                    ? 'Procentul e față de mediana pe 30 de zile a fiecărui magazin.'
                    : 'Procentul e față de mediana pe 30 de zile a magazinului.'}
                </p>
                <OfferList offers={product.offers} productId={product.id} productName={product.name} category={product.category} />
                {/* Nota de afiliere — langa linkuri */}
                <p className="mt-2 border-t border-line pt-2.5 text-xs text-ink-3">
                  superieftin.ro folosește linkuri de afiliere. Dacă cumperi prin linkurile noastre,
                  primim un comision mic din partea retailerului, fără cost suplimentar pentru tine.
                </p>
              </section>
            )}
            {hasAlert && (
              <PriceAlertCard
                productId={product.id}
                offerId={bestOffer?.offer_id ?? product.alert_offer_id}
                category={product.category}
                todayPrice={bestOffer?.current_price ?? null}
                suggested={alertTarget}
                telegramBot={botUsername}
                emailEnabled={emailEnabled}
                className={`${bestOffer ? 'order-5' : 'order-3'} ${card} ${cardInAside} ${bestOffer ? 'lg:mt-1.5 lg:border-t lg:border-line lg:pt-3.5' : ''}`}
              />
            )}
          </aside>

          {/* Coloana 1: imaginea (doar desktop; pe mobil e miniatura din titlu) + detalii */}
          <div className="contents lg:col-start-1 lg:row-start-1 lg:flex lg:flex-col lg:gap-3.5">
            <div className="relative hidden aspect-square overflow-hidden rounded-2xl bg-white shadow-card lg:block">
              {product.image_url ? (
                <Image src={product.image_url} alt={product.name} fill sizes="300px" className="object-contain p-6" unoptimized priority />
              ) : (
                <span aria-hidden="true" className="absolute inset-0 grid place-items-center text-7xl">📦</span>
              )}
            </div>
            <section className={`order-7 ${card} lg:rounded-none lg:bg-transparent lg:p-0 lg:shadow-none`}>
              <h2 className="text-lg font-extrabold text-ink lg:sr-only">Detalii produs</h2>
              <table className="mt-1.5 w-full border-collapse text-sm">
                <tbody>
                  {details.map(([k, v], i) => (
                    <tr key={k} className={i ? 'border-t border-line' : ''}>
                      <th scope="row" className="w-[44%] py-2 pr-2 text-left align-top font-medium text-ink-3">{k}</th>
                      <td className="py-2 font-semibold text-ink">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
        </div>

        {/* Dedesubt: graficul + „Pe scurt despre preț” */}
        <div className="contents lg:mt-6 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <section aria-labelledby="istoric-titlu" className={`order-4 ${card} lg:px-5 lg:py-[18px]`}>
            <h2 id="istoric-titlu" className="flex flex-wrap items-baseline justify-between gap-x-2 text-lg font-extrabold text-ink lg:text-xl">
              {historyTitle(historyPartialSince(historyStart))}
              <small className="font-sans text-[12.5px] font-medium tracking-normal text-ink-3">cel mai mic preț pe zi{product.offers.length > 1 ? ', toate magazinele' : ''}</small>
            </h2>
            <PriceStepChart
              series={series}
              median={bestOffer?.median_price ?? null}
              verdict={discountInfo?.verdict ?? 'no-data'}
              endsToday={Boolean(bestOffer)}
            />
          </section>
          {/* Fraze factuale despre pret (citabile de motoare si asistenti AI): fara verdict, fara
              promisiuni — regula 9. */}
          {facts.length > 0 && (
            <section aria-labelledby="pe-scurt-titlu" className={`order-6 ${card} lg:px-5 lg:py-[18px]`}>
              <h2 id="pe-scurt-titlu" className="text-lg font-extrabold text-ink lg:text-xl">Pe scurt despre preț</h2>
              <PriceFacts rows={facts} />
            </section>
          )}
        </div>
      </div>

      <ProductLinks title="Alte variante" items={variants} />
      <ProductLinks title="Produse similare" items={similar} />

      {/* Bara fixa de pe mobil — doar cand exista o oferta de deschis */}
      {bestOffer && copy && (
        <StickyBuyBar
          offer={{
            offerId: bestOffer.offer_id,
            productId: product.id,
            productName: product.name,
            merchantName: bestOffer.retailer_name,
            price: bestOffer.current_price,
            category: product.category,
            discountPct: discountInfo?.verdict === 'real' ? discountInfo.discountPct : null,
          }}
          verdict={copy.verdict}
          verdictShort={copy.short}
          hasAlert={hasAlert}
        />
      )}
    </>
  )
}
