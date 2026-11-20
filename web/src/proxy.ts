import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { absoluteLocation, goneHtml, needsArticleData, resolveBlogRedirect } from '@/lib/blog-redirects'
import { getRedirectData } from '@/lib/blog-redirects-data'

// Adresele scoase la trecerea in blog de recomandari (20 nov. 2026): /p/<slug>, observatorul
// (/reduceri-reale, /indice, /cand-sa-cumperi, /black-friday-2026), /t/, /feeds/products.xml si
// vechile categorii devenite tag-uri. Decizia (308 spre articol publicat sau 410) e in
// lib/blog-redirects.ts. De ce aici: o pagina Next poate intoarce doar 404, nu 410; proxy-ul
// ruleaza in Node (Next 16), deci poate citi Postgres direct.
//
// Comportament la eroare de DB (harta articol ↔ produs nu se poate citi/improspata):
// - 308 din ultima harta reusita → il servim (un articol publicat acum cel mult cateva minute);
// - 410 NU il servim pe date vechi sau lipsa: 410 e permanent pentru Google (scoate adresa din
//   index), iar o pana de DB nu trebuie sa stearga din index produse care au articol. Raspundem
//   503 + Retry-After — Google reincearca mai tarziu si nu scoate nimic din index.
export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname

  // Prima trecere fara DB: adresa e una scoasa? (matcher-ul de jos le filtreaza deja)
  const empty = { productGuides: new Map<string, string>(), publishedGuides: new Set<string>() }
  if (resolveBlogRedirect(path, empty) === null) return NextResponse.next()
  if (!needsArticleData(path)) return gone()

  const loaded = await getRedirectData()
  const decision = resolveBlogRedirect(path, loaded?.data ?? empty)
  if (decision?.status === 308) return NextResponse.redirect(absoluteLocation(decision.location), 308)
  if (!loaded || !loaded.fresh) {
    return new NextResponse('Serviciu temporar indisponibil. Încearcă din nou în câteva minute.', {
      status: 503,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Retry-After': '300',
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex',
      },
    })
  }
  return gone()
}

function gone(): NextResponse {
  return new NextResponse(goneHtml(), {
    status: 410,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex' },
  })
}

// Valori constante (analizate la build). Pastreaza-le in acord cu REMOVED_PREFIXES /
// RETIRED_CATEGORY_SLUGS din lib/blog-redirects.ts. `:path*` include si adresa goala (/indice).
export const config = {
  matcher: [
    '/p/:path*',
    '/t/:path*',
    '/reduceri-reale/:path*',
    '/indice/:path*',
    '/cand-sa-cumperi/:path*',
    '/black-friday-2026/:path*',
    '/feeds/products.xml',
    '/c/refurbished',
    '/c/second-hand',
    '/c/touchscreen-second-hand',
  ],
}
