import type { NextRequest } from 'next/server'
import { ADMIN_SESSION_COOKIE, INTERNAL_COOKIE, parseToken } from './admin/session'

// Recunoaste clickurile care NU vin de la clienti, ca sa nu umfle statisticile din admin
// (folosit de ruta /go). Trei semne, oricare e suficient:
//   1. browserul are o sesiune de admin valida (esti logat in /admin);
//   2. browserul are cookie-ul INTERNAL_COOKIE (admin/session.ts) — pus la login si pastrat 1 an, si dupa logout,
//      ca sa fie recunoscut si cand sesiunea de 7 zile a expirat;
//   3. user-agent-ul e de robot sau de unealta (curl, scripturi, browser automat de test) —
//      un client real are mereu un browser obisnuit.
// Cookie-ul se poate pune si de mana, dar efectul e doar ca acel browser nu mai e numarat.

const NON_CLIENT_UA = /bot|crawl|spider|slurp|curl|wget|python|axios|node-fetch|undici|node\.js|go-http|java\/|okhttp|libwww|httpclient|postman|insomnia|headless|playwright|puppeteer|lighthouse|facebookexternalhit|preview/i

export function hasValidAdminSession(req: NextRequest): boolean {
  try {
    return parseToken(req.cookies.get(ADMIN_SESSION_COOKIE)?.value) !== null
  } catch {
    // ADMIN_SESSION_SECRET lipsa → nu putem verifica sesiunea; nu blocam clickul
    return false
  }
}

export function isInternalRequest(req: NextRequest): boolean {
  if (req.cookies.get(INTERNAL_COOKIE)?.value === '1') return true
  if (hasValidAdminSession(req)) return true
  const ua = req.headers.get('user-agent') ?? ''
  return ua === '' || NON_CLIENT_UA.test(ua)
}
