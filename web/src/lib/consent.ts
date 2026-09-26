// Consimtamant cookies (banner propriu) + Google Consent Mode v2.
//
// Cum functioneaza:
// 1. Inainte de orice tag Google, CONSENT_DEFAULT_SCRIPT seteaza totul pe 'denied' si,
//    daca vizitatorul a ales deja, reaplica alegerea salvata (fara sa astepte React).
// 2. Bannerul (components/consent/CookieBanner.tsx) salveaza alegerea in cookie-ul
//    CONSENT_COOKIE si trimite gtag('consent', 'update', ...).
// 3. Restul codului intreaba hasAdConsent() / hasAnalyticsConsent() inainte sa salveze
//    identificatori de reclama (gclid etc.) — vezi docs/ads-program/REGULI.md, regula 7.

export const CONSENT_COOKIE = 'se_consent'
// Cerem din nou consimtamantul dupa 6 luni (practica recomandata de ghidurile GDPR)
const MAX_AGE_SECONDS = 180 * 24 * 60 * 60
// Versiunea politicii: daca schimbam categoriile, cresti numarul → bannerul reapare
export const CONSENT_VERSION = 2   // v2 (26 sep 2026): „Publicitate” include și bannerele Profitshare

// Evenimente de browser folosite intre banner, butonul din footer si tracking
export const CONSENT_CHANGE_EVENT = 'se:consent-change'
export const OPEN_SETTINGS_EVENT = 'se:open-cookie-settings'

export interface ConsentChoice {
  v: number
  analytics: boolean   // GA4 → analytics_storage
  ads: boolean         // Google Ads → ad_storage + ad_user_data + ad_personalization
  ts: number           // momentul alegerii (ms)
}

export function readConsent(): ConsentChoice | null {
  if (typeof document === 'undefined') return null
  const raw = document.cookie.split('; ').find((c) => c.startsWith(CONSENT_COOKIE + '='))
  if (!raw) return null
  try {
    const parsed = JSON.parse(decodeURIComponent(raw.slice(CONSENT_COOKIE.length + 1)))
    if (parsed?.v !== CONSENT_VERSION) return null
    return { v: parsed.v, analytics: parsed.analytics === true, ads: parsed.ads === true, ts: Number(parsed.ts) || 0 }
  } catch {
    return null
  }
}

export function hasAdConsent(): boolean {
  return readConsent()?.ads === true
}

export function hasAnalyticsConsent(): boolean {
  return readConsent()?.analytics === true
}

// Mapare alegere → semnalele Consent Mode v2
function toGtagConsent(c: Pick<ConsentChoice, 'analytics' | 'ads'>) {
  const ads = c.ads ? 'granted' : 'denied'
  return {
    analytics_storage: c.analytics ? 'granted' : 'denied',
    ad_storage: ads,
    ad_user_data: ads,
    ad_personalization: ads,
  }
}

export function saveConsent(choice: { analytics: boolean; ads: boolean }): void {
  const value: ConsentChoice = { v: CONSENT_VERSION, ...choice, ts: Date.now() }
  const secure = location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify(value))}; Max-Age=${MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`

  // gtag exista doar in productie (vezi GoogleAnalytics.tsx); in dev e no-op
  const w = window as unknown as { gtag?: (...args: unknown[]) => void }
  w.gtag?.('consent', 'update', toGtagConsent(value))

  window.dispatchEvent(new CustomEvent(CONSENT_CHANGE_EVENT, { detail: value }))
}

export function openCookieSettings(): void {
  window.dispatchEvent(new Event(OPEN_SETTINGS_EVENT))
}

// Script inline rulat INAINTEA tag-urilor Google (strategy="beforeInteractive").
// Scris ca string simplu (fara import-uri) pentru ca ruleaza inainte de bundle-ul Next.
export const CONSENT_DEFAULT_SCRIPT = `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = gtag;
gtag('consent', 'default', {
  analytics_storage: 'denied',
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  wait_for_update: 500
});
gtag('set', 'ads_data_redaction', true);
try {
  var m = document.cookie.match(/(?:^|; )${CONSENT_COOKIE}=([^;]*)/);
  if (m) {
    var c = JSON.parse(decodeURIComponent(m[1]));
    if (c && c.v === ${CONSENT_VERSION}) {
      var ads = c.ads === true ? 'granted' : 'denied';
      gtag('consent', 'update', {
        analytics_storage: c.analytics === true ? 'granted' : 'denied',
        ad_storage: ads, ad_user_data: ads, ad_personalization: ads
      });
    }
  }
} catch (e) {}
`
