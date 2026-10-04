'use client'

import { gaEvent } from '@/lib/ga'

// Butonul de alerta de pret (Telegram) din cardul „Alertă de preț” (components/product/PriceAlertCard.tsx). Logica pragului si a linkului:
// lib/price-alert.ts. Alerta propriu-zisa se creeaza in conversatia cu botul
// (worker/src/workers/bot.worker.ts), deci pe site vedem doar clickul pe buton.

// 'actiuni' = cardul de alerta al unui produs disponibil; 'indisponibil' = fara oferte azi.
// (Bara fixa de jos nu mai deschide Telegram: clopotelul ei duce la card — StickyBuyBar.)
export type AlertPlacement = 'actiuni' | 'indisponibil'

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
// doar produsul si pragul ales. gtag respecta Consent Mode: fara acord „analiza”, Google
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
