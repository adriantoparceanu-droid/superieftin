import Script from 'next/script'
import { CONSENT_DEFAULT_SCRIPT } from '@/lib/consent'

// Scriptul GA4 — injectat DOAR in productie si doar daca Measurement ID e configurat.
// In development nu se incarca nimic, deci gaEvent() devine no-op.
//
// Ordinea conteaza (Consent Mode v2): 'consent-default' ruleaza beforeInteractive, deci
// INAINTE de gtag.js si de 'config' — Google vede intai starea 'denied' (sau alegerea
// salvata a vizitatorului) si abia apoi porneste masurarea.
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
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${gaId}');
        `}
      </Script>
    </>
  )
}
