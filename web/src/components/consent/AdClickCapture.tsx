'use client'

import { useEffect } from 'react'
import { hasAdConsent, CONSENT_CHANGE_EVENT } from '@/lib/consent'
import {
  AD_CLICK_COOKIE, AD_CLICK_PENDING_KEY, idsFromSearch, parseAdClickCookie,
  writeAdClickCookie, clearAdClickCookie,
} from '@/lib/adclick'

// Capteaza identificatorul clickului pe reclama Google (gclid / gbraid / wbraid) la aterizare,
// ca /go/[offerId] sa-l poata lega de click_id → comisionul Profitshare ajunge in Google Ads
// ca conversie. Nu afiseaza nimic.
//
// Regula 7 (GDPR, REGULI.md): ID-ul se PASTREAZA doar cu acordul „Publicitate”.
//   - cu acord          → cookie first-party `se_gclid`, 90 de zile;
//   - fara acord (inca) → doar sessionStorage `se_gclid_pending` (memoria tab-ului, dispare la
//                         inchidere, nu pleaca la server); daca acordul vine in aceeasi sesiune,
//                         il mutam in cookie;
//   - acord retras      → stergem si cookie-ul, si ID-ul in asteptare.
export function AdClickCapture() {
  useEffect(() => {
    // Mutarea / stergerea in functie de acordul curent. Apelata la montare si la orice
    // schimbare de acord (banner, butonul din footer).
    const sync = () => {
      let pending: string | null = null
      try { pending = sessionStorage.getItem(AD_CLICK_PENDING_KEY) } catch { /* storage blocat */ }

      if (hasAdConsent()) {
        const ids = parseAdClickCookie(pending)
        if (ids) writeAdClickCookie(ids)
        try { sessionStorage.removeItem(AD_CLICK_PENDING_KEY) } catch { /* ignoram */ }
      } else {
        // Fara acord valid (refuzat, retras sau versiune veche de politica) nu ramane nimic
        // persistent. ID-ul in asteptare ramane in tab DOAR daca nu s-a refuzat explicit —
        // vezi handler-ul de eveniment de mai jos.
        if (document.cookie.split('; ').some((c) => c.startsWith(AD_CLICK_COOKIE + '='))) clearAdClickCookie()
      }
    }

    // 1. Aterizare cu ID in URL
    const ids = idsFromSearch(window.location.search)
    if (ids) {
      if (hasAdConsent()) {
        writeAdClickCookie(ids)   // un click nou pe reclama inlocuieste ID-ul vechi
      } else {
        try { sessionStorage.setItem(AD_CLICK_PENDING_KEY, encodeURIComponent(JSON.stringify(ids))) } catch { /* ignoram */ }
      }
    }
    sync()

    // 2. Acordul se schimba in timpul sesiunii
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<{ ads?: boolean }>).detail
      if (detail && detail.ads === false) {
        // Refuz / retragere explicita → stergem tot, inclusiv ID-ul din memoria tab-ului
        try { sessionStorage.removeItem(AD_CLICK_PENDING_KEY) } catch { /* ignoram */ }
      }
      sync()
    }
    window.addEventListener(CONSENT_CHANGE_EVENT, onChange)
    return () => window.removeEventListener(CONSENT_CHANGE_EVENT, onChange)
  }, [])

  return null
}
