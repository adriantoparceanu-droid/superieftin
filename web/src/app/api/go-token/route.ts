import { NextRequest, NextResponse } from 'next/server'
import redis from '@/lib/redis'
import { clientIp } from '@/lib/rate-limit'
import { checkRateLimit, goTokenRateLimits } from '@/lib/go-rate-limit'
import { goTokenSecret, signGoToken } from '@/lib/go-token'

// POST /api/go-token  { offerId: number }  →  { token, expiresAt }
//
// Tokenul cu care /go/[offerId] accepta sa trimita vizitatorul spre magazin (lib/go-token.ts).
// Il cer DOAR scripturile noastre: AffiliateLink (la trecerea mouse-ului / atingere / click) si
// pagina intermediara. Un robot care nu ruleaza JS nu ajunge niciodata aici.
//
// Nu atinge baza de date (tokenul se semneaza pentru orice ID numeric; /go/ verifica oricum
// oferta), nu pune cookie-uri, nu salveaza nimic. Limita de viteza per IP: lib/go-rate-limit.ts.

const NO_STORE = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' }

export async function POST(req: NextRequest) {
  // Browserele trimit singure Sec-Fetch-Site; un apel de pe alt site (alt domeniu care ar vrea
  // sa „imprumute” tokenuri prin browserul vizitatorului) e refuzat. Lipsa headerului (browsere
  // vechi) e acceptata.
  const site = req.headers.get('sec-fetch-site')
  if (site && site !== 'same-origin' && site !== 'none') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403, headers: NO_STORE })
  }

  let offerId = NaN
  try {
    const body = await req.json()
    offerId = Number(body?.offerId)
  } catch { /* corp invalid */ }
  if (!Number.isSafeInteger(offerId) || offerId <= 0) {
    return NextResponse.json({ error: 'offerId' }, { status: 400, headers: NO_STORE })
  }

  const secret = goTokenSecret()
  if (!secret) {
    // Fara secret pe server verificarea tokenului e oprita in /go/ → linkul simplu merge oricum
    return NextResponse.json({ error: 'disabled' }, { status: 503, headers: NO_STORE })
  }

  const limit = await checkRateLimit(redis, 'tok', clientIp(req.headers), goTokenRateLimits(), secret)
  if (!limit.allowed) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: { ...NO_STORE, 'Retry-After': '60' } })
  }

  const { token, expiresAt } = signGoToken(secret, offerId)
  return NextResponse.json({ token, expiresAt }, { headers: NO_STORE })
}
