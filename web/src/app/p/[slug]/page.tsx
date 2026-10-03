import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { getProductDetail, getPriceHistory, getAllProductSlugs } from '@/lib/queries'
import { calculateDiscount, formatPrice, formatPct, formatVerified, medianDeltaText } from '@/lib/discount'
import { PriceHistoryChart } from '@/components/PriceHistoryChart'
import { PriceTag } from '@/components/PriceTag'
import { VerdictBadge } from '@/components/VerdictBadge'
import { Sparkline } from '@/components/Sparkline'
import { TrackViewItem } from '@/components/analytics/TrackViewItem'
import { AffiliateLink } from '@/components/analytics/AffiliateLink'
import { getGuidesForProduct } from '@/lib/guides/queries'
import { suggestAlertTarget, telegramAlertUrl } from '@/lib/price-alert'
import { PriceAlertButton, MobileActionBar } from '@/components/PriceAlert'
import { EmailAlertForm } from '@/components/EmailAlertForm'
import { emailAlertsEnabled } from '@/lib/email-alerts'
import { breadcrumbLd, ldScript, productLd } from '@/lib/seo/jsonld'
import { priceFacts, variantBase } from '@/lib/seo/product-facts'
import { getProductVariants, getSimilarProducts, type ProductLink } from '@/lib/seo/queries'
import { withOg } from '@/lib/seo/og'
import { absUrl } from '@/lib/seo/site'

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
  const description = `Prețul curent pentru ${product.name} la ${bestOffer?.retailer_name || 'magazine online'}` +
    (median ? `; mediana ultimelor 30 de zile: ${formatPrice(median)}` : '') +
    '. Grafic cu istoricul prețului pe 90 de zile, comparat cu mediana de 30 de zile.'

  return {
    title,
    description,
    alternates: { canonical: `/p/${slug}` },
    // Fara nicio oferta disponibila: pagina ramane pentru vizitatori, dar nu se indexeaza
    // (iar dupa PRODUCT_GONE_DAYS raspunde 410 — src/proxy.ts)
    ...(product.offers.length === 0 ? { robots: { index: false, follow: true } } : {}),
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
      <h2 className="font-semibold text-[var(--color-text)] mb-3">{title}</h2>
      <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {items.map((it) => (
          <li key={it.id}>
            <Link
              href={`/p/${it.slug}`}
              className="flex items-baseline justify-between gap-3 rounded-lg border border-line bg-surface px-3 py-2 hover:border-brand transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <span className="text-sm text-[var(--color-text)] line-clamp-2">{it.name}</span>
              <span className="text-sm font-semibold tabular-nums whitespace-nowrap">{formatPrice(it.price)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params
  const product = await getProductDetail(slug)
  const history = product ? await getPriceHistory(product.id) : []

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

  const discountInfo = bestOffer
    ? calculateDiscount(bestOffer.current_price, bestOffer.median_price)
    : null

  // Alerta de pret = actiunea secundara principala, langa „Vezi oferta” (decizia 2026-10-03).
  // Pragul propus: 5% sub min(pret azi, mediana 30 de zile) — lib/price-alert.ts. Pentru un
  // produs indisponibil nu propunem nimic (nu avem un pret de azi): botul il intreaba.
  const botUsername = process.env.TELEGRAM_BOT_USERNAME
  const alertTarget = bestOffer ? suggestAlertTarget(bestOffer.current_price, bestOffer.median_price) : null
  // Alerta e pe PRODUS: pleaca la orice magazin (decizia 2026-10-03), deci merge si fara oferte
  const alertHref = botUsername ? telegramAlertUrl(botUsername, product.id, alertTarget) : null
  // Alerte pe email (double opt-in) — doar daca SMTP + secretul linkurilor sunt configurate
  const emailEnabled = emailAlertsEnabled()
  const alertProps = alertHref
    ? { href: alertHref, productId: product.id, category: product.category, price: bestOffer?.current_price ?? null, target: alertTarget }
    : null
  const affiliateProps = bestOffer
    ? {
        offerId: bestOffer.offer_id,
        productId: product.id,
        productName: product.name,
        merchantName: bestOffer.retailer_name,
        price: bestOffer.current_price,
        category: product.category,
        discountPct: discountInfo?.verdict === 'real' ? discountInfo.discountPct : null,
      }
    : null
  const primaryBtn = 'text-center bg-yellow-400 hover:bg-yellow-500 text-gray-900 text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2'
  const alertBtn = 'flex items-center justify-center gap-1.5 text-center border-2 border-brand text-brand bg-surface hover:bg-brand-light text-sm font-semibold px-4 py-2 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2'

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
  const breadcrumb = breadcrumbLd([
    { name: 'Acasă', path: '/' },
    ...(product.parent_slug && product.parent_name ? [{ name: product.parent_name, path: `/c/${product.parent_slug}` }] : []),
    { name: product.category_name ?? product.category.replace(/-/g, ' '), path: `/c/${product.category}` },
    { name: product.name, path: `/p/${slug}` },
  ])

  // „Pe scurt despre preț”: aceleasi valori ca graficul (istoric 90 de zile + mediana ofertei afisate)
  const facts = priceFacts({
    history,
    median30: bestOffer?.median_price ?? null,
    lastChecked: bestOffer?.last_checked ?? null,
    retailer: bestOffer?.retailer_name ?? null,
  })

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

          {/* Actiunile principale: „Vezi oferta” (cea mai ieftina oferta disponibila) + alerta de
              pret. Pe mobil acelasi lucru sta si in bara fixa de jos (MobileActionBar), care se
              ascunde cand blocul acesta e pe ecran. */}
          {(affiliateProps || alertProps || emailEnabled) && (
            <div id="actiuni-produs" className="rounded-lg border border-line bg-surface p-4 space-y-3">
              {bestOffer && (
                <div>
                  <div className="text-xs text-muted">
                    {product.offers.length > 1 ? 'Cel mai bun preț azi' : 'Preț azi'}, la{' '}
                    {bestOffer.retailer_name}
                  </div>
                  <PriceTag
                    price={bestOffer.current_price}
                    discountPct={discountInfo?.verdict === 'real' ? discountInfo.discountPct : null}
                  />
                </div>
              )}
              <div className="grid sm:grid-cols-2 gap-2">
                {affiliateProps && (
                  <AffiliateLink {...affiliateProps} className={primaryBtn}>
                    Vezi oferta →
                  </AffiliateLink>
                )}
                {alertProps && (
                  <PriceAlertButton {...alertProps} placement={bestOffer ? 'actiuni' : 'indisponibil'} className={alertBtn}>
                    <span aria-hidden="true">🔔</span> {bestOffer ? 'Anunță-mă când scade prețul' : 'Setează o alertă de preț'}
                  </PriceAlertButton>
                )}
              </div>
              {/* Rândul de beneficiu: descrie EXACT ce face alerta (orice magazin, pragul ales, o
                  singura data) — fara sa promita ca pretul va scadea (REGULI.md, regula 9).
                  „pe Telegram” trebuie sa ramana vizibil: reclamele promit „Alertă de preț pe Telegram”. */}
              {(alertProps || emailEnabled) && (
                <p className="text-xs text-muted">
                  {bestOffer && alertTarget != null ? (
                    <>
                      Gratuit, {alertProps && emailEnabled ? 'pe Telegram sau pe email' : alertProps ? 'pe Telegram' : 'pe email'}:
                      îți scriem când prețul, la oricare dintre magazinele monitorizate, ajunge la{' '}
                      <strong className="text-[var(--color-text)]">{formatPrice(alertTarget)}</strong> sau mai puțin.
                      Poți alege alt prag. Fără cont.
                    </>
                  ) : (
                    <>
                      Gratuit, {alertProps && emailEnabled ? 'pe Telegram sau pe email' : alertProps ? 'pe Telegram' : 'pe email'}:
                      alegi prețul dorit și îți scriem când produsul e disponibil la acel preț sau mai puțin,
                      la oricare dintre magazinele monitorizate. Fără cont.
                    </>
                  )}
                </p>
              )}
              {emailEnabled && (
                <EmailAlertForm
                  productId={product.id}
                  offerId={bestOffer?.offer_id ?? product.alert_offer_id}
                  defaultTarget={alertTarget}
                  category={product.category}
                  price={bestOffer?.current_price ?? null}
                />
              )}
            </div>
          )}

          {/* Oferte per retailer — doar cele disponibile (lib/availability.ts) */}
          <div className="space-y-3">
            <h2 className="font-semibold text-[var(--color-text)]">Prețuri per magazin</h2>
            {product.offers.length === 0 && (
              <div className="rounded-lg border border-line bg-surface p-4">
                <p className="font-semibold text-[var(--color-text)]">
                  Momentan indisponibil la magazinele monitorizate
                </p>
                <p className="text-sm text-muted mt-1">
                  {product.last_seen
                    ? `Ultima dată l-am găsit ${formatVerified(product.last_seen).replace(/^Verificat /, '')}. `
                    : ''}
                  Setează o alertă de preț și te anunțăm când reapare la prețul dorit.
                </p>
              </div>
            )}
            {product.offers.map((offer) => {
              const offerDiscount = calculateDiscount(offer.current_price, offer.median_price)
              return (
                <div
                  key={offer.offer_id}
                  className="bg-surface rounded-lg border border-line p-4 flex flex-wrap items-center gap-x-4 gap-y-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-[var(--color-text)] capitalize">{offer.retailer_name}</div>
                    <div className="flex items-center gap-2 mt-0.5">
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
                    productId={product.id}
                    productName={product.name}
                    merchantName={offer.retailer_name}
                    price={offer.current_price}
                    category={product.category}
                    discountPct={offerDiscount.verdict === 'real' ? offerDiscount.discountPct : null}
                    className="w-full sm:w-auto text-center shrink-0 bg-yellow-400 hover:bg-yellow-500 text-gray-900 text-sm font-semibold px-4 py-2 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                  >
                    Cumpără la {offer.retailer_name} →
                  </AffiliateLink>
                </div>
              )
            })}
          </div>

          {/* Ghiduri despre acest produs — doar cand exista ghiduri publicate */}
          {guides.length > 0 && (
            <div className="rounded-lg border border-line bg-surface p-4">
              <h2 className="font-semibold text-[var(--color-text)] text-sm mb-1">Ghiduri despre acest produs</h2>
              <ul className="space-y-1 text-sm">
                {guides.map((g) => (
                  <li key={g.slug}>
                    <Link href={`/ghiduri/${g.slug}`} className="text-brand hover:underline">{g.title}</Link>
                  </li>
                ))}
              </ul>
            </div>
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

          {/* Fraze factuale despre pret (citabile de motoare si asistenti AI): fara verdict, fara
              promisiuni — regula 9. Sub istoric, nu deasupra butoanelor. */}
          {facts.length > 0 && (
            <div>
              <h2 className="font-semibold text-[var(--color-text)] mb-2">Pe scurt despre preț</h2>
              <p className="text-sm text-muted">{facts.join(' ')}</p>
            </div>
          )}
        </div>
      </div>

      <ProductLinks title="Alte variante" items={variants} />
      <ProductLinks title="Produse similare" items={similar} />

      {/* Bara fixa de pe mobil — doar cand exista macar o actiune */}
      {(affiliateProps || alertProps) && (
        <MobileActionBar watchId="actiuni-produs">
          {affiliateProps && (
            <AffiliateLink {...affiliateProps} className={`flex-1 ${primaryBtn}`}>
              Vezi oferta · <span className="tabular-nums whitespace-nowrap">{formatPrice(affiliateProps.price)}</span>
            </AffiliateLink>
          )}
          {alertProps && (
            <PriceAlertButton
              {...alertProps}
              placement="bara-mobil"
              className={`${affiliateProps ? 'shrink-0' : 'flex-1'} ${alertBtn}`}
            >
              <span aria-hidden="true">🔔</span> {affiliateProps ? 'Alertă preț' : 'Setează o alertă de preț'}
            </PriceAlertButton>
          )}
        </MobileActionBar>
      )}
    </>
  )
}
