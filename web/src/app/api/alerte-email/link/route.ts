import { NextRequest, NextResponse } from 'next/server'
import redis from '@/lib/redis'
import { clientIp } from '@/lib/rate-limit'
import { checkRateLimit } from '@/lib/go-rate-limit'
import { alertTokenSecret } from '@/lib/alert-token'
import { emailAlertRateLimits, emailAlertsEnabled, normalizeEmail } from '@/lib/email-alerts'
import { confirmedSubscriberIdByEmail, enqueueEmailJob } from '@/lib/email-alerts-db'

// POST /api/alerte-email/link  { email, website }  →  { ok, message }
// „Trimite-mi din nou linkul către Alertele mele” (pentru cine a pierdut emailul / linkul a expirat).
// Acelasi raspuns pentru orice adresa — nu dezvaluim cine e abonat. Limita per IP ca la abonare.

const NO_STORE = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' }
const MESSAGE = 'Dacă adresa are alerte confirmate, îți trimitem în câteva minute un email cu linkul către alertele tale.'

export async function POST(req: NextRequest) {
  const site = req.headers.get('sec-fetch-site')
  if (site && site !== 'same-origin' && site !== 'none') return NextResponse.json({ error: 'Cerere refuzată.' }, { status: 403, headers: NO_STORE })
  if (!emailAlertsEnabled()) return NextResponse.json({ error: 'Alertele pe email nu sunt disponibile momentan.' }, { status: 503, headers: NO_STORE })

  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* corp invalid */ }

  const limit = await checkRateLimit(redis, 'alerta', clientIp(req.headers), emailAlertRateLimits(), alertTokenSecret())
  if (!limit.allowed) return NextResponse.json({ error: 'Prea multe cereri. Încearcă din nou peste câteva minute.' }, { status: 429, headers: NO_STORE })

  if (typeof body.website === 'string' && body.website.trim() !== '') return NextResponse.json({ ok: true, message: MESSAGE }, { headers: NO_STORE })
  const email = normalizeEmail(body.email)
  if (!email) return NextResponse.json({ error: 'Adresa de email nu pare corectă.' }, { status: 400, headers: NO_STORE })

  try {
    const id = await confirmedSubscriberIdByEmail(email)
    if (id != null) await enqueueEmailJob('manage-link', { subscriberId: id })
  } catch (err) {
    console.error('alerte-email: eroare la cererea linkului', err)
  }
  return NextResponse.json({ ok: true, message: MESSAGE }, { headers: NO_STORE })
}
