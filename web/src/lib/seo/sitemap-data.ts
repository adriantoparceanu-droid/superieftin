import { getAllProductSlugs } from '../queries'
import { getPublishedGuideSlugs } from '../guides/queries'
import { getCategoryTreeStats, getTagStats } from './queries'
import { indexableCategories, landingCategories } from './categories'
import type { SitemapEntry } from './sitemap'
import { getPublishedEditions, getTimingEligible } from '../observator/queries'
import { monthSlug } from '../observator/observator'

// Datele sitemap-ului (rutele app/sitemap.xml si app/sitemaps/[fisier]). Toate sursele sunt deja
// in unstable_cache (produse 24 h, categorii 1 h), deci cererile repetate nu lovesc DB-ul.
// .catch: o sursa cazuta nu goleste tot sitemap-ul (ex. tabela guides lipsa inaintea migratiei).

export async function productEntries(): Promise<SitemapEntry[]> {
  const slugs = await getAllProductSlugs().catch(() => [] as { slug: string; lastmod: string | null }[])
  return slugs.map((s) => ({ path: `/p/${s.slug}`, lastmod: s.lastmod }))
}

export async function pageEntries(): Promise<SitemapEntry[]> {
  const [guides, categories, tags, editions, timing] = await Promise.all([
    getPublishedGuideSlugs().catch(() => [] as { slug: string; updated_at: string }[]),
    getCategoryTreeStats().catch(() => []),
    getTagStats().catch(() => []),
    getPublishedEditions().catch(() => []),
    getTimingEligible().catch(() => []),
  ])
  const latestGuide = guides.reduce<string | null>((m, g) => (!m || g.updated_at > m ? g.updated_at : m), null)

  return [
    // Homepage-ul si listele se schimba continuu → fara lastmod (mai bine nimic decat „acum”)
    { path: '/' },
    // Paginile de incredere (Despre, Contact, politici) — cerute de Google pentru site-urile de afiliere
    ...['/despre', '/contact', '/confidentialitate', '/termeni', '/cookies', '/ghiduri/metodologie'].map((path) => ({ path })),
    { path: '/ghiduri', lastmod: latestGuide },
    ...guides.map((g) => ({ path: `/ghiduri/${g.slug}`, lastmod: g.updated_at })),
    // Categorii (parinti SI subcategorii) cu produse disponibile — aceeasi regula ca noindex pe /c/
    ...indexableCategories(categories).map((c) => ({ path: `/c/${c.slug}` })),
    // Tag-uri (Refurbished, Second Hand) cu produse disponibile
    ...tags.filter((t) => t.products > 0).map((t) => ({ path: `/t/${t.slug}` })),
    // Hubul si landing-urile de reduceri reale (fara Sanatate & Naturale — regula 8)
    { path: '/reduceri-reale' },
    ...landingCategories(categories).map((c) => ({ path: `/reduceri-reale/${c.slug}` })),
    // Observatorul reducerilor reale (repoziționarea din 21 oct. 2026). Tracker-ul Black Friday e
    // permanent (după eveniment rămâne arhivă). /indice și /cand-sa-cumperi doar cu date (altfel
    // paginile sunt noindex); lastmod = momentul calculului (real: workerul le scrie atunci).
    { path: '/black-friday-2026' },
    ...(editions.length ? [{ path: '/indice', lastmod: editions[0].computed_at }] : []),
    ...editions.map((e) => ({ path: `/indice/${monthSlug(e.month)}`, lastmod: e.computed_at })),
    ...(timing.length ? [{ path: '/cand-sa-cumperi', lastmod: timing[0].computed_at }] : []),
    ...timing.map((c) => ({ path: `/cand-sa-cumperi/${c.slug}`, lastmod: c.computed_at })),
  ]
}
