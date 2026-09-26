import { NextResponse } from 'next/server'
import pool from '@/lib/db'
import { RENAMED_CATEGORIES, CATEGORIES_TO_TAGS } from '@/lib/legacy-map'

// URL-uri vechi (site-ul WooCommerce anterior + slug-uri de categorii redenumite la
// reorganizarea taxonomiei). Analiza log-urilor nginx (8 zile, sep 2026): ~9.000 cereri 404
// pe /produs/, /product/, /shop/, /categorie-produs/ — inclusiv Googlebot.
//
// Regula: 301/308 DOAR spre o pagina echivalenta reala; altfel 410 Gone (Google scoate
// pagina din index mai repede decat la 404). Redirect in masa spre homepage = „soft 404”
// pentru Google, deci NU il facem. Vechiul catalog era alt magazin (ceasuri, cosmetice,
// baterii de baie) — doar ~0,3% din slug-urile vechi de produs exista azi.

export function gone(): NextResponse {
  return new NextResponse('Pagina nu mai există.', {
    status: 410,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Robots-Tag': 'noindex' },
  })
}

function permanentRedirect(path: string): NextResponse {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.superieftin.ro'
  return NextResponse.redirect(new URL(path, base), 308)
}

// /produs/<slug>, /product/<slug> → /p/<slug> daca produsul exista, altfel 410
export async function legacyProduct(segments: string[]): Promise<NextResponse> {
  const slug = segments[0]
  if (!slug) return permanentRedirect('/')
  const { rows } = await pool.query('SELECT 1 FROM products WHERE slug = $1 LIMIT 1', [slug])
  return rows.length ? permanentRedirect(`/p/${encodeURIComponent(slug)}`) : gone()
}

// /categorie-produs/<a>/<b>/feed, /product-category/<x> → /c/<slug> sau /t/<tag> daca
// vreun segment e o categorie cunoscuta (cel mai specific castiga), altfel 410
export async function legacyCategory(segments: string[]): Promise<NextResponse> {
  const candidates = segments.filter((s) => s && s !== 'feed' && s !== 'page' && !/^\d+$/.test(s)).reverse()
  for (const s of candidates) {
    if (CATEGORIES_TO_TAGS[s]) return permanentRedirect(`/t/${CATEGORIES_TO_TAGS[s]}`)
    const slug = RENAMED_CATEGORIES[s] ?? s
    const { rows } = await pool.query('SELECT 1 FROM categories WHERE slug = $1 AND is_visible LIMIT 1', [slug])
    if (rows.length) return permanentRedirect(`/c/${slug}`)
  }
  return gone()
}
