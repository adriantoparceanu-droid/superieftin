import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import pool from '@/lib/db'
import { OFFER_AVAILABLE_SQL, PRODUCT_GONE_DAYS } from '@/lib/availability'

// Produs fara nicio oferta disponibila de PRODUCT_GONE_DAYS zile → 410 Gone (Google il scoate
// din index mai repede decat la 404). Pana atunci pagina afiseaza „indisponibil”, neindexata.
// De ce aici si nu in pagina: o pagina Next poate intoarce doar 404 (notFound), nu 410.
// Proxy-ul ruleaza in Node (Next 16), deci poate interoga Postgres direct.
export async function proxy(request: NextRequest) {
  const slug = decodeURIComponent(request.nextUrl.pathname.slice('/p/'.length)).split('/')[0]
  if (!slug) return NextResponse.next()

  try {
    const { rows } = await pool.query<{ gone: boolean }>(`
      SELECT
        NOT EXISTS (SELECT 1 FROM offers o WHERE o.product_id = p.id AND ${OFFER_AVAILABLE_SQL})
        AND COALESCE((SELECT max(o.last_checked) FROM offers o WHERE o.product_id = p.id), p.updated_at)
            < now() - make_interval(days => $2)
        AS gone
      FROM products p WHERE p.slug = $1
    `, [slug, PRODUCT_GONE_DAYS])
    if (rows[0]?.gone) {
      return new NextResponse('Produsul nu mai este disponibil la magazinele monitorizate.', {
        status: 410,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Robots-Tag': 'noindex' },
      })
    }
  } catch {
    // Orice eroare DB → lasam pagina sa se incarce normal (nu blocam site-ul din proxy)
  }
  return NextResponse.next()
}

export const config = {
  matcher: '/p/:slug',
}
