import Link from 'next/link'
import { splitGuideBody, collectRefs, type GuideSegment } from '@/lib/guides/markers'
import { renderMarkdown } from '@/lib/guides/markdown'
import { highlightUnverified } from '@/lib/guides/review'
import { loadLiveProducts, refsKey, type LiveProduct, type LiveOffer } from '@/lib/guides/queries'
import { getPriceHistory, getHistoryStart } from '@/lib/queries'
import { historyPartialSince, historyTitle } from '@/lib/seo/product-facts'
import { calculateDiscount, formatPrice, formatPct, formatVerified, medianDeltaText, FRESH_HOURS } from '@/lib/discount'
import { AffiliateLink } from '@/components/analytics/AffiliateLink'
import { PriceHistoryChart } from '@/components/PriceHistoryChart'

// Tipografia pentru textul lung al ghidului. Nu avem pluginul Tailwind Typography,
// deci stilurile elementelor generate din Markdown sunt definite aici (ca in LegalPage).
export const PROSE_CLASS = `text-base leading-relaxed text-[var(--color-text)] space-y-4 [&>*:first-child]:mt-0
  [&_h2]:font-archivo [&_h2]:text-xl [&_h2]:mt-8 [&_h2]:mb-2
  [&_h3]:font-semibold [&_h3]:text-lg [&_h3]:mt-6 [&_h3]:mb-1
  [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1
  [&_a]:text-brand [&_a]:underline [&_a]:underline-offset-2
  [&_blockquote]:border-l-4 [&_blockquote]:border-line [&_blockquote]:pl-4 [&_blockquote]:text-muted
  [&_code]:bg-[var(--color-page)] [&_code]:px-1 [&_code]:rounded [&_pre]:overflow-x-auto
  [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-lg
  [&_table]:w-full [&_table]:text-sm [&_th]:text-left [&_th]:font-semibold [&_th]:py-2 [&_th]:pr-3
  [&_td]:py-2 [&_td]:pr-3 [&_td]:align-top [&_tr]:border-b [&_tr]:border-line`

const btnClass = 'inline-block text-center shrink-0 bg-yellow-400 hover:bg-yellow-500 text-gray-900 text-sm font-semibold px-4 py-2 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2'
const boxClass = 'my-6 rounded-lg border border-line bg-surface p-4'

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

function Unavailable({ product, raw, preview }: { product: LiveProduct | undefined; raw: string; preview?: boolean }) {
  return (
    <div className={boxClass}>
      {product ? (
        <>
          <p className="font-semibold">
            <Link href={`/p/${product.slug}`} className="hover:text-brand">{product.name}</Link>
          </p>
          <p className="text-sm text-muted mt-1">
            Indisponibil momentan la magazinele monitorizate. Pe{' '}
            <Link href={`/p/${product.slug}`} className="text-brand underline underline-offset-2">pagina produsului</Link>{' '}
            poți seta o alertă de preț.
          </p>
        </>
      ) : (
        <p className="text-sm text-muted">Produs indisponibil momentan.</p>
      )}
      {preview && !product && (
        <p className="mt-2 text-xs text-red-700">Previzualizare: marcajul <code>{raw}</code> nu corespunde niciunui produs (id sau slug greșit).</p>
      )}
    </div>
  )
}

function ProductTitle({ p }: { p: LiveProduct }) {
  return (
    <Link href={`/p/${p.slug}`} className="font-semibold text-[var(--color-text)] hover:text-brand leading-snug">
      {p.name}
    </Link>
  )
}

function OffersBlock({ p }: { p: LiveProduct }) {
  return (
    <div className={boxClass}>
      <p className="mb-3"><ProductTitle p={p} /></p>
      <div className="space-y-2">
        {p.offers.slice(0, 8).map((o) => {
          const pct = realPct(o)
          return (
            <div key={o.offer_id} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-2 first:border-0 first:pt-0">
              <div className="flex-1 min-w-0">
                <div className="font-semibold capitalize">{o.retailer_name}</div>
                {o.last_checked && <div className="text-xs text-muted">{formatVerified(o.last_checked)}</div>}
              </div>
              <div className="text-right tabular-nums">
                <span className="font-archivo text-lg">{formatPrice(o.current_price)}</span>
                {pct != null && (
                  <span className="ml-2 text-xs font-semibold bg-brand-light text-brand rounded-full px-2 py-0.5">−{formatPct(pct)}%</span>
                )}
              </div>
              <AffiliateLink
                offerId={o.offer_id}
                productId={p.id}
                productName={p.name}
                merchantName={o.retailer_name}
                price={o.current_price}
                category={p.category}
                discountPct={pct}
                className={`${btnClass} w-full sm:w-auto`}
              >
                Vezi la {o.retailer_name} →
              </AffiliateLink>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PriceBlock({ p }: { p: LiveProduct }) {
  const best = p.offers[0]
  return (
    <div className={`${boxClass} flex flex-wrap items-center gap-x-4 gap-y-2`}>
      <div className="flex-1 min-w-0">
        <ProductTitle p={p} />
        <p className="text-sm text-muted mt-0.5">
          Cel mai mic preț acum: <strong className="text-[var(--color-text)] tabular-nums">{formatPrice(best.current_price)}</strong>{' '}
          la <span className="capitalize">{best.retailer_name}</span>
          {best.last_checked ? ` · ${formatVerified(best.last_checked).toLowerCase()}` : ''}
          {p.offers.length > 1 ? ` · ${p.offers.length} magazine` : ''}
        </p>
      </div>
      <AffiliateLink
        offerId={best.offer_id}
        productId={p.id}
        productName={p.name}
        merchantName={best.retailer_name}
        price={best.current_price}
        category={p.category}
        discountPct={realPct(best)}
        className={`${btnClass} w-full sm:w-auto`}
      >
        Vezi oferta →
      </AffiliateLink>
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

function DiscountBlock({ p }: { p: LiveProduct }) {
  const best = p.offers[0]
  const v = verdictFor(best)
  return (
    <div className={boxClass}>
      <ProductTitle p={p} />
      <p className={`mt-1 font-semibold ${v.verdict === 'real' ? 'text-brand' : ''}`}><DiscountText offer={best} /></p>
      <p className="text-sm text-muted mt-1">
        Prețul de acum: <span className="tabular-nums">{formatPrice(best.current_price)}</span>
        {best.median_price != null && <> · mediana 30 de zile: <span className="tabular-nums">{formatPrice(best.median_price)}</span></>}
        {' '}(la <span className="capitalize">{best.retailer_name}</span>). Comparăm cu mediana ultimelor 30 de zile,
        nu cu „prețul vechi” afișat de magazin.
      </p>
    </div>
  )
}

async function HistoryBlock({ p }: { p: LiveProduct }) {
  const [history, trackedSince] = await Promise.all([getPriceHistory(p.id), getHistoryStart(p.id).catch(() => null)])
  const best = p.offers[0]
  // Ca pe /p/: produs urmarit de mai putin de 90 de zile → „de la <data>”, nu „90 de zile”
  const title = historyTitle(historyPartialSince(trackedSince ?? history[0]?.recorded_at))
  return (
    <div className={boxClass}>
      <p className="mb-2"><ProductTitle p={p} /> <span className="text-sm text-muted">— {title.charAt(0).toLocaleLowerCase('ro-RO') + title.slice(1)}</span></p>
      <PriceHistoryChart data={history} currentPrice={best?.current_price ?? null} medianPrice={best?.median_price ?? null} />
      {best?.median_price != null && (
        <p className="mt-2 text-xs text-muted tabular-nums">
          Mediana 30 de zile: <strong className="text-[var(--color-text)]">{formatPrice(best.median_price)}</strong>
        </p>
      )}
    </div>
  )
}

function CompareBlock({ items }: { items: (LiveProduct | undefined)[] }) {
  const products = items.filter((p): p is LiveProduct => !!p)
  if (!products.length) return <Unavailable product={undefined} raw="" />
  return (
    <div className="my-6 overflow-x-auto rounded-lg border border-line bg-surface">
      <table className="w-full text-sm">
        <thead className="bg-[var(--color-page)] text-left text-muted">
          <tr>
            <th className="px-3 py-2 font-semibold">Produs</th>
            <th className="px-3 py-2 font-semibold">Cel mai mic preț</th>
            <th className="px-3 py-2 font-semibold">Față de mediana 30 de zile</th>
            <th className="px-3 py-2 font-semibold">Magazine</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => {
            const best = p.offers[0]
            return (
              <tr key={p.id} className="border-t border-line align-middle">
                <td className="px-3 py-2 min-w-48"><ProductTitle p={p} /></td>
                {best ? (
                  <>
                    <td className="px-3 py-2 tabular-nums whitespace-nowrap">
                      {formatPrice(best.current_price)} <span className="text-xs text-muted capitalize">({best.retailer_name})</span>
                    </td>
                    <td className="px-3 py-2"><DiscountText offer={best} /></td>
                    <td className="px-3 py-2 tabular-nums">{p.offers.length}</td>
                    <td className="px-3 py-2 text-right">
                      <AffiliateLink
                        offerId={best.offer_id}
                        productId={p.id}
                        productName={p.name}
                        merchantName={best.retailer_name}
                        price={best.current_price}
                        category={p.category}
                        discountPct={realPct(best)}
                        className={`${btnClass} whitespace-nowrap`}
                      >
                        Vezi oferta →
                      </AffiliateLink>
                    </td>
                  </>
                ) : (
                  <td className="px-3 py-2 text-muted" colSpan={4}>Indisponibil momentan</td>
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
          <p className="text-xs text-red-700 -mt-4 mb-4">Previzualizare: produse negăsite în <code>{seg.raw}</code>: {missing.join(', ')}</p>
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
