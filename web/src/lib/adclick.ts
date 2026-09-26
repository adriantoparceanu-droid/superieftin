// Identificatorul clickului pe reclama Google (gclid / gbraid / wbraid), pastrat DOAR cu
// consimtamant „Publicitate” (REGULI.md, regula 7), 90 de zile, in cookie first-party.
// Scris in browser (components/consent/AdClickCapture.tsx), citit pe server de /go/[offerId],
// care il leaga de click_id in ad_clicks → workerul il trimite la Google cu comisionul.

export const AD_CLICK_COOKIE = 'se_gclid'
export const AD_CLICK_MAX_AGE_DAYS = 90
// Pana la consimtamant, ID-ul din URL-ul de aterizare sta doar in memoria tab-ului
export const AD_CLICK_PENDING_KEY = 'se_gclid_pending'

export interface AdClickIds {
  gclid?: string
  gbraid?: string
  wbraid?: string
  ts: number          // momentul aterizarii (ms)
}

// Doar caractere sigure — ID-urile Google sunt [A-Za-z0-9_-]; orice altceva e ignorat
const SAFE = /^[A-Za-z0-9_-]{10,300}$/

export function idsFromSearch(search: string): AdClickIds | null {
  const q = new URLSearchParams(search)
  const out: AdClickIds = { ts: Date.now() }
  for (const k of ['gclid', 'gbraid', 'wbraid'] as const) {
    const v = q.get(k)
    if (v && SAFE.test(v)) out[k] = v
  }
  return out.gclid || out.gbraid || out.wbraid ? out : null
}

export function parseAdClickCookie(value: string | undefined | null): AdClickIds | null {
  if (!value) return null
  try {
    const p = JSON.parse(decodeURIComponent(value))
    const out: AdClickIds = { ts: Number(p?.ts) || 0 }
    for (const k of ['gclid', 'gbraid', 'wbraid'] as const) if (typeof p?.[k] === 'string' && SAFE.test(p[k])) out[k] = p[k]
    if (!(out.gclid || out.gbraid || out.wbraid)) return null
    if (Date.now() - out.ts > AD_CLICK_MAX_AGE_DAYS * 86400_000) return null
    return out
  } catch {
    return null
  }
}

// --- Doar in browser (apelate din AdClickCapture) ---------------------------------------

export function writeAdClickCookie(ids: AdClickIds): void {
  const secure = location.protocol === 'https:' ? '; Secure' : ''
  const maxAge = AD_CLICK_MAX_AGE_DAYS * 86400
  document.cookie = `${AD_CLICK_COOKIE}=${encodeURIComponent(JSON.stringify(ids))}; Max-Age=${maxAge}; Path=/; SameSite=Lax${secure}`
}

export function clearAdClickCookie(): void {
  document.cookie = `${AD_CLICK_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`
}

export function readAdClickCookie(): AdClickIds | null {
  const raw = document.cookie.split('; ').find((c) => c.startsWith(AD_CLICK_COOKIE + '='))
  return raw ? parseAdClickCookie(raw.slice(AD_CLICK_COOKIE.length + 1)) : null
}
