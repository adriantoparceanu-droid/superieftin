'use client'

import { useEffect, useState } from 'react'
import { gaEvent } from '@/lib/ga'

// Butonul de alerta de pret (Telegram) + bara fixa de pe mobil. Logica pragului si a linkului:
// lib/price-alert.ts. Alerta propriu-zisa se creeaza in conversatia cu botul
// (worker/src/workers/bot.worker.ts), deci pe site vedem doar clickul pe buton.

export type AlertPlacement = 'actiuni' | 'bara-mobil' | 'indisponibil'

interface AlertButtonProps {
  href: string
  productId: string
  category: string | null
  price: number | null
  target: number | null
  placement: AlertPlacement
  className?: string
  children: React.ReactNode
}

// Evenimentul GA4 'price_alert_click' — fara date personale (nimic despre Telegram/utilizator),
// doar produsul si pragul propus. gtag respecta Consent Mode: fara acord „analiza”, Google
// primeste doar semnale fara cookie-uri (ca la 'click_affiliate_link'); in dev gaEvent e no-op.
// NU e conversie in Google Ads: e doar intentia de a seta o alerta.
export function PriceAlertButton({ href, productId, category, price, target, placement, className, children }: AlertButtonProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      onClick={() => {
        gaEvent('price_alert_click', {
          product_id: productId,
          category: category ?? undefined,
          price: price ?? undefined,
          target_price: target ?? undefined,
          channel: 'telegram',
          placement,
          transport_type: 'beacon',
        })
      }}
    >
      {children}
    </a>
  )
}

// Bara fixa jos, DOAR pe mobil (lg:hidden), cu cele doua actiuni. Ca sa nu acopere continut
// util, se ascunde cat timp e pe ecran blocul de actiuni din pagina (#actiuni-produs — acolo
// sunt aceleasi butoane) sau subsolul site-ului (ultimul rand de pagina ramane vizibil).
// Nu e pop-up: nu apare peste nimic la intrare in afara acestei benzi de ~64px, nu se poate
// „pierde” nimic sub ea (se ascunde la final de pagina), iar bannerul de cookies o acopera (z-50).
export function MobileActionBar({ watchId, children }: { watchId: string; children: React.ReactNode }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const targets = [document.getElementById(watchId), document.querySelector('footer')].filter(
      (el): el is HTMLElement => el != null,
    )
    if (targets.length === 0 || typeof IntersectionObserver === 'undefined') return
    const onScreen = new Map<Element, boolean>()
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) onScreen.set(e.target, e.isIntersecting)
      setVisible(![...onScreen.values()].some(Boolean))
    })
    targets.forEach((t) => io.observe(t))
    return () => io.disconnect()
  }, [watchId])

  return (
    <div
      // aria-hidden + inert cand e ascunsa: linkurile nu raman in ordinea de tab
      aria-hidden={!visible}
      inert={!visible}
      className={`lg:hidden fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-2px_8px_rgba(0,0,0,0.06)] transition-transform duration-200 ${
        visible ? 'translate-y-0' : 'translate-y-full'
      }`}
    >
      <div className="flex gap-2">{children}</div>
    </div>
  )
}
