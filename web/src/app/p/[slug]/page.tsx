import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { getProductDetail, getPriceHistory, getAllProductSlugs } from '@/lib/queries'
import { calculateDiscount, formatPrice, formatPct, medianDeltaText } from '@/lib/discount'
import { PriceHistoryChart } from '@/components/PriceHistoryChart'
import { PriceTag } from '@/components/PriceTag'
import { VerdictBadge } from '@/components/VerdictBadge'
import { Sparkline } from '@/components/Sparkline'
import { TrackViewItem } from '@/components/analytics/TrackViewItem'
import { AffiliateLink } from '@/components/analytics/AffiliateLink'

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
  const titlePrice = price ? ` — cel mai mic preț: ${formatPrice(price)}` : ''
  const title = `${product.name}${titlePrice}`
  const description = `Prețul curent pentru ${product.name} la ${bestOffer?.retailer_name || 'magazine online'}. Grafic de preț și analiză reducere reală față de ultimele 30 de zile.`

  return {
    title,
    description,
    alternates: { canonical: `/p/${slug}` },
    openGraph: {
      title,
      description,
      images: product.image_url ? [{ url: product.image_url, alt: product.name }] : [],
    },
  }
}

function formatVerified(isoDate: string) {
  const diffH = Math.floor((Date.now() - new Date(isoDate).getTime()) / 3600000)
  if (diffH < 1) return 'Verificat azi'
  if (diffH < 24) return `Verificat acum ${diffH} ${diffH === 1 ? 'oră' : 'ore'}`
  return 'Verificat azi'
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params
  const product = await getProductDetail(slug)
  const history = product ? await getPriceHistory(product.id) : []

  if (!product) notFound()

  const bestOffer = product.offers[0]
  const discountInfo = bestOffer
    ? calculateDiscount(bestOffer.current_price, bestOffer.median_price)
    : null

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.superieftin.ro'

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    image: product.image_url,
    brand: product.brand ? { '@type': 'Brand', name: product.brand } : undefined,
    category: product.category,
    offers: product.offers
      .filter(o => o.current_price != null)
      .map(o => ({
        '@type': 'Offer',
        price: o.current_price,
        priceCurrency: 'RON',
        availability: o.in_stock
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
        seller: { '@type': 'Organization', name: o.retailer_name },
        url: `${siteUrl}/go/${o.offer_id}`,
      })),
  }

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Acasă', item: siteUrl },
      { '@type': 'ListItem', position: 2, name: product.category.replace(/-/g, ' '), item: `${siteUrl}/c/${product.category}` },
      { '@type': 'ListItem', position: 3, name: product.name, item: `${siteUrl}/p/${slug}` },
    ],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
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
      <nav className="text-sm text-muted mb-6 flex gap-1.5 items-center flex-wrap">
        <Link href="/" className="hover:text-[var(--color-text)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 rounded">Acasă</Link>
        <span>/</span>
        <Link href={`/c/${product.category}`} className="hover:text-[var(--color-text)] transition-colors capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 rounded">
          {product.category.replace(/-/g, ' ')}
        </Link>
        <span>/</span>
        <span className="text-[var(--color-text)] truncate max-w-xs">{product.name}</span>
      </nav>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Coloana stanga: imagine + verdict */}
        <div className="space-y-4">
          <div className="bg-surface rounded-lg border border-line aspect-square relative overflow-hidden">
            {product.image_url ? (
              <Image
                src={product.image_url}
                alt={product.name}
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-contain p-8"
                unoptimized
                priority
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-[var(--color-line)] text-8xl">
                📦
              </div>
            )}
          </div>

          {/* Verdict reducere reala */}
          {/* Pragurile: lib/discount.ts (±5% fata de mediana 30 de zile) */}
          {discountInfo && (
            <div className="rounded-lg border border-line bg-surface p-4">
              {discountInfo.verdict === 'real' && (
                <>
                  <div className="mb-1"><VerdictBadge discountPct={discountInfo.discountPct} /></div>
                  <p className="font-semibold text-[var(--color-text)]">
                    Reducere reală: {formatPct(discountInfo.discountPct ?? 0)}% sub mediana de 30 de zile
                  </p>
                  <p className="text-sm text-muted mt-1">
                    Comparăm prețul de azi cu mediana prețurilor din ultimele 30 de zile, nu cu
                    „prețul vechi” afișat de magazin.
                  </p>
                </>
              )}
              {discountInfo.verdict === 'normal' && (
                <p className="font-semibold text-[var(--color-text)]">
                  Preț în intervalul obișnuit
                  <span className="font-normal text-muted"> ({medianDeltaText(discountInfo.discountPct)})</span>
                </p>
              )}
              {discountInfo.verdict === 'higher' && (
                <>
                  <p className="font-semibold text-[var(--color-text)]">
                    Preț cu {formatPct(discountInfo.discountPct ?? 0)}% peste mediana de 30 de zile
                  </p>
                  <p className="text-sm text-muted mt-1">
                    E mai scump decât de obicei — îți recomandăm alerta de preț, ca să afli când scade.
                  </p>
                </>
              )}
              {discountInfo.verdict === 'no-data' && (
                <p className="text-sm text-muted">Istoric insuficient pentru verificare</p>
              )}
            </div>
          )}
        </div>

        {/* Coloana dreapta: detalii + oferte */}
        <div className="space-y-6">
          <div>
            {product.brand && (
              <span className="text-xs text-muted uppercase tracking-wide">{product.brand}</span>
            )}
            <h1 className="text-xl font-black font-archivo text-[var(--color-text)] mt-1 leading-snug">{product.name}</h1>
          </div>

          {/* Oferte per retailer */}
          <div className="space-y-3">
            <h2 className="font-semibold text-[var(--color-text)]">Prețuri per magazin</h2>
            {product.offers.map((offer) => {
              const offerDiscount = calculateDiscount(offer.current_price, offer.median_price)
              return (
                <div
                  key={offer.offer_id}
                  className="bg-surface rounded-lg border border-line p-4 flex items-center gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-[var(--color-text)] capitalize">{offer.retailer_name}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {!offer.in_stock && (
                        <span className="text-xs text-muted">Indisponibil</span>
                      )}
                      {offer.last_checked && (
                        <span className="text-xs text-muted">{formatVerified(offer.last_checked)}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <PriceTag price={offer.current_price} discountPct={offerDiscount.verdict === 'real' ? offerDiscount.discountPct : null} />
                  </div>
                  <AffiliateLink
                    offerId={offer.offer_id}
                    productName={product.name}
                    merchantName={offer.retailer_name}
                    price={offer.current_price}
                    category={product.category}
                    className="shrink-0 bg-yellow-400 hover:bg-yellow-500 text-gray-900 text-sm font-semibold px-4 py-2 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                  >
                    Cumpără la {offer.retailer_name} →
                  </AffiliateLink>
                </div>
              )
            })}
          </div>

          {/* Buton alerta Telegram */}
          {process.env.TELEGRAM_BOT_USERNAME && (
            <a
              href={`https://t.me/${process.env.TELEGRAM_BOT_USERNAME}?start=offer_${bestOffer?.offer_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full border border-line rounded-lg py-2.5 text-sm font-semibold text-[var(--color-text)] hover:border-brand hover:text-brand transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
            >
              🔔 Alertă de preț
            </a>
          )}

          {/* Nota de afiliere */}
          <p className="text-xs text-muted">
            superieftin.ro folosește linkuri de afiliere. Dacă cumperi prin linkurile noastre,
            primim un comision mic din partea retailerului, fără cost suplimentar pentru tine.
          </p>

          {/* Grafic istoric pret */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-[var(--color-text)]">Istoricul prețului (90 de zile)</h2>
              {history.length >= 2 && (
                <Sparkline
                  points={Object.values(
                    history.reduce<Record<string, number>>((acc, d) => {
                      const day = d.recorded_at.slice(0, 10)
                      acc[day] = acc[day] === undefined ? d.price : Math.min(acc[day], d.price)
                      return acc
                    }, {})
                  )}
                  belowMedian={discountInfo?.verdict === 'real'}
                />
              )}
            </div>
            <div className="bg-surface rounded-lg border border-line p-4">
              <PriceHistoryChart
                data={history}
                currentPrice={bestOffer?.current_price ?? null}
                medianPrice={bestOffer?.median_price ?? null}
              />
              {history.length >= 2 && (
                <div className="mt-3 flex gap-4 text-xs text-muted tabular-nums">
                  <span>
                    Min: <strong className="text-[var(--color-text)]">{formatPrice(Math.min(...history.map(d => d.price)))}</strong>
                  </span>
                  <span>
                    Max: <strong className="text-[var(--color-text)]">{formatPrice(Math.max(...history.map(d => d.price)))}</strong>
                  </span>
                  {bestOffer?.median_price && (
                    <span>
                      Mediana 30 de zile: <strong className="text-[var(--color-text)]">{formatPrice(bestOffer.median_price)}</strong>
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
