import { calculateDiscount, formatPct, formatPrice } from '@/lib/discount'
import type { OfferRow } from '@/lib/queries'
import { AffiliateLink } from '@/components/analytics/AffiliateLink'
import { ExternalIcon } from './icons'
import { VerifiedAt } from './VerifiedAt'
import { btn } from './buttons'

// Ofertele pe magazine (design §4.3): cea mai ieftină evidențiată („Cel mai mic preț”, singurul
// buton roșu plin), restul cu buton contur. Procentul e față de mediana pe 30 de zile a FIECĂREI
// oferte (fiecare magazin are istoricul lui) — de aceea îl scriem „față de mediana lui”.
//
// Toate linkurile spre magazin trec prin AffiliateLink (token JS, /go/, GA4 click_affiliate_link).
// Textele de aici NU folosesc formularea „Reducere reală: X% sub mediana” / „Prețul de azi e cu”
// (cardul de verdict e singura sursă pentru ads:validate / ads-guard).


// Monograma magazinului (2 litere), neutră — logo-urile magazinelor sunt desenate pentru fundal
// deschis și ar ieși prost în modul întunecat.
export function ShopMark({ name }: { name: string }) {
  const letters = name.replace(/^www\./i, '').replace(/[^\p{L}\p{N}]/gu, '').slice(0, 2)
  return (
    <i aria-hidden="true" className="grid h-5 w-5 shrink-0 place-items-center rounded-[5px] bg-ink font-display text-[10px] font-extrabold not-italic capitalize text-[var(--bg)]">
      {letters}
    </i>
  )
}

function deltaText(o: OfferRow): { text: string; cls: string } {
  const d = calculateDiscount(o.current_price, o.median_price)
  if (d.verdict === 'no-data' || d.discountPct == null) return { text: 'istoric prea scurt pentru mediană', cls: 'text-ink-3' }
  if (d.discountPct === 0) return { text: 'egal cu mediana lui', cls: 'text-ink-3' }
  const sign = d.discountPct > 0 ? '−' : '+'
  const cls = d.verdict === 'real' ? 'text-red-ink' : d.verdict === 'higher' ? 'text-amber-ink' : 'text-ink-3'
  return { text: `${sign}${formatPct(d.discountPct)}% față de mediana lui`, cls }
}

interface Props {
  offers: OfferRow[]
  productId: string
  productName: string
  category: string | null
}

export function OfferList({ offers, productId, productName, category }: Props) {
  return (
    <div>
      {offers.map((o, i) => {
        const best = i === 0
        const delta = deltaText(o)
        const d = calculateDiscount(o.current_price, o.median_price)
        return (
          <div
            key={o.offer_id}
            className={`grid grid-cols-[1fr_auto] items-center gap-x-2.5 gap-y-0.5 py-3 ${
              best
                ? '-mx-3.5 bg-[linear-gradient(90deg,var(--red-tint),transparent_80%)] px-3.5 lg:-mx-[18px] lg:px-[18px]'
                : 'border-t border-line'
            }`}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[14.5px] font-bold text-ink">
                <ShopMark name={o.retailer_name} />
                <span className="truncate">{o.retailer_name}</span>
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
              <div className={`text-xs font-semibold tabular-nums ${delta.cls}`}>{delta.text}</div>
            </div>
            <div className="col-span-2 mt-1.5 flex items-center justify-between gap-2">
              <span className="text-xs text-ink-3">Preț pe site-ul magazinului</span>
              <AffiliateLink
                offerId={o.offer_id}
                productId={productId}
                productName={productName}
                merchantName={o.retailer_name}
                price={o.current_price}
                category={category}
                discountPct={d.verdict === 'real' ? d.discountPct : null}
                className={btn(best ? 'primary' : 'secondary', 'sm')}
              >
                <span data-best-offer={best ? '' : undefined}>Vezi oferta<span className="sr-only"> la {o.retailer_name}</span></span>
                <ExternalIcon />
              </AffiliateLink>
            </div>
          </div>
        )
      })}
    </div>
  )
}
