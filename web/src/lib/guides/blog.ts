// Logica pura a paginilor de blog (homepage, teme /c/, cautare) — fara DB, testata in blog.test.ts.
// Query-urile care aduc datele sunt in lib/guides/blog-queries.ts.
//
// De ce in JavaScript si nu in SQL: avem zeci de articole publicate, nu mii. Le citim o data
// (cu categoriile produselor lor) si alegem aici — regulile raman intr-un singur loc, testabile.

// Un articol publicat, cu ce trebuie pentru liste si pentru alegerea temei.
export interface BlogGuide {
  slug: string
  title: string
  meta_description: string | null
  published_at: string | null
  updated_at: string
  category_slug: string | null        // tema aleasa explicit in admin (optional)
  category_ids: number[]              // categoriile produselor legate (guide_products)
  image_url: string | null            // poza primului produs legat (null = imaginea OG)
  words: number                       // cuvintele din corp (timpul de citire)
  author_name: string | null
}

// O tema = categorie din `categories`. Pentru un parinte, `childIds` / `childSlugs` = subcategoriile
// lui (articolele lor apar si pe pagina parintelui).
export interface ThemeRef {
  id: number
  slug: string
  childIds?: number[]
  childSlugs?: string[]
}

const time = (iso: string | null) => (iso ? new Date(iso).getTime() : 0)

// Cel mai recent actualizat primul (la egalitate: publicat mai recent, apoi alfabetic dupa slug,
// ca ordinea sa fie stabila intre randari).
export function byUpdatedDesc(a: BlogGuide, b: BlogGuide): number {
  return time(b.updated_at) - time(a.updated_at) || time(b.published_at) - time(a.published_at) || a.slug.localeCompare(b.slug)
}

// Articolele unei teme (decizia proprietarului, 20.11.2026: legatura articol ↔ tema e PRIN
// PRODUSE): un articol intra daca are in guide_products produse din tema sau din subcategoriile ei,
// SAU daca tema aleasa in admin (category_slug) e chiar tema / o subcategorie a ei.
export function themeGuides(guides: BlogGuide[], theme: ThemeRef): BlogGuide[] {
  const ids = new Set([theme.id, ...(theme.childIds ?? [])])
  const slugs = new Set([theme.slug, ...(theme.childSlugs ?? [])])
  return guides
    .filter((g) => g.category_ids.some((id) => ids.has(id)) || (g.category_slug != null && slugs.has(g.category_slug)))
    .sort(byUpdatedDesc)
}

// O subcategorie are pagina ei de tema doar cu cel putin atatea articole proprii; altfel 308 spre
// parinte (o pagina cu 1–2 articole ar dubla pagina parintelui).
export const MIN_SUBTHEME_GUIDES = 3

export function subthemeHasOwnPage(ownGuides: number): boolean {
  return ownGuides >= MIN_SUBTHEME_GUIDES
}

// GA4 `pagePath` → slug-ul articolului. Doar /ghiduri/<slug> (fara metodologie, feed, imaginea OG).
const RESERVED = new Set(['metodologie', 'feed.xml'])

export function guideSlugFromPath(path: string): string | null {
  const m = /^\/ghiduri\/([a-z0-9-]+)\/?$/.exec(path.split(/[?#]/)[0] ?? '')
  if (!m || RESERVED.has(m[1])) return null
  return m[1]
}

// „Cele mai citite”: vizualizarile pe 30 de zile (ga4_daily_breakdown, kind = 'page'), adunate pe
// articol — doar articole publicate acum. Fara date (sau prea putine), lista se completeaza cu
// cele mai noi articole, ca rubrica sa nu ramana goala la inceput.
export function mostReadGuides(
  pageViews: { path: string; views: number }[],
  guides: BlogGuide[],
  limit = 4,
): BlogGuide[] {
  const bySlug = new Map(guides.map((g) => [g.slug, g]))
  const views = new Map<string, number>()
  for (const r of pageViews) {
    const slug = guideSlugFromPath(r.path)
    if (slug && bySlug.has(slug) && r.views > 0) views.set(slug, (views.get(slug) ?? 0) + r.views)
  }
  const ranked = [...views.entries()]
    .sort((a, b) => b[1] - a[1] || byUpdatedDesc(bySlug.get(a[0])!, bySlug.get(b[0])!))
    .map(([slug]) => bySlug.get(slug)!)
  const picked = new Set(ranked.map((g) => g.slug))
  const fill = [...guides].sort(byUpdatedDesc).filter((g) => !picked.has(g.slug))
  return [...ranked, ...fill].slice(0, limit)
}

// Homepage: articolul principal = cel mai recent actualizat; „Articole noi” = restul, dupa data
// publicarii (cele mai noi primele).
export function homeSelection(guides: BlogGuide[], newCount = 9): { featured: BlogGuide | null; latest: BlogGuide[] } {
  const featured = [...guides].sort(byUpdatedDesc)[0] ?? null
  const latest = guides
    .filter((g) => g !== featured)
    .sort((a, b) => time(b.published_at) - time(a.published_at) || byUpdatedDesc(a, b))
    .slice(0, newCount)
  return { featured, latest }
}

// Timpul de citire: ~200 de cuvinte pe minut (text in romana, cu tabele si carduri), minim 1.
export function readingMinutes(words: number): number {
  return Math.max(1, Math.round(words / 200))
}

// Eticheta tipului de articol (majuscule rosii pe carduri), dedusa din titlu. Tipurile din design:
// comparatii X vs Y, top-uri pe buget, „Merita acum?”, ghiduri de alegere.
export function articleType(title: string): string {
  const t = title.toLocaleLowerCase('ro-RO').normalize('NFD').replace(/[̀-ͯ]/g, '')
  if (/\bvs\.?\b/.test(t)) return 'Comparație'
  // Bugetul din titlu bate „merită” („Telefoane bune sub 2.000 lei: ce merită luat”)
  if (/\bsub \d[\d.]* ?lei\b|\btop\b|cele mai bune|\bbune\b/.test(t)) return 'Top pe buget'
  if (/\bmerita\b/.test(t)) return 'Merită?'
  return 'Ghid de alegere'
}

// ---------- Cautare in articole ----------

// Cuvintele cautarii, normalizate ca textul din SQL (litere mici, fara diacritice). Raman doar
// litere si cifre, deci % si _ (speciale in LIKE) nu pot ajunge in tipar. Maxim 8 cuvinte, de
// minim 2 caractere.
export function searchWords(q: string): string[] {
  const norm = q.toLocaleLowerCase('ro-RO').normalize('NFD').replace(/[̀-ͯ]/g, '')
  const words = norm.split(/[^a-z0-9]+/).filter((w) => w.length >= 2)
  return [...new Set(words)].slice(0, 8)
}

// Aceeasi normalizare in SQL (diacriticele romanesti + cele uzuale). Folosita de searchGuides.
export const UNACCENT_FROM = 'ăâîșşțţáàäéèëíìïóòöőúùüűçñ'
export const UNACCENT_TO = 'aaissttaaaeeeiiioooouuuucn'
