'use client'

import { gaEvent } from '@/lib/ga'
import { cachedGoToken, fetchGoToken, goHref } from '@/lib/go-token-client'

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
//
// Protectia anti-roboti (lib/go-token.ts): cand vizitatorul se pregateste sa dea click (mouse
// peste buton, atingere, focus din tastatura, apasarea butonului mouse-ului — inclusiv rotita,
// pentru „deschide in tab nou”), cerem un token si il lipim pe link (/go/123?t=…). In HTML
// linkul ramane /go/123: un robot care nu ruleaza JS ajunge doar pe pagina intermediara.
export function AffiliateLink({ offerId, productId, productName, merchantName, price, category, discountPct, className, children }: Props) {
  // Modificam direct atributul href al linkului (nu prin state React): trebuie sa fie gata
  // SINCRON in momentul clickului, iar React nu-l rescrie, pentru ca prop-ul href nu se schimba.
  function prepare(a: HTMLAnchorElement) {
    const t = cachedGoToken(offerId)
    if (t) { a.href = goHref(offerId, t); return }
    fetchGoToken(offerId).then(d => { if (d) a.href = goHref(offerId, d.token) })
  }

  return (
    <a
      href={goHref(offerId)}
      target="_blank"
      // sponsored + nofollow: link platit (afiliere) — cerinta Google pentru linkurile de afiliere
      rel="noopener sponsored nofollow"
      className={className}
      onMouseEnter={e => prepare(e.currentTarget)}
      onFocus={e => prepare(e.currentTarget)}
      onTouchStart={e => prepare(e.currentTarget)}
      onPointerDown={e => prepare(e.currentTarget)}
      onClick={e => {
        // Ultima sansa: daca tokenul a sosit intre timp, il punem acum (browserul citeste href-ul
        // dupa acest handler). Altfel linkul simplu → pagina intermediara continua singura.
        const t = cachedGoToken(offerId)
        if (t) e.currentTarget.href = goHref(offerId, t)
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
