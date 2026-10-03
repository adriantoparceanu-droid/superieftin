import { NextRequest, NextResponse, after } from 'next/server'
import pool from '@/lib/db'
import redis from '@/lib/redis'
import { trackClick } from '@/lib/queries'
import { generateClickId, detectNetwork, withSubId } from '@/lib/subid'
import { OFFER_AVAILABLE_SQL } from '@/lib/availability'
import { CONSENT_COOKIE, parseConsentCookie } from '@/lib/consent'
import { AD_CLICK_COOKIE, parseAdClickCookie } from '@/lib/adclick'
import { hasValidAdminSession, isGoWhitelisted, isInternalRequest } from '@/lib/internal-traffic'
import { INTERNAL_COOKIE, INTERNAL_COOKIE_MAX_AGE } from '@/lib/admin/session'
import { clientIp } from '@/lib/rate-limit'
import { checkRateLimit, goRateLimits, type RateLimitResult } from '@/lib/go-rate-limit'
import { goTokenSecret, isTokenCheckEnabled, signFormToken, verifyFormToken, verifyGoToken } from '@/lib/go-token'
import { renderInterstitial } from '@/lib/go-interstitial'

// Protectia anti-roboti (decizia proprietarului, 2026-10-03), in ordinea verificarilor:
//   1. lista alba (admin / se_intern / header de test GO_TEST_TOKEN) → trece direct, is_internal=true;
//   2. limita de viteza per IP (lib/go-rate-limit.ts) → peste limita: inapoi pe /p/<slug>,
//      fara click inregistrat si fara retea;
//   3. token JS (lib/go-token.ts) → fara token valid: pagina intermediara (lib/go-interstitial.ts),
//      fara click inregistrat si fara retea. Fara JS: butonul trimite un formular (POST) cu un token
//      de formular.
// Abia dupa toate trei se genereaza click_id-ul si se face redirectul spre reteaua de afiliere.

const NO_STORE = { 'Cache-Control': 'no-store' }

export async function GET(req: NextRequest, ctx: { params: Promise<{ offerId: string }> }) {
  return handle(req, ctx, 'GET')
}

// Butonul „Continua spre magazin” de pe pagina intermediara, pentru vizitatorii fara JavaScript
export async function POST(req: NextRequest, ctx: { params: Promise<{ offerId: string }> }) {
  return handle(req, ctx, 'POST')
}

async function handle(
  req: NextRequest,
  { params }: { params: Promise<{ offerId: string }> },
  method: 'GET' | 'POST',
) {
  const { offerId } = await params

  const id = parseInt(offerId, 10)
  if (isNaN(id) || id <= 0) {
    return NextResponse.redirect('https://www.superieftin.ro', { status: 302 })
  }

  // 1. Lista alba: fara limita, fara token
  const whitelisted = isGoWhitelisted(req)

  // 2. Limita de viteza — inainte de query, ca robotul sa nu incarce degeaba baza de date cu
  //    mai mult decat strictul necesar. IP-ul: cf-connecting-ip (Cloudflare) sau ultimul hop din
  //    x-forwarded-for (pus de nginx) — vezi clientIp() si docs/ops/nginx-access-log.md.
  const secret = goTokenSecret()
  let limit: RateLimitResult = { allowed: true, reason: 'ok' }
  if (!whitelisted) {
    limit = await checkRateLimit(redis, 'go', clientIp(req.headers), goRateLimits(), secret)
  }

  const result = await pool.query<{
    affiliate_url: string | null; url: string; product_id: string; retailer_id: number
    available: boolean; product_slug: string; product_name: string; retailer_name: string
  }>(
    `SELECT o.affiliate_url, o.url, o.product_id, o.retailer_id, p.slug AS product_slug,
            p.name AS product_name, COALESCE(r.name, 'magazin') AS retailer_name,
            ${OFFER_AVAILABLE_SQL} AS available
     FROM offers o JOIN products p ON p.id = o.product_id
     LEFT JOIN retailers r ON r.id = o.retailer_id
     WHERE o.id = $1`,
    [id]
  )

  if (result.rows.length === 0) {
    return NextResponse.redirect('https://www.superieftin.ro', { status: 302 })
  }

  const { affiliate_url, url, product_id, retailer_id, available, product_slug, product_name, retailer_name } = result.rows[0]
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.superieftin.ro'
  const productPage = new URL(`/p/${encodeURIComponent(product_slug)}`, base)

  // Oferta negasita recent in feed-uri / scanari: linkul spre magazin probabil nu mai duce
  // nicaieri (produs scos, pret vechi). Trimitem vizitatorul inapoi pe pagina produsului
  // (linkuri vechi, pagini ramase deschise) — fara click inregistrat.
  if (!available) {
    return NextResponse.redirect(productPage, { status: 302, headers: NO_STORE })
  }

  // Peste limita de viteza: inapoi pe pagina produsului (un om ajuns aici din greseala vede
  // oferta si poate reveni peste un minut). 303 la POST, ca browserul sa faca GET pe /p/.
  if (!limit.allowed) {
    return NextResponse.redirect(productPage, {
      status: method === 'POST' ? 303 : 302,
      headers: { ...NO_STORE, 'X-Robots-Tag': 'noindex, nofollow' },
    })
  }

  // 3. Dovada de browser real. GO_TOKEN_CHECK=0 opreste verificarea (comutator de urgenta).
  if (!whitelisted && secret && isTokenCheckEnabled()) {
    let ok = false
    let tooFast = false
    if (method === 'GET') {
      ok = verifyGoToken(secret, id, req.nextUrl.searchParams.get('t'))
    } else {
      let ft: FormDataEntryValue | null = null
      try { ft = (await req.formData()).get('ft') } catch { /* corp stricat → invalid */ }
      const r = verifyFormToken(secret, id, ft)
      ok = r === 'ok'
      tooFast = r === 'too_fast'
    }
    if (!ok) {
      const html = renderInterstitial({
        offerId: id, productName: product_name, retailerName: retailer_name, productSlug: product_slug,
        formToken: signFormToken(secret, id), tooFast,
      })
      return new NextResponse(html, {
        status: 200,
        headers: { ...NO_STORE, 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex, nofollow' },
      })
    }
  }

  // click_id unic per click, trimis ca subID catre retea (doar pe linkurile afiliate)
  const clickId = generateClickId()
  const network = affiliate_url ? detectNetwork(affiliate_url) : null
  const destination = affiliate_url ? withSubId(affiliate_url, network, clickId) : url

  // ID-ul clickului pe reclama Google (scris la aterizare de AdClickCapture) se leaga de
  // click_id DOAR daca vizitatorul are acum acordul „Publicitate” (regula 7, GDPR). Verificam
  // acordul aici, pe server, din cookie-ul de consimtamant — nu ne bazam doar pe faptul ca
  // browserul ar fi trebuit sa stearga se_gclid la retragere. Fara acord: NICIUN ID Google.
  const hasAdConsent = parseConsentCookie(req.cookies.get(CONSENT_COOKIE)?.value)?.ads === true
  const adIds = hasAdConsent ? parseAdClickCookie(req.cookies.get(AD_CLICK_COOKIE)?.value) : null

  // Momentul clickului pe reclama (ts din cookie, scris la aterizare) → ad_clicks.ad_click_at.
  // De aici se socotesc cele 90 de zile de retentie si fereastra de upload (migratia 022).
  // Cookie-ul e controlat de browser, deci: parseAdClickCookie respinge deja ts mai vechi de
  // 90 de zile / lipsa (0); un ts in viitor e limitat la momentul de acum. Fara ts valid → NULL
  // (workerul foloseste atunci created_at). Limitarea e aici, nu cu LEAST() in SQL, pentru ca
  // LEAST ignora NULL si ar transforma „necunoscut” in now().
  const adClickAt = adIds && adIds.ts > 0 ? new Date(Math.min(adIds.ts, Date.now())) : null

  // Click intern (admin, robot, unealta de test — lib/internal-traffic.ts): nu intra in
  // click_events (statisticile de clickuri = doar clienti), iar in ad_clicks e marcat, ca
  // tracking:sync sa nu trimita la Google o conversie dintr-o comanda de test (migratia 027).
  // Lista alba (inclusiv headerul de test) = mereu intern.
  const internal = whitelisted || isInternalRequest(req)

  // Scrierile in DB ruleaza DUPA ce redirectul a plecat — clickul ramane rapid
  after(async () => {
    if (!internal) await trackClick(offerId)
    try {
      await pool.query(
        `INSERT INTO ad_clicks (click_id, offer_id, product_id, retailer_id, network,
                                gclid, gbraid, wbraid, has_ad_consent, ad_click_at, is_internal)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [clickId, id, product_id, retailer_id, network,
         adIds?.gclid ?? null, adIds?.gbraid ?? null, adIds?.wbraid ?? null, hasAdConsent, adClickAt, internal]
      )
    } catch (err) {
      // Non-critic pentru utilizator, dar pierdem potrivirea comisionului — il logam
      console.error('ad_clicks insert esuat', err)
    }
  })

  // POST (formularul fara JS) → 303, ca browserul sa urmeze redirectul cu GET
  const res = NextResponse.redirect(destination, {
    status: method === 'POST' ? 303 : 302,
    headers: {
      'Cache-Control': 'no-store',
    },
  })
  // Admin logat dinainte sa existe cookie-ul de marcaj (se pune la login): il punem acum,
  // ca browserul sa ramana recunoscut si dupa ce sesiunea expira.
  if (req.cookies.get(INTERNAL_COOKIE)?.value !== '1' && hasValidAdminSession(req)) {
    res.cookies.set(INTERNAL_COOKIE, '1', {
      httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: INTERNAL_COOKIE_MAX_AGE,
    })
  }
  return res
}
