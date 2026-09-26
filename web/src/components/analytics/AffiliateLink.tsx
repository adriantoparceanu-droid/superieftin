'use client'

import { gaEvent } from '@/lib/ga'

interface Props {
  offerId: string
  productId?: string | null
  productName: string
  merchantName: string
  price: number | null
  category: string | null
  // Reducerea fata de mediana 30 zile, DOAR daca e afisata ca reala pe pagina (altfel null)
  discountPct?: number | null
  className?: string
  children: React.ReactNode
}

// Link spre magazin extern (prin /go/{offerId}) cu tracking GA4 'click_affiliate_link'.
// Evenimentul pleaca inainte de navigare; target=_blank lasa pagina curenta deschisa, iar
// transport_type 'beacon' (navigator.sendBeacon) garanteaza livrarea chiar daca tab-ul se
// inchide imediat. Consent Mode decide ce ajunge la Google (gtag respecta starea 'denied').
//
// NU trimitem click_id-ul intern sau date personale in GA4 — doar date despre produs.
// In Google Ads evenimentul se importa DOAR ca conversie SECUNDARA (REGULI.md → GA4).
export function AffiliateLink({ offerId, productId, productName, merchantName, price, category, discountPct, className, children }: Props) {
  return (
    <a
      href={`/go/${offerId}`}
      target="_blank"
      // sponsored + nofollow: link platit (afiliere) — cerinta Google pentru linkurile de afiliere
      rel="noopener sponsored nofollow"
      className={className}
      onClick={() => {
        gaEvent('click_affiliate_link', {
          product_id: productId ?? undefined,
          product_name: productName,
          merchant_name: merchantName,   // „store” din specificatie — numele magazinului
          price: price ?? undefined,
          category: category ?? undefined,
          discount_pct: discountPct ?? undefined,
          transport_type: 'beacon',
        })
      }}
    >
      {children}
    </a>
  )
}
