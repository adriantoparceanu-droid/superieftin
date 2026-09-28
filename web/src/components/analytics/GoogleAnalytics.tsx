import Script from 'next/script'
import { CONSENT_DEFAULT_SCRIPT } from '@/lib/consent'
import { GaAdminOptOut } from './GaAdminOptOut'

// Scriptul GA4 — injectat DOAR in productie si doar daca Measurement ID e configurat.
// In development nu se incarca nimic, deci gaEvent() devine no-op.
//
// Ordinea conteaza (Consent Mode v2): 'consent-default' ruleaza beforeInteractive, deci
// INAINTE de gtag.js si de 'config' — Google vede intai starea 'denied' (sau alegerea
// salvata a vizitatorului) si abia apoi porneste masurarea.
//
// Adminul (/admin/*) NU se masoara: altfel vizitele proprietarului umfla statisticile (pagini
// /admin in top, clickuri „spre magazine” din admin). Folosim comutatorul oficial GA
// window['ga-disable-<ID>'] = true — pus INAINTE de 'config', deci nici prima afisare de pagina
// nu pleaca. GaAdminOptOut il actualizeaza la navigarea fara reincarcare (admin → site).
export function GoogleAnalytics() {
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID
  if (process.env.NODE_ENV !== 'production' || !gaId) return null

  return (
    <>
      <Script id="consent-default" strategy="beforeInteractive">
        {CONSENT_DEFAULT_SCRIPT}
      </Script>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window['ga-disable-${gaId}'] = /^\\/admin(\\/|$)/.test(location.pathname);
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${gaId}');
        `}
      </Script>
      <GaAdminOptOut gaId={gaId} />
    </>
  )
}
