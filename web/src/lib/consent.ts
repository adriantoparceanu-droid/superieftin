// Consimtamant cookies (banner propriu) + Google Consent Mode v2.
//
// Cum functioneaza:
// 1. Inainte de orice tag Google, CONSENT_DEFAULT_SCRIPT seteaza totul pe 'denied' si,
//    daca vizitatorul a ales deja, reaplica alegerea salvata (fara sa astepte React).
// 2. Bannerul (components/consent/CookieBanner.tsx) salveaza alegerea in cookie-ul
//    CONSENT_COOKIE si trimite gtag('consent', 'update', ...).
// 3. Restul codului intreaba hasAdConsent() / hasAnalyticsConsent() inainte sa salveze
//    identificatori de reclama (gclid etc.) — vezi docs/ads-program/REGULI.md, regula 7.
//
// Categorii: analiza (GA4) si publicitate. „Publicitate” = masurarea reclamelor (gclid, conversii
// offline, bannere Profitshare) SI, din 2026-10-03, reclame personalizate (remarketing: Google ne
// poate arata reclamele celor care au vazut un produs pe site). Decizia proprietarului: banner cat
// mai simplu, fara bifa separata. Detalii: docs/ads-program/remarketing-vizitatori.md.

export const CONSENT_COOKIE = 'se_consent'
// Cerem din nou consimtamantul dupa 6 luni (practica recomandata de ghidurile GDPR)
const MAX_AGE_SECONDS = 180 * 24 * 60 * 60
// Versiunea politicii: daca schimbam categoriile, cresti numarul → bannerul reapare
export const CONSENT_VERSION = 2   // v2 (26 sep 2026): „Publicitate” include și bannerele Profitshare
//
// Acordurile v2 date INAINTE de 3 oct 2026: textul de atunci al „Publicitate” nu pomenea reclamele
// personalizate, deci acel acord NU acopera remarketingul. Solutia cea mai simpla, fara sa
// redeschidem bannerul si fara sa stergem gclid-uri (o versiune noua ar face AdClickCapture sa
// retraga ID-urile tuturor): marcajul `personalization` din cookie. saveConsent() il scrie egal cu
// `ads` — deci orice acord dat (sau re-salvat din „Setări cookies”) cu textul nou il are; cookie-urile
// vechi nu au campul → ad_personalization ramane 'denied' pana cand omul isi re-salveaza alegerea
// sau acordul expira (6 luni) si raspunde din nou la banner.

// Evenimente de browser folosite intre banner, butonul din footer si tracking
export const CONSENT_CHANGE_EVENT = 'se:consent-change'
export const OPEN_SETTINGS_EVENT = 'se:open-cookie-settings'

export interface ConsentChoice {
  v: number
  analytics: boolean   // GA4 → analytics_storage
  ads: boolean         // Google Ads → ad_storage + ad_user_data
  // Marcaj: acordul „Publicitate” a fost dat cu textul care include reclamele personalizate
  // (salvat dupa 3 oct 2026) → ad_personalization. Lipsa campului (cookie vechi) = false.
  personalization: boolean
  ts: number           // momentul alegerii (ms)
}

// Ce alege vizitatorul in banner (doua categorii)
export type ConsentSelection = Pick<ConsentChoice, 'analytics' | 'ads'>

// Parseaza valoarea cookie-ului de consimtamant (encodata URI). Folosit si pe server
// (/go citeste consimtamantul din cererea HTTP), deci fara acces la document.
export function parseConsentCookie(value: string | undefined | null): ConsentChoice | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(decodeURIComponent(value))
    if (parsed?.v !== CONSENT_VERSION) return null
    const ads = parsed.ads === true
    return {
      v: parsed.v, analytics: parsed.analytics === true, ads,
      // Marcajul conteaza doar impreuna cu „Publicitate”. Cookie-urile v2 de dinainte de
      // 3 oct 2026 nu au campul → false (acordul lor nu acoperea reclamele personalizate).
      personalization: ads && parsed.personalization === true,
      ts: Number(parsed.ts) || 0,
    }
  } catch {
    return null
  }
}

export function readConsent(): ConsentChoice | null {
  if (typeof document === 'undefined') return null
  const raw = document.cookie.split('; ').find((c) => c.startsWith(CONSENT_COOKIE + '='))
  return raw ? parseConsentCookie(raw.slice(CONSENT_COOKIE.length + 1)) : null
}

export function hasAdConsent(): boolean {
  return readConsent()?.ads === true
}

export function hasAnalyticsConsent(): boolean {
  return readConsent()?.analytics === true
}

// Mapare alegere salvata → semnalele Consent Mode v2.
// „Publicitate” acordat cu textul nou → ad_storage, ad_user_data si ad_personalization 'granted';
// refuzat → toate 'denied'. Acordul vechi (fara marcaj) → ad_personalization 'denied': un acord
// pentru un scop despre care omul nu a fost informat nu e valabil (GDPR, Poarta 2 — B2/R5).
// Conversiile offline din worker (Data Manager) raman cu adPersonalization = CONSENT_DENIED:
// ele servesc masurarii, nu remarketingului, si nu stim per click daca exista acordul.
export function toGtagConsent(c: Pick<ConsentChoice, 'analytics' | 'ads' | 'personalization'>) {
  const ads = c.ads ? 'granted' : 'denied'
  return {
    analytics_storage: c.analytics ? 'granted' : 'denied',
    ad_storage: ads,
    ad_user_data: ads,
    ad_personalization: c.ads && c.personalization ? 'granted' : 'denied',
  }
}

export function saveConsent(choice: ConsentSelection): void {
  // Alegerea se face acum cu textul nou al bannerului → marcajul de personalizare urmeaza „Publicitate”
  const value: ConsentChoice = { v: CONSENT_VERSION, ...choice, personalization: choice.ads, ts: Date.now() }
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
        ad_storage: ads, ad_user_data: ads,
        ad_personalization: (c.ads === true && c.personalization === true) ? 'granted' : 'denied'
      });
    }
  }
} catch (e) {}
`
