import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { getProductDetail, getPriceHistory, getHistoryStart } from '@/lib/queries'
import { calculateDiscount, formatVerified } from '@/lib/discount'
import { priceFactRows, historyPartialSince, historyTitle } from '@/lib/seo/product-facts'
import { addDays, dailyLowSeries, roDay } from '@/lib/price-series'
import { getGuidesUsingProduct } from '@/lib/admin/research'
import { VerdictCard } from '@/components/product/VerdictCard'
import { OfferList } from '@/components/product/OfferList'
import { PriceStepChart } from '@/components/product/PriceStepChart'
import { PriceFacts } from '@/components/product/PriceFacts'
import { CopyText } from '@/components/admin/CopyText'

// Admin → Cercetare → fisa interna de produs: ce arata azi /p/[slug] (verdict, oferte, graficul
// „cel mai mic pret pe zi”, „Pe scurt despre pret”), cu ACELEASI componente si query-uri, dar
// fara alerta de pret, bara fixa de pe mobil, JSON-LD sau GA4 (adminul nu se masoara). Plus
// ghidurile in care apare produsul. Linkurile spre magazine raman prin AffiliateLink → /go/;
// din admin clickul e marcat intern (is_internal), deci nu intra in statistici.
//
// Datele vin din getProductDetail / getPriceHistory (cache 1 h, aceleasi ca pe /p/).

export const metadata: Metadata = { title: 'Fișă produs — cercetare', robots: { index: false, follow: false } }

type Props = { params: Promise<{ slug: string }> }

const card = 'rounded-2xl bg-surface p-4 shadow-card border border-line'

export default async function CercetareProdusPage({ params }: Props) {
  const { slug } = await params
  const product = await getProductDetail(slug)
  if (!product) notFound()

  const [history, trackedSince, guides] = await Promise.all([
    getPriceHistory(product.id),
    getHistoryStart(product.id).catch(() => null),
    getGuidesUsingProduct(product.id),
  ])
  const bestOffer = product.offers[0]
  const discountInfo = bestOffer ? calculateDiscount(bestOffer.current_price, bestOffer.median_price) : null

  // Aceeasi serie si aceeasi fereastra ca pe /p/ (app/p/[slug]/page.tsx): doar ofertele
  // disponibile azi; fereastra porneste de la prima inregistrare sau de la inceputul seriei.
  const series = dailyLowSeries(history, {
    offerIds: product.offers.map((o) => o.offer_id),
    todayPrice: bestOffer?.current_price ?? null,
  })
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
    eventInflation: null,
  })
  const withAffiliate = product.offers.filter((o) => o.affiliate_url).length

  return (
    <div className="max-w-6xl">
      <p className="text-sm mb-3">
        <Link href="/admin/cercetare" className="text-muted hover:text-brand">← Cercetare</Link>
      </p>

      <header className="flex items-start gap-4 mb-4">
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-line bg-white">
          {product.image_url ? (
            <Image src={product.image_url} alt="" fill sizes="96px" className="object-contain p-1.5" unoptimized />
          ) : (
            <span aria-hidden="true" className="absolute inset-0 grid place-items-center text-3xl">📦</span>
          )}
        </div>
        <div className="min-w-0">
          {product.brand && <div className="text-xs font-bold uppercase tracking-wide text-muted">{product.brand}</div>}
          <h1 className="text-2xl font-bold leading-tight">{product.name}</h1>
          <p className="text-sm text-muted mt-1">
            {product.parent_name ? `${product.parent_name} › ` : ''}{product.category_name ?? product.category}
            {' · '}
            <code className="text-xs select-all">{product.slug}</code>{' '}
            <CopyText text={product.slug} />{' · '}
            <CopyText text={`{{oferte:${product.slug}}}`} label="copiază marcajul" />
          </p>
          <p className="text-sm mt-1">
            <span className="text-muted">Apare în ghidurile: </span>
            {guides.length === 0 ? (
              <span className="text-muted">niciunul</span>
            ) : (
              guides.map((g, i) => (
                <span key={g.id}>
                  {i > 0 && ', '}
                  <Link href={`/admin/ghiduri/${g.id}`} className="text-brand hover:underline">{g.title}</Link>
                  {g.status === 'draft' && <span className="text-xs text-muted"> (ciornă)</span>}
                </span>
              ))
            )}
          </p>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        <div className="flex flex-col gap-4">
          {bestOffer ? (
            <VerdictCard offer={bestOffer} offerCount={product.offers.length} />
          ) : (
            <section className={card}>
              <h2 className="text-lg font-bold">Momentan indisponibil</h2>
              <p className="text-sm text-muted mt-1">
                Nicio ofertă disponibilă acum.
                {product.last_seen ? ` Ultima confirmare: ${formatVerified(product.last_seen).replace(/^Verificat /, '')}.` : ''}
              </p>
            </section>
          )}

          <section aria-labelledby="istoric-titlu" className={card}>
            <h2 id="istoric-titlu" className="flex flex-wrap items-baseline justify-between gap-x-2 text-lg font-bold">
              {historyTitle(historyPartialSince(historyStart))}
              <small className="text-xs font-medium text-muted">cel mai mic preț pe zi{product.offers.length > 1 ? ', toate magazinele' : ''}</small>
            </h2>
            <PriceStepChart
              series={series}
              median={bestOffer?.median_price ?? null}
              verdict={discountInfo?.verdict ?? 'no-data'}
              endsToday={Boolean(bestOffer)}
            />
          </section>

          {facts.length > 0 && (
            <section aria-labelledby="pe-scurt-titlu" className={card}>
              <h2 id="pe-scurt-titlu" className="text-lg font-bold">Pe scurt despre preț</h2>
              <PriceFacts rows={facts} />
            </section>
          )}
        </div>

        {bestOffer && (
          <section aria-labelledby="oferte-titlu" className={card}>
            <h2 id="oferte-titlu" className="text-lg font-bold">
              {product.offers.length > 1 ? `Prețuri în ${product.offers.length} magazine` : 'Prețul de azi'}
            </h2>
            <p className="text-xs text-muted mb-1 mt-0.5">
              Procentul e față de mediana pe 30 de zile a fiecărui magazin.
              {withAffiliate < product.offers.length && (
                <> Doar {withAffiliate} din {product.offers.length} oferte au link afiliat (în articole apar doar acestea).</>
              )}
            </p>
            <OfferList offers={product.offers} productId={product.id} productName={product.name} category={product.category} />
          </section>
        )}
      </div>
    </div>
  )
}
