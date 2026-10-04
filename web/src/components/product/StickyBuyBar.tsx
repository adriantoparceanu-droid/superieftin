'use client'

import { useEffect, useState } from 'react'
import { AffiliateLink } from '@/components/analytics/AffiliateLink'
import { formatPrice, type DiscountVerdict } from '@/lib/discount'
import { ALERT_CARD_ID, ALERT_INPUT_ID } from './PriceAlertCard'
import { BellIcon, ExternalIcon } from './icons'
import { btn } from './buttons'

// Bara fixă de jos, DOAR pe mobil (lg:hidden) — design §4.8: preț + verdict scurt · clopoțel
// (derulează la cardul „Alertă de preț” și pune focusul în „Pragul tău”) · „Vezi oferta” (prin
// AffiliateLink, oferta cea mai ieftină). Înlocuiește bara veche din PriceAlert.tsx.
//
// Se ascunde cât timp e pe ecran:
//  - butonul „Vezi oferta” al celei mai ieftine oferte (un singur buton roșu pe ecran, design §3);
//  - cardul de alertă (bara n-ar face decât să acopere câmpul — și tastatura de pe iOS);
//  - subsolul site-ului (ultimul rând de pagină rămâne vizibil).
// z-40: bannerul de cookies (z-[60]) și meniul (z-50) stau deasupra ei.

interface Props {
  offer: {
    offerId: string
    productId: string
    productName: string
    merchantName: string
    price: number | null
    category: string | null
    discountPct: number | null
  }
  verdict: DiscountVerdict
  verdictShort: string          // „−18,2% vs. mediană” / „preț obișnuit” …
  hasAlert: boolean
}

export function StickyBuyBar({ offer, verdict, verdictShort, hasAlert }: Props) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const targets = [
      document.querySelector('[data-best-offer]'),
      document.getElementById(ALERT_CARD_ID),
      document.querySelector('footer'),
    ].filter((el): el is Element => el != null)
    // Fără IntersectionObserver (browsere foarte vechi): bara rămâne mereu vizibilă
    if (typeof IntersectionObserver === 'undefined') { const r = requestAnimationFrame(() => setVisible(true)); return () => cancelAnimationFrame(r) }
    const onScreen = new Map<Element, boolean>()
    // Banda de jos (înălțimea barei) nu contează ca „pe ecran”: un buton ascuns sub bară nu se vede
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) onScreen.set(e.target, e.isIntersecting)
      setVisible(![...onScreen.values()].some(Boolean))
    }, { rootMargin: '0px 0px -80px 0px' })
    targets.forEach((t) => io.observe(t))
    if (!targets.length) requestAnimationFrame(() => setVisible(true))
    return () => io.disconnect()
  }, [])

  function goToAlert() {
    const input = document.getElementById(ALERT_INPUT_ID) as HTMLInputElement | null
    // Focus ÎNTÂI (sincron, în gestul utilizatorului — altfel iOS nu deschide tastatura), apoi derulare
    input?.focus({ preventScroll: true })
    input?.select()
    document.getElementById(ALERT_CARD_ID)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const tone = verdict === 'real' ? 'font-bold text-red-ink' : verdict === 'higher' ? 'font-bold text-amber-ink' : ''

  return (
    <div
      // aria-hidden + inert când e ascunsă: linkurile nu rămân în ordinea de tab
      aria-hidden={!visible}
      inert={!visible}
      className={`lg:hidden fixed inset-x-0 bottom-0 z-40 flex items-center gap-2.5 border-t border-line bg-[color-mix(in_srgb,var(--surface)_94%,transparent)] px-3 pt-2.5 pb-[calc(10px+env(safe-area-inset-bottom))] backdrop-blur-md transition-transform duration-200 ${
        visible ? 'translate-y-0' : 'translate-y-[110%]'
      }`}
    >
      <div className="min-w-0 flex-1 leading-tight">
        <b className="block font-display text-[19px] font-extrabold tabular-nums text-ink">{formatPrice(offer.price)}</b>
        <span className="block truncate text-xs text-ink-3">
          {offer.merchantName} · <span className={tone}>{verdictShort}</span>
        </span>
      </div>
      {hasAlert && (
        <button
          type="button"
          onClick={goToAlert}
          aria-label="Alertă de preț: alege pragul"
          className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-surface ring-inset focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
            verdict === 'higher' ? 'text-amber-ink ring-2 ring-amber' : 'text-ink ring-[1.5px] ring-line-2'
          }`}
        >
          <BellIcon className="h-[21px] w-[21px]" />
        </button>
      )}
      <AffiliateLink {...offer} className={`${btn('primary')} shrink-0`}>
        Vezi oferta
        <ExternalIcon />
      </AffiliateLink>
    </div>
  )
}
