import { NextRequest, NextResponse } from 'next/server'
import redis from '@/lib/redis'
import { clientIp } from '@/lib/rate-limit'
import { checkRateLimit } from '@/lib/go-rate-limit'
import { alertTokenSecret } from '@/lib/alert-token'
import {
  SUBSCRIBE_OK_MESSAGE, emailAlertRateLimits, emailAlertsEnabled, normalizeEmail, parseTargetPrice, targetBelowCurrent,
} from '@/lib/email-alerts'
import { createPendingAlert, enqueueEmailJob, getAlertProduct } from '@/lib/email-alerts-db'
import { formatPrice } from '@/lib/discount'

// POST /api/alerte-email  { productId, email, target, offerId?, website }  →  { ok, message } | { error }
//
// Cererea de alerta pe email din formularul de pe /p/ (components/EmailAlertForm.tsx). Creeaza o
// alerta NECONFIRMATA si cere workerului emailul de confirmare (double opt-in).
//
// Anti-abuz, fara captcha extern:
//   - doar de pe site (Sec-Fetch-Site), limita per IP in Redis (lib/go-rate-limit.ts, scope 'alerta');
//   - camp-capcana „website” (ascuns vizitatorilor): completat = robot → raspundem „ok”, nu facem nimic;
//   - cel mult MAX_PENDING_PER_EMAIL_24H emailuri de confirmare pe 24 h pentru aceeasi adresa.
// Raspunsul de succes e IDENTIC pentru orice adresa (noua, deja abonata, peste limita): nu
// dezvaluim cine e abonat. Erorile spun doar ce e gresit in formular (adresa, pragul).

const NO_STORE = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' }
const ok = () => NextResponse.json({ ok: true, message: SUBSCRIBE_OK_MESSAGE }, { headers: NO_STORE })
const fail = (error: string, status = 400) => NextResponse.json({ error }, { status, headers: NO_STORE })

export async function POST(req: NextRequest) {
  const site = req.headers.get('sec-fetch-site')
  if (site && site !== 'same-origin' && site !== 'none') return fail('Cerere refuzată.', 403)
  if (!emailAlertsEnabled()) return fail('Alertele pe email nu sunt disponibile momentan.', 503)

  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* corp invalid */ }

  const limit = await checkRateLimit(redis, 'alerta', clientIp(req.headers), emailAlertRateLimits(), alertTokenSecret())
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Prea multe cereri. Încearcă din nou peste câteva minute.' }, { status: 429, headers: { ...NO_STORE, 'Retry-After': '60' } })
  }

  // Capcana: oamenii nu vad campul; un robot care completeaza tot primeste „ok” si atat
  if (typeof body.website === 'string' && body.website.trim() !== '') return ok()

  const email = normalizeEmail(body.email)
  if (!email) return fail('Adresa de email nu pare corectă.')
  const target = parseTargetPrice(body.target)
  if (target == null) return fail('Scrie pragul în lei, de exemplu 1610.')
  if (body.consent !== true) return fail('Bifează acordul ca să primești emailuri despre acest produs.')
  const productId = Number(body.productId)
  if (!Number.isSafeInteger(productId) || productId <= 0) return fail('Produs invalid.')
  const offerIdRaw = Number(body.offerId)
  const offerId = Number.isSafeInteger(offerIdRaw) && offerIdRaw > 0 ? offerIdRaw : null

  const product = await getAlertProduct(productId)
  if (!product) return fail('Produsul nu a fost găsit.', 404)
  if (!targetBelowCurrent(target, product.bestPrice)) {
    return fail(`Pragul trebuie să fie sub prețul de acum (${formatPrice(product.bestPrice)}), altfel alerta ar pleca imediat.`)
  }

  try {
    const alertId = await createPendingAlert(email, product.id, offerId, target)
    if (alertId != null) await enqueueEmailJob('confirm', { alertId })
  } catch (err) {
    console.error('alerte-email: eroare la abonare', err)
    return fail('Nu am putut salva cererea. Încearcă din nou peste câteva minute.', 500)
  }
  return ok()
}
