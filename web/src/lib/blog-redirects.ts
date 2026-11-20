// Adresele care dispar la trecerea in blog de recomandari (reorganizarea din 20 nov. 2026,
// docs/plans/2026-11-20-reorganizare-blog-plan.md, etapa 6). PUR — fara DB, testat in
// blog-redirects.test.ts. Datele (ce produs apare in ce articol publicat) le aduce
// lib/blog-redirects-data.ts; aplicarea e in src/proxy.ts si in lib/legacy-urls.ts.
//
// Regula (aceeasi ca la URL-urile WooCommerce, CLAUDE.md „URL-uri vechi”): 308 DOAR spre un
// echivalent real — un articol PUBLICAT; altfel 410 Gone (Google scoate adresa din index mai
// repede decat la 404). Redirect in masa spre homepage = „soft 404”, deci NU il facem.

import { SITE_URL } from './seo/site'
import { RETIRED_CATEGORY_SLUGS } from './legacy-map'

export { RETIRED_CATEGORY_SLUGS }

// Paginile observatorului / comparatorului scoase, cu articolul echivalent (slug de ghid).
// Adauga aici o pereche DOAR cand articolul raspunde la aceeasi intrebare ca pagina veche
// (ex. o editie a indicelui → articolul „Ce s-a scumpit in <luna>”). Fara pereche → 410.
// Daca articolul nu e (inca) publicat, adresa da tot 410 — vezi resolveBlogRedirect.
export const ARTICLE_EQUIVALENTS: Record<string, string> = {
  '/black-friday-2026': 'black-friday-2026-ce-reduceri-sunt-reale',
  '/reduceri-reale': 'reduceri-reale-black-friday-cum-verifici',
}

// Prefixele scoase (pagina + tot ce e sub ea). Orice adresa de aici fara pereche → 410.
export const REMOVED_PREFIXES = [
  '/reduceri-reale',
  '/indice',
  '/cand-sa-cumperi',
  '/black-friday-2026',
  '/t',
  '/feeds/products.xml',
] as const

// Ce stim din DB pentru decizie (incarcat si tinut in cache de lib/blog-redirects-data.ts)
export interface RedirectData {
  productGuides: Map<string, string>   // slug produs → slug articol publicat (cel mai recent actualizat)
  publishedGuides: Set<string>         // slug-urile articolelor publicate
}

export type RedirectDecision =
  | { status: 308; location: string }  // cale relativa, cu ancora daca e cazul
  | { status: 410 }
  | null                               // adresa nu e a noastra → pagina normala

// /ghiduri/<articol> sau /ghiduri/<articol>#produs-<slug> (ancora cardului din articol:
// components/guides/ProductPick.tsx pune id="produs-<slug>" pe prima aparitie a produsului)
export function articlePath(guideSlug: string, productSlug?: string): string {
  const base = `/ghiduri/${encodeURIComponent(guideSlug)}`
  return productSlug ? `${base}#produs-${encodeURIComponent(productSlug)}` : base
}

// Calea fara „/” final si decodata („/p/abc/” → „/p/abc”). O secventa %-gresita ramane bruta.
export function normalizePath(pathname: string): string {
  let p = pathname
  try { p = decodeURIComponent(pathname) } catch { /* lasam calea asa cum a venit */ }
  if (p.length > 1) p = p.replace(/\/+$/, '')
  return p || '/'
}

function underPrefix(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`)
}

// Slug-ul de produs din /p/<slug>[/...]; '' pentru /p sau /p/
export function productSlugFromPath(path: string): string | null {
  if (!underPrefix(path, '/p')) return null
  return path.slice('/p/'.length).split('/')[0] ?? ''
}

// Adresa e una dintre cele scoase? (fara date din DB — util pentru matcher si teste)
export function isRemovedPath(pathname: string): boolean {
  const path = normalizePath(pathname)
  if (productSlugFromPath(path) !== null) return true
  if (RETIRED_CATEGORY_SLUGS.some((s) => path === `/c/${s}`)) return true
  return REMOVED_PREFIXES.some((pre) => underPrefix(path, pre))
}

// Decizia depinde de DB? (produs sau pagina cu articol echivalent). Restul adreselor scoase dau
// 410 fara nicio citire — si cand DB-ul e cazut.
export function needsArticleData(pathname: string): boolean {
  const path = normalizePath(pathname)
  return productSlugFromPath(path) !== null || Object.hasOwn(ARTICLE_EQUIVALENTS, path)
}

// Produs → articol: 308 spre ancora lui din articol, altfel 410. Folosit si de /produs/<slug>
// (lib/legacy-urls.ts), ca vechile URL-uri WooCommerce sa sara direct la tinta finala.
export function productDecision(slug: string, data: RedirectData): RedirectDecision {
  const guide = slug ? data.productGuides.get(slug) : undefined
  return guide && data.publishedGuides.has(guide)
    ? { status: 308, location: articlePath(guide, slug) }
    : { status: 410 }
}

// Decizia pentru o cale. null = nu e o adresa scoasa (cererea merge mai departe normal).
export function resolveBlogRedirect(pathname: string, data: RedirectData): RedirectDecision {
  const path = normalizePath(pathname)

  const slug = productSlugFromPath(path)
  if (slug !== null) return productDecision(slug, data)

  if (RETIRED_CATEGORY_SLUGS.some((s) => path === `/c/${s}`)) return { status: 410 }

  if (!REMOVED_PREFIXES.some((pre) => underPrefix(path, pre))) return null
  const guide = Object.hasOwn(ARTICLE_EQUIVALENTS, path) ? ARTICLE_EQUIVALENTS[path] : undefined
  return guide && data.publishedGuides.has(guide)
    ? { status: 308, location: articlePath(guide) }
    : { status: 410 }
}

// Alegerea articolului cand produsul apare in mai multe: cel mai recent actualizat (la egalitate,
// id-ul mai mare = cel mai nou). Randurile pot veni in orice ordine.
export interface ProductGuideRow { product_slug: string; guide_slug: string; updated_at: string | Date; guide_id: number }

export function buildProductGuides(rows: ProductGuideRow[]): Map<string, string> {
  const best = new Map<string, ProductGuideRow>()
  for (const r of rows) {
    const cur = best.get(r.product_slug)
    if (!cur) { best.set(r.product_slug, r); continue }
    const t = new Date(r.updated_at).getTime()
    const tc = new Date(cur.updated_at).getTime()
    if (t > tc || (t === tc && r.guide_id > cur.guide_id)) best.set(r.product_slug, r)
  }
  return new Map([...best].map(([slug, r]) => [slug, r.guide_slug]))
}

// URL absolut pe domeniul canonic (Location-ul redirectului)
export function absoluteLocation(location: string): string {
  return `${SITE_URL}${location}`
}

// Pagina 410: HTML simplu, autonom (proxy-ul nu poate randa layout-ul React), in romana,
// noindex, cu drum spre homepage si articole. Culori apropiate de tokenii site-ului, inclusiv
// modul intunecat. Fara resurse externe (fara fonturi/CSS de incarcat).
export function goneHtml(): string {
  return `<!doctype html>
<html lang="ro">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Pagina nu mai există — superieftin.ro</title>
<style>
:root{color-scheme:light dark;--bg:#f6f5f2;--card:#fff;--ink:#16130f;--ink2:#4a453e;--red:#c8102e}
@media (prefers-color-scheme:dark){:root{--bg:#141210;--card:#1e1b18;--ink:#f3efe9;--ink2:#bdb5aa;--red:#ff6b7d}}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:34rem;margin:12vh auto 0;padding:2rem 1.5rem;background:var(--card);border-radius:1rem;text-align:center}
.k{margin:0;font-size:13px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--red)}
h1{margin:.25rem 0 .75rem;font-size:28px;line-height:1.15}
p{color:var(--ink2)}
nav{display:flex;flex-wrap:wrap;justify-content:center;gap:.75rem 1.5rem;margin-top:1.5rem;font-weight:600}
a{color:var(--red)}
</style>
</head>
<body>
<main>
<p class="k">Eroare 410</p>
<h1>Pagina nu mai există</h1>
<p>superieftin.ro a devenit un blog de recomandări de produse: paginile de comparare a prețurilor nu mai sunt publice. Recomandările noastre, cu prețul de azi la magazinele partenere, le găsești în articole.</p>
<nav><a href="/">Pagina principală</a><a href="/ghiduri">Toate articolele</a></nav>
</main>
</body>
</html>
`
}
