import { NextResponse } from 'next/server'
import pool from '@/lib/db'
import { RENAMED_CATEGORIES, RETIRED_CATEGORY_SLUGS } from '@/lib/legacy-map'
import { absoluteLocation, goneHtml, productDecision } from '@/lib/blog-redirects'
import { getRedirectData } from '@/lib/blog-redirects-data'

// URL-uri vechi (site-ul WooCommerce anterior + slug-uri de categorii redenumite la
// reorganizarea taxonomiei). Analiza log-urilor nginx (8 zile, sep 2026): ~9.000 cereri 404
// pe /produs/, /product/, /shop/, /categorie-produs/ — inclusiv Googlebot.
//
// Regula: 301/308 DOAR spre o pagina echivalenta reala; altfel 410 Gone (Google scoate pagina
// din index mai repede decat la 404). Redirect in masa spre homepage = „soft 404” pentru Google,
// deci NU il facem. Vechiul catalog era alt magazin (ceasuri, cosmetice, baterii de baie).
//
// Din 20 nov. 2026 (blog de recomandari) /p/ si /t/ nu mai exista: tintele se calculeaza
// direct spre destinatia finala (articol sau 410), fara lanturi /produs/x → /p/x → articol.

export function gone(): NextResponse {
  return new NextResponse(goneHtml(), {
    status: 410,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex' },
  })
}

// Harta articol ↔ produs indisponibila (DB cazut): 503, nu 410 — vezi src/proxy.ts
function unavailable(): NextResponse {
  return new NextResponse('Serviciu temporar indisponibil. Încearcă din nou în câteva minute.', {
    status: 503,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Retry-After': '300', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
  })
}

function permanentRedirect(path: string): NextResponse {
  return NextResponse.redirect(absoluteLocation(path), 308)
}

// /produs/<slug>, /product/<slug> → articolul in care apare produsul (#produs-<slug>), altfel 410
export async function legacyProduct(segments: string[]): Promise<NextResponse> {
  const slug = segments[0]
  if (!slug) return gone()
  const loaded = await getRedirectData()
  if (!loaded) return unavailable()
  const decision = productDecision(slug, loaded.data)
  if (decision?.status === 308) return permanentRedirect(decision.location)
  return loaded.fresh ? gone() : unavailable()
}

// /categorie-produs/<a>/<b>/feed, /product-category/<x> → /c/<slug> daca vreun segment e o
// categorie vizibila (cel mai specific castiga); vechile categorii devenite tag-uri → 410
export async function legacyCategory(segments: string[]): Promise<NextResponse> {
  const candidates = segments.filter((s) => s && s !== 'feed' && s !== 'page' && !/^\d+$/.test(s)).reverse()
  for (const s of candidates) {
    if ((RETIRED_CATEGORY_SLUGS as readonly string[]).includes(s)) return gone()
    const slug = RENAMED_CATEGORIES[s] ?? s
    const { rows } = await pool.query('SELECT 1 FROM categories WHERE slug = $1 AND is_visible LIMIT 1', [slug])
    if (rows.length) return permanentRedirect(`/c/${slug}`)
  }
  return gone()
}
