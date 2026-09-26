'use client'

import { useEffect } from 'react'
import { readConsent, CONSENT_CHANGE_EVENT } from '@/lib/consent'
import {
  AD_CLICK_COOKIE, LEGACY_PENDING_KEY, WITHDRAW_ENDPOINT, idsFromSearch, readAdClickCookie,
  writeAdClickCookie, clearAdClickCookie, type AdClickIds,
} from '@/lib/adclick'

// Capteaza identificatorul clickului pe reclama Google (gclid / gbraid / wbraid) la aterizare,
// ca /go/[offerId] sa-l poata lega de click_id → comisionul Profitshare ajunge in Google Ads
// ca conversie. Nu afiseaza nimic.
//
// Regula 7 (GDPR, REGULI.md) + Poarta 2 (B1, B4):
//   - cu acord „Publicitate”  → cookie first-party `se_gclid`, 90 de zile de la aterizare;
//   - fara alegere (inca)     → ID-ul sta DOAR in variabila `pendingIds` de mai jos, in memoria
//                               paginii: NIMIC pe dispozitiv (fara cookie, sessionStorage sau
//                               localStorage — si acestea sunt „stocare pe echipament”, art. 5(3)
//                               ePrivacy). Supravietuieste navigarii in site (App Router nu
//                               reincarca pagina), se pierde la reincarcare / inchiderea filei.
//                               Daca acordul vine intre timp, il mutam in cookie;
//   - refuz explicit          → nu pastram nimic, nici in memorie;
//   - acord retras            → trimitem ID-ul (beacon) la /api/consent/withdraw, care il sterge
//                               din clickurile deja inregistrate pe server, apoi stergem cookie-ul.

// La nivel de modul (nu in state React): ramane intre navigari si intre re-montari ale
// componentei, dar nu atinge niciodata stocarea browserului.
let pendingIds: AdClickIds | null = null

function hasAdClickCookie(): boolean {
  return document.cookie.split('; ').some((c) => c.startsWith(AD_CLICK_COOKIE + '='))
}

// Retragere: serverul goleste gclid/gbraid/wbraid din ad_clicks pentru acest ID, ca workerul sa
// nu mai trimita la Google conversii pentru clickurile facute inainte de retragere. sendBeacon
// pleaca si daca pagina se inchide imediat. Se trimit DOAR ID-urile — nicio alta data.
function notifyWithdraw(): void {
  const ids = readAdClickCookie()
  if (!ids) return
  const body = new URLSearchParams()
  for (const k of ['gclid', 'gbraid', 'wbraid'] as const) if (ids[k]) body.set(k, ids[k]!)
  try {
    if (!navigator.sendBeacon?.(WITHDRAW_ENDPOINT, body)) {
      void fetch(WITHDRAW_ENDPOINT, { method: 'POST', body, keepalive: true }).catch(() => {})
    }
  } catch { /* fara retea — cookie-ul se sterge oricum mai jos */ }
}

export function AdClickCapture() {
  useEffect(() => {
    // Curatenie: versiunea anterioara tinea ID-ul in sessionStorage inainte de acord
    try { sessionStorage.removeItem(LEGACY_PENDING_KEY) } catch { /* storage blocat */ }

    // Aplica starea curenta a acordului. Apelata la montare si la orice schimbare de acord
    // (banner, butonul din footer).
    const sync = () => {
      const consent = readConsent()
      if (consent?.ads === true) {
        // Acord acum: ID-ul din memorie sau, daca pagina tocmai s-a incarcat cu el, din URL
        const ids = pendingIds ?? idsFromSearch(window.location.search)
        if (ids) writeAdClickCookie(ids)   // un click nou pe reclama inlocuieste ID-ul vechi
        pendingIds = null
        return
      }
      if (consent?.ads === false) {
        // Refuz / retragere explicita: nimic nu ramane, nici in memorie. Daca exista inca
        // cookie-ul (acordul tocmai a fost retras, poate din alta fila), anuntam serverul
        // INAINTE sa-l stergem — altfel pierdem ID-ul de care e nevoie pentru stergere.
        pendingIds = null
        if (hasAdClickCookie()) { notifyWithdraw(); clearAdClickCookie() }
        return
      }
      // Fara alegere valida (banner inca deschis, acord expirat sau versiune veche de politica):
      // cookie-ul nu are temei → il stergem; ID-ul de la aterizare ramane doar in memorie.
      if (hasAdClickCookie()) clearAdClickCookie()
    }

    // Aterizare cu ID in URL: fara alegere inca → doar in memorie (sync decide restul)
    const landing = idsFromSearch(window.location.search)
    if (landing && readConsent() == null) pendingIds = landing
    sync()

    window.addEventListener(CONSENT_CHANGE_EVENT, sync)
    return () => window.removeEventListener(CONSENT_CHANGE_EVENT, sync)
  }, [])

  return null
}
