import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { getProductDetail, getPriceHistory, getAllProductSlugs } from '@/lib/queries'
import { calculateDiscount, formatPrice, verdictColor } from '@/lib/discount'
import { PriceHistoryChart } from '@/components/PriceHistoryChart'

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

export default async function ProductPage({ params }: Props) {
  const { slug } = await params
  const product = await getProductDetail(slug)
  const history = product ? await getPriceHistory(product.id) : []

  if (!product) notFound()

  const bestOffer = product.offers[0]
  const discountInfo = bestOffer
    ? calculateDiscount(bestOffer.current_price, bestOffer.median_price)
    : null

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://superieftin.ro'

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

      {/* Breadcrumb */}
      <nav className="text-sm text-gray-400 mb-6 flex gap-1.5 items-center flex-wrap">
        <Link href="/" className="hover:text-gray-700">Acasă</Link>
        <span>/</span>
        <Link href={`/c/${product.category}`} className="hover:text-gray-700 capitalize">
          {product.category.replace(/-/g, ' ')}
        </Link>
        <span>/</span>
        <span className="text-gray-600 truncate max-w-xs">{product.name}</span>
      </nav>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Coloana stanga: imagine + verdict */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 aspect-square relative overflow-hidden">
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
              <div className="absolute inset-0 flex items-center justify-center text-gray-200 text-8xl">
                📱
              </div>
            )}
          </div>

          {/* Verdict reducere reala */}
          {discountInfo && (
            <div className={`rounded-xl border p-4 ${verdictColor(discountInfo.verdict)}`}>
              <div className="font-semibold text-base mb-1">{discountInfo.labelRo}</div>
              {discountInfo.verdict === 'real' && (
                <p className="text-sm opacity-80">
                  Prețul actual este cu {discountInfo.discountPct}% mai mic decât mediana
                  ultimelor 30 de zile — aceasta este o reducere reală, verificată statistic.
                </p>
              )}
              {discountInfo.verdict === 'good' && (
                <p className="text-sm opacity-80">
                  Prețul este ușor sub medie — merită considerat.
                </p>
              )}
              {discountInfo.verdict === 'normal' && (
                <p className="text-sm opacity-80">
                  Prețul este în intervalul obișnuit pentru acest produs.
                </p>
              )}
              {discountInfo.verdict === 'higher' && (
                <p className="text-sm opacity-80">
                  Prețul actual este mai mare ca de obicei — poate merită să aștepți.
                </p>
              )}
              {discountInfo.verdict === 'no-data' && (
                <p className="text-sm opacity-80">
                  Monitorizăm prețul — în curând vei putea vedea evoluția istorică.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Coloana dreapta: detalii + oferte */}
        <div className="space-y-6">
          <div>
            {product.brand && (
              <span className="text-sm text-gray-400 uppercase tracking-wide">{product.brand}</span>
            )}
            <h1 className="text-xl font-bold text-gray-900 mt-1 leading-snug">{product.name}</h1>
          </div>

          {/* Oferte per retailer */}
          <div className="space-y-3">
            <h2 className="font-semibold text-gray-800">Prețuri per magazin</h2>
            {product.offers.map((offer) => {
              const offerDiscount = calculateDiscount(offer.current_price, offer.median_price)
              return (
                <div
                  key={offer.offer_id}
                  className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-700 capitalize">{offer.retailer_name}</div>
                    {offer.last_checked && (
                      <div className="text-xs text-gray-400 mt-0.5">
                        Verificat: {new Date(offer.last_checked).toLocaleDateString('ro-RO')}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-gray-900">
                      {formatPrice(offer.current_price)}
                    </div>
                    {offer.median_price && offerDiscount.verdict !== 'normal' && offerDiscount.verdict !== 'no-data' && (
                      <div className={`text-xs border rounded-full px-2 py-0.5 mt-1 inline-block ${verdictColor(offerDiscount.verdict)}`}>
                        {offerDiscount.labelRo}
                      </div>
                    )}
                  </div>
                  <Link
                    href={`/go/${offer.offer_id}`}
                    className="shrink-0 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
                    target="_blank"
                    rel="noopener sponsored"
                  >
                    Cumpără
                  </Link>
                </div>
              )
            })}
          </div>

          {/* Grafic istoric pret */}
          <div>
            <h2 className="font-semibold text-gray-800 mb-3">
              Istoricul prețului (90 de zile)
            </h2>
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <PriceHistoryChart
                data={history}
                currentPrice={bestOffer?.current_price ?? null}
                medianPrice={bestOffer?.median_price ?? null}
              />
              {history.length >= 2 && (
                <div className="mt-3 flex gap-4 text-xs text-gray-500">
                  <span>
                    Min: <strong>{formatPrice(Math.min(...history.map(d => d.price)))}</strong>
                  </span>
                  <span>
                    Max: <strong>{formatPrice(Math.max(...history.map(d => d.price)))}</strong>
                  </span>
                  {bestOffer?.median_price && (
                    <span>
                      Medie 30z: <strong>{formatPrice(bestOffer.median_price)}</strong>
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
