import type { Metadata } from 'next'
import Link from 'next/link'
import { getMenu } from '@/lib/queries'
import { getBlogGuides, getGuidePageViews } from '@/lib/guides/blog-queries'
import { homeSelection, mostReadGuides } from '@/lib/guides/blog'
import { ArticleGrid } from '@/components/blog/ArticleCard'
import { FeaturedArticle } from '@/components/home/FeaturedArticle'
import { MostRead } from '@/components/home/MostRead'
import { ThemeLinks } from '@/components/home/ThemeLinks'
import { itemListLd, ldScript } from '@/lib/seo/jsonld'
import { withOg } from '@/lib/seo/og'
import { SITE_URL } from '@/lib/seo/site'
import { RSS_ALTERNATE_TYPES } from '@/lib/guides/rss'

// Randata la cerere: lista de articole trebuie sa fie la zi imediat dupa publicarea din admin,
// iar la build DB-ul nu e accesibil. Query-urile sunt mici (zeci de articole).
export const dynamic = 'force-dynamic'

// Homepage-ul blogului de recomandari (reorganizarea din 20.11.2026, varianta A „Revista”):
// articolul principal + „Cele mai citite” + „Articole noi” + temele. Fara produse, preturi sau
// reduceri. JSON-LD WebSite (+ SearchAction) si Organization vin din layout.
const HOME_TITLE = 'superieftin.ro — recomandări de cumpărare, explicate pe înțeles'
const HOME_DESCRIPTION =
  'Articole care te ajută să alegi: top-uri pe buget, comparații între modele și ghiduri de alegere ' +
  'pentru telefoane, laptopuri, televizoare și multe altele, scrise și verificate de echipa superieftin.ro.'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: { absolute: HOME_TITLE },
    description: HOME_DESCRIPTION,
    // `types` repetat: alternates din pagina inlocuieste tot obiectul din layout (pierde RSS-ul)
    alternates: { canonical: '/', types: RSS_ALTERNATE_TYPES },
    openGraph: withOg({ title: HOME_TITLE, description: HOME_DESCRIPTION, url: `${SITE_URL}/` }),
  }
}

export default async function HomePage() {
  const [guides, views, menu] = await Promise.all([
    getBlogGuides().catch(() => []),
    getGuidePageViews().catch(() => []),
    getMenu().catch(() => []),
  ])
  const { featured, latest } = homeSelection(guides)
  const popular = mostReadGuides(views, guides, 4)
  const themes = menu.map((m) => ({ href: m.href, label: m.label }))
  const listLd = latest.length
    ? itemListLd('Articole noi', latest.map((g) => ({ name: g.title, path: `/ghiduri/${g.slug}` })))
    : null

  return (
    <>
      {listLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldScript(listLd) }} />}
      {/* Un singur H1 pe pagina; titlurile articolelor sunt H2/H3 */}
      <h1 className="sr-only">superieftin.ro — recomandări de cumpărare</h1>

      {!featured ? (
        <p className="rounded-2xl bg-surface p-6 text-ink-2 shadow-card">
          Primele articole apar în curând. Până atunci, vezi{' '}
          <Link href="/ghiduri/metodologie" className="text-red-ink underline underline-offset-2">cum lucrăm</Link>.
        </p>
      ) : (
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-12">
          <FeaturedArticle guide={featured} />
          <MostRead guides={popular} />
        </div>
      )}

      {latest.length > 0 && (
        <section aria-labelledby="articole-noi" className="mt-14">
          <div className="flex items-baseline justify-between gap-4 border-t-[3px] border-ink pt-3">
            <h2 id="articole-noi" className="font-display text-[13px] font-extrabold uppercase tracking-[.1em] text-ink">
              Articole noi
            </h2>
            <Link href="/ghiduri" className="text-[14px] font-semibold text-ink-2 underline-offset-2 hover:text-red-ink hover:underline">
              Toate articolele →
            </Link>
          </div>
          <div className="mt-6">
            <ArticleGrid guides={latest} />
          </div>
        </section>
      )}

      {themes.length > 0 && (
        <div className="mt-14">
          <ThemeLinks themes={themes} />
        </div>
      )}
    </>
  )
}
