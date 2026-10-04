import Link from 'next/link'
import { splitGuideBody, collectRefs, type GuideSegment } from '@/lib/guides/markers'
import { renderMarkdown } from '@/lib/guides/markdown'
import { highlightUnverified } from '@/lib/guides/review'
import { loadLiveProducts, refsKey, type LiveProduct, type LiveOffer } from '@/lib/guides/queries'
import { getPriceHistory, getHistoryStart } from '@/lib/queries'
import { historyPartialSince, historyTitle } from '@/lib/seo/product-facts'
import { dailyLowSeries } from '@/lib/price-series'
import { calculateDiscount, formatPrice, formatPct, medianDeltaText, FRESH_HOURS } from '@/lib/discount'
import { AffiliateLink } from '@/components/analytics/AffiliateLink'
import { VerdictBadge } from '@/components/VerdictBadge'
import { ARTICLE_PROSE } from '@/components/article'
import { PriceStepChart } from '@/components/product/PriceStepChart'
import { ShopMark } from '@/components/product/OfferList'
import { VerifiedAt } from '@/components/product/VerifiedAt'
import { ExternalIcon } from '@/components/product/icons'
import { btn } from '@/components/product/buttons'

// Tipografia pentru textul lung al ghidului: cea comuna de articol (components/article.ts, la fel
// ca paginile legale). Exportata si sub numele vechi, folosit de pagina ghidului pentru „Pe scurt”.
export const PROSE_CLASS = ARTICLE_PROSE

// Blocurile live (redesign): carduri pe tokeni, butoanele ca pe /p/ — rosu plin doar pentru
// oferta cea mai ieftina, contur pentru restul (components/product/buttons.ts).
const boxClass = 'my-6 rounded-2xl border border-line bg-surface p-3.5 sm:p-4'
const productLink = 'font-display text-[17px] font-extrabold leading-snug text-ink hover:text-red-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink rounded'

// Verdictul fata de mediana, pe cea mai ieftina oferta disponibila. O „reducere reala” se afirma
// doar daca pretul a fost verificat in ultimele FRESH_HOURS (ca pe /reduceri-reale/) — altfel
// am putea promite o reducere pe un pret care nu mai exista.
function verdictFor(offer: LiveOffer | undefined) {
  if (!offer) return calculateDiscount(null, null)
  const fresh = offer.last_checked && Date.now() - new Date(offer.last_checked).getTime() < FRESH_HOURS * 3600_000
  return calculateDiscount(offer.current_price, fresh ? offer.median_price : null)
}

function realPct(offer: LiveOffer | undefined): number | null {
  const v = verdictFor(offer)
  return v.verdict === 'real' ? v.discountPct : null
}

// Insigna de verdict (aceeasi ca pe /p/ si in liste), din verdictul cu regula de prospetime
function Badge({ offer, size }: { offer: LiveOffer | undefined; size?: 'sm' | 'lg' }) {
  const v = verdictFor(offer)
  return <VerdictBadge verdict={v.verdict} discountPct={v.discountPct} size={size} />
}

function Unavailable({ product, raw, preview }: { product: LiveProduct | undefined; raw: string; preview?: boolean }) {
  return (
    <div className={boxClass}>
      {product ? (
        <>
          <p>
            <Link href={`/p/${product.slug}`} className={productLink}>{product.name}</Link>
          </p>
          <p className="mt-1 text-sm text-ink-3">
            Indisponibil momentan la magazinele monitorizate. Pe{' '}
            <Link href={`/p/${product.slug}`} className="text-red-ink underline underline-offset-2">pagina produsului</Link>{' '}
            poți seta o alertă de preț.
          </p>
        </>
      ) : (
        <p className="text-sm text-ink-3">Produs indisponibil momentan.</p>
      )}
      {preview && !product && (
        <p className="mt-2 text-xs text-red-ink">Previzualizare: marcajul <code>{raw}</code> nu corespunde niciunui produs (id sau slug greșit).</p>
      )}
    </div>
  )
}

function ProductTitle({ p }: { p: LiveProduct }) {
  return <Link href={`/p/${p.slug}`} className={productLink}>{p.name}</Link>
}

// Butonul spre magazin — DOAR prin AffiliateLink (token JS, /go/, GA4 click_affiliate_link)
function ShopButton({ p, o, primary, children, className = '' }: {
  p: LiveProduct
  o: LiveOffer
  primary: boolean
  children: React.ReactNode
  className?: string
}) {
  return (
    <AffiliateLink
      offerId={o.offer_id}
      productId={p.id}
      productName={p.name}
      merchantName={o.retailer_name}
      price={o.current_price}
      category={p.category}
      discountPct={realPct(o)}
      className={`${btn(primary ? 'primary' : 'secondary', 'sm')} shrink-0 ${className}`}
    >
      {children}
      <ExternalIcon />
    </AffiliateLink>
  )
}

// {{oferte:ID}} — ofertele pe magazine, ca lista de pe /p/: cea mai ieftina evidentiata (singurul
// buton rosu plin), restul cu buton contur.
function OffersBlock({ p }: { p: LiveProduct }) {
  const offers = p.offers.slice(0, 8)
  return (
    <div className={`${boxClass} pb-1.5 sm:pb-2`}>
      <p className="mb-1"><ProductTitle p={p} /></p>
      <div>
        {offers.map((o, i) => {
          const best = i === 0
          return (
            <div
              key={o.offer_id}
              className={`grid grid-cols-[1fr_auto] items-center gap-x-2.5 gap-y-0.5 py-3 ${
                best
                  ? '-mx-3.5 bg-[linear-gradient(90deg,var(--red-tint),transparent_80%)] px-3.5 sm:-mx-4 sm:px-4'
                  : 'border-t border-line'
              }`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-[14.5px] font-bold text-ink">
                  <ShopMark name={o.retailer_name} />
                  <span className="truncate capitalize">{o.retailer_name}</span>
                </div>
                <div className="mt-0.5 text-xs text-ink-3">
                  {best && offers.length > 1 && (
                    <><span className="text-[11px] font-extrabold uppercase tracking-[.06em] text-red-ink">Cel mai mic preț</span> · </>
                  )}
                  {o.last_checked ? <VerifiedAt iso={o.last_checked} /> : 'în stoc'}
                </div>
              </div>
              <div className="text-right">
                <div className="font-display text-[19px] font-extrabold tabular-nums text-ink">{formatPrice(o.current_price)}</div>
                {realPct(o) != null && <Badge offer={o} />}
              </div>
              <div className="col-span-2 mt-1.5 flex items-center justify-between gap-2">
                <span className="text-xs text-ink-3">Preț pe site-ul magazinului</span>
                <ShopButton p={p} o={o} primary={best}>
                  Vezi oferta<span className="sr-only"> la {o.retailer_name}</span>
                </ShopButton>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// {{pret:ID}} — cel mai mic pret acum + insigna de verdict + butonul spre magazin
function PriceBlock({ p }: { p: LiveProduct }) {
  const best = p.offers[0]
  return (
    <div className={`${boxClass} flex flex-col gap-3 sm:flex-row sm:items-center`}>
      <div className="min-w-0 flex-1">
        <ProductTitle p={p} />
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
          <span className="font-display text-[22px] font-extrabold leading-none tabular-nums text-ink">{formatPrice(best.current_price)}</span>
          <Badge offer={best} />
        </div>
        <p className="mt-1.5 text-[13px] text-ink-3">
          Cel mai mic preț acum, la <span className="capitalize">{best.retailer_name}</span>
          {best.last_checked ? <> · <VerifiedAt iso={best.last_checked} className="lowercase" /></> : null}
          {p.offers.length > 1 ? ` · ${p.offers.length} magazine` : ''}
        </p>
      </div>
      <ShopButton p={p} o={best} primary className="w-full sm:w-auto">Vezi oferta</ShopButton>
    </div>
  )
}

function DiscountText({ offer }: { offer: LiveOffer | undefined }) {
  const v = verdictFor(offer)
  if (v.verdict === 'real') return <>Reducere reală: {formatPct(v.discountPct ?? 0)}% sub mediana de 30 de zile</>
  if (v.verdict === 'normal') return <>Preț în intervalul obișnuit ({medianDeltaText(v.discountPct)})</>
  if (v.verdict === 'higher') return <>Preț cu {formatPct(v.discountPct ?? 0)}% peste mediana de 30 de zile</>
  return <>Istoric insuficient pentru verificare</>
}

// Culoarea frazei de verdict (aceleasi stari ca insigna)
function verdictInk(offer: LiveOffer | undefined): string {
  const v = verdictFor(offer).verdict
  return v === 'real' ? 'text-red-ink' : v === 'higher' ? 'text-amber-ink' : 'text-ink'
}

// {{reducere:ID}} — verdictul fata de mediana pe 30 de zile, cu insigna mare
function DiscountBlock({ p }: { p: LiveProduct }) {
  const best = p.offers[0]
  return (
    <div className={boxClass}>
      <ProductTitle p={p} />
      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
        <Badge offer={best} size="lg" />
        <p className={`font-semibold ${verdictInk(best)}`}><DiscountText offer={best} /></p>
      </div>
      <p className="mt-2 text-sm text-ink-3">
        Prețul de acum: <span className="font-semibold tabular-nums text-ink">{formatPrice(best.current_price)}</span>
        {best.median_price != null && <> · mediana 30 de zile: <span className="font-semibold tabular-nums text-ink">{formatPrice(best.median_price)}</span></>}
        {' '}(la <span className="capitalize">{best.retailer_name}</span>). Comparăm cu mediana ultimelor 30 de zile,
        nu cu „prețul vechi” afișat de magazin.
      </p>
    </div>
  )
}

// {{istoric-pret:ID}} — acelasi grafic in trepte ca pe /p/ („cel mai mic pret pe zi”), din
// istoricul deja citit (getPriceHistory, 90 de zile) — nicio interogare noua.
async function HistoryBlock({ p }: { p: LiveProduct }) {
  const [history, trackedSince] = await Promise.all([getPriceHistory(p.id), getHistoryStart(p.id).catch(() => null)])
  const best = p.offers[0]
  const series = dailyLowSeries(history, {
    offerIds: p.offers.map((o) => o.offer_id),
    todayPrice: best?.current_price ?? null,
  })
  // Ca pe /p/: produs urmarit de mai putin de 90 de zile → „de la <data>”, nu „90 de zile”
  const title = historyTitle(historyPartialSince(trackedSince ?? history[0]?.recorded_at))
  return (
    <div className={boxClass}>
      <p className="leading-snug">
        <ProductTitle p={p} />
        <span className="mt-0.5 block text-[13px] text-ink-3">{title} · cel mai mic preț pe zi{p.offers.length > 1 ? ', toate magazinele' : ''}</span>
      </p>
      <PriceStepChart
        series={series}
        median={best?.median_price ?? null}
        verdict={verdictFor(best).verdict}
        endsToday={Boolean(best)}
      />
      {best?.median_price != null && (
        <p className="mt-2 text-xs tabular-nums text-ink-3">
          Mediana 30 de zile: <strong className="text-ink">{formatPrice(best.median_price)}</strong>
        </p>
      )}
    </div>
  )
}

// {{comparatie:ID1,ID2}} — tabel pe tokeni; pe telefon se deruleaza in interiorul lui
function CompareBlock({ items }: { items: (LiveProduct | undefined)[] }) {
  const products = items.filter((p): p is LiveProduct => !!p)
  if (!products.length) return <Unavailable product={undefined} raw="" />
  const th = 'px-3 py-2.5 text-[12px] font-bold uppercase tracking-[.04em] text-ink-3'
  // relative: textul sr-only din antet (position:absolute) rămâne în containerul derulabil —
  // altfel lățea pagina pe telefon
  return (
    <div className="relative my-6 overflow-x-auto rounded-2xl border border-line bg-surface">
      <table className="w-full text-sm">
        <thead className="bg-surface-2 text-left">
          <tr>
            <th className={th}>Produs</th>
            <th className={th}>Cel mai mic preț</th>
            <th className={th}>Față de mediana 30 de zile</th>
            <th className="px-3 py-2.5"><span className="sr-only">Ofertă</span></th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => {
            const best = p.offers[0]
            return (
              <tr key={p.id} className="border-t border-line align-middle">
                <td className="min-w-40 px-3 py-3"><Link href={`/p/${p.slug}`} className="font-semibold leading-snug text-ink hover:text-red-ink">{p.name}</Link></td>
                {best ? (
                  <>
                    {/* Numarul de magazine sta sub magazin (fara coloana separata: tabelul incape
                        in latimea de citire pe desktop si se deruleaza mai putin pe telefon) */}
                    <td className="whitespace-nowrap px-3 py-3 tabular-nums">
                      <span className="font-display text-[16px] font-extrabold text-ink">{formatPrice(best.current_price)}</span>
                      <span className="block text-xs text-ink-3">
                        <span className="capitalize">{best.retailer_name}</span>
                        {p.offers.length > 1 ? ` · ${p.offers.length} magazine` : ''}
                      </span>
                    </td>
                    {/* Insigna spune deja „Reducere reală −X%”; fraza completa doar pentru celelalte stari */}
                    <td className="px-3 py-3">
                      <Badge offer={best} />
                      {verdictFor(best).verdict !== 'real' && (
                        <span className="mt-1 block text-xs text-ink-2"><DiscountText offer={best} /></span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <ShopButton p={p} o={best} primary={false} className="whitespace-nowrap">Vezi oferta</ShopButton>
                    </td>
                  </>
                ) : (
                  <td className="px-3 py-3 text-ink-3" colSpan={3}>Indisponibil momentan</td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function Block({ seg, products, preview }: {
  seg: Extract<GuideSegment, { kind: 'block' }>
  products: Map<string, LiveProduct>
  preview?: boolean
}) {
  if (seg.type === 'comparatie') {
    const missing = seg.refs.filter((r) => !products.has(r))
    return (
      <>
        <CompareBlock items={seg.refs.map((r) => products.get(r))} />
        {preview && missing.length > 0 && (
          <p className="text-xs text-red-ink -mt-4 mb-4">Previzualizare: produse negăsite în <code>{seg.raw}</code>: {missing.join(', ')}</p>
        )}
      </>
    )
  }
  const p = products.get(seg.refs[0] ?? '')
  // Produs sters sau fara nicio oferta disponibila → mesaj, nu eroare
  if (!p || p.offers.length === 0) {
    return seg.type === 'istoric-pret' && p
      ? <HistoryBlock p={p} />
      : <Unavailable product={p} raw={seg.raw} preview={preview} />
  }
  switch (seg.type) {
    case 'oferte': return <OffersBlock p={p} />
    case 'pret': return <PriceBlock p={p} />
    case 'reducere': return <DiscountBlock p={p} />
    case 'istoric-pret': return <HistoryBlock p={p} />
  }
}

// Corpul ghidului: Markdown sigur (fara HTML brut) + blocurile live, in ordinea din text.
// preview = true (doar in admin) arata avertismente pentru marcaje cu produse inexistente.
export async function GuideBody({ body, preview }: { body: string; preview?: boolean }) {
  const segments = splitGuideBody(body)
  const products = await loadLiveProducts(refsKey(collectRefs(segments)))
  return (
    // Stilurile de text lung se aplica DOAR bucatilor Markdown, nu blocurilor live
    // (altfel [&_a] ar colora si butoanele spre magazine)
    <div>
      {segments.map((seg, i) =>
        seg.kind === 'md'
          ? <div key={i} className={PROSE_CLASS} dangerouslySetInnerHTML={{ __html: preview ? highlightUnverified(renderMarkdown(seg.text)) : renderMarkdown(seg.text) }} />
          : <Block key={i} seg={seg} products={products} preview={preview} />
      )}
    </div>
  )
}
