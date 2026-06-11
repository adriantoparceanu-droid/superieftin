'use client'

import { gaEvent } from '@/lib/ga'

interface Props {
  offerId: string
  productName: string
  merchantName: string
  price: number | null
  category: string | null
  className?: string
  children: React.ReactNode
}

// Link spre magazin extern (prin /go/{offerId}) cu tracking GA4 'click_affiliate_link'.
// Evenimentul pleaca inainte de navigare; target=_blank lasa pagina curenta deschisa,
// deci requestul GA nu se pierde.
export function AffiliateLink({ offerId, productName, merchantName, price, category, className, children }: Props) {
  return (
    <a
      href={`/go/${offerId}`}
      target="_blank"
      rel="noopener sponsored"
      className={className}
      onClick={() => {
        gaEvent('click_affiliate_link', {
          product_name: productName,
          merchant_name: merchantName,
          price: price ?? undefined,
          category: category ?? undefined,
        })
      }}
    >
      {children}
    </a>
  )
}
