import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, permanentRedirect } from 'next/navigation'
import { getBlogGuides, getThemeCategory, type ThemeCategory } from '@/lib/guides/blog-queries'
import { subthemeHasOwnPage, themeGuides, type BlogGuide } from '@/lib/guides/blog'
import { ArticleGrid, SectionTitle } from '@/components/blog/ArticleCard'
import { CategoryContent } from '@/components/CategoryContent'
import { Crumbs } from '@/components/listing/ListingParts'
import { breadcrumbLd, itemListLd, ldScript } from '@/lib/seo/jsonld'
import { withOg } from '@/lib/seo/og'
import { WEBSITE_ID, absUrl, lowerFirst } from '@/lib/seo/site'

// Pagina TEMEI (reorganizarea in blog, 20.11.2026): titlu, textul introductiv (intro_md), articolele
// publicate din tema, intrebarile frecvente. Fara produse, preturi, filtre, sortare sau paginare.
//
// Legatura articol ↔ tema e PRIN PRODUSE (decizia proprietarului): articolele cu produse legate
// (guide_products) din tema sau din subcategoriile ei, plus cele cu tema aleasa in admin
// (guides.category_slug) — lib/guides/blog.ts → themeGuides.
//
// Subcategoriile: pagina proprie doar cu >= 3 articole proprii; altfel 308 spre parinte.
// Parametrii vechi (?brand=, ?sort=, ?page=, ?tot=) nu mai schimba nimic; canonical = /c/<slug>.

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ categorie: string }> }

// Tema + articolele ei; redirectul subcategoriilor fara destule articole. Aceeasi decizie in
// metadata si in pagina (React cache() pe query-uri → o singura citire).
async function loadTheme(slug: string): Promise<{ theme: ThemeCategory; guides: BlogGuide[]; all: BlogGuide[] }> {
  const theme = await getThemeCategory(slug)
  // Categoriile ascunse (ea sau parintele) nu sunt publice
  if (!theme) notFound()
  const all = await getBlogGuides().catch(() => [])
  const guides = themeGuides(all, theme)
  if (theme.parent_slug && !subthemeHasOwnPage(guides.length)) permanentRedirect(`/c/${theme.parent_slug}`)
  return { theme, guides, all }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { categorie } = await params
  const { theme, guides } = await loadTheme(categorie)
  const path = `/c/${theme.slug}`
  const title = `${theme.name} — articole și recomandări`
  const description =
    `Articole despre ${lowerFirst(theme.name)}: top-uri pe buget, comparații între modele și ghiduri de alegere, ` +
    'scrise și verificate de echipa superieftin.ro.'
  return {
    title,
    description,
    alternates: { canonical: path },
    // Tema fara articole: pagina ramane accesibila (din meniu), dar nu o indexam (pagina subtire)
    ...(guides.length === 0 ? { robots: { index: false, follow: true } } : {}),
    openGraph: withOg({ title, description, url: absUrl(path) }),
  }
}

export default async function ThemePage({ params }: Props) {
  const { categorie } = await params
  const { theme, guides, all } = await loadTheme(categorie)
  const path = `/c/${theme.slug}`

  // Subtemele cu pagina proprie (>= 3 articole); celelalte ar redirectiona inapoi aici
  const subthemes = theme.childIds
    .map((id, i) => ({ id, slug: theme.childSlugs[i], name: theme.childNames[i] }))
    .filter((c) => subthemeHasOwnPage(themeGuides(all, c).length))

  const crumbs = [
    { name: 'Acasă', path: '/' },
    ...(theme.parent_slug ? [{ name: theme.parent_name ?? theme.parent_slug, path: `/c/${theme.parent_slug}` }] : []),
    { name: theme.name, path },
  ]
  const items = guides.map((g) => ({ name: g.title, path: `/ghiduri/${g.slug}` }))
  // CollectionPage (pagina) + ItemList (articolele) + BreadcrumbList; FAQPage il pune CategoryContent
  const collectionLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${absUrl(path)}#pagina`,
    name: theme.name,
    url: absUrl(path),
    inLanguage: 'ro-RO',
    isPartOf: { '@id': WEBSITE_ID },
  }
  const ld = [collectionLd, breadcrumbLd(crumbs), ...(items.length ? [itemListLd(`Articole: ${theme.name}`, items)] : [])]

  return (
    <>
      {ld.map((d, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldScript(d) }} />
      ))}

      <Crumbs items={crumbs.map((c, i) => (i < crumbs.length - 1 ? { label: c.name, href: c.path } : { label: c.name }))} />

      <header className="mt-3 mb-8">
        <p className="text-[12px] font-extrabold uppercase tracking-[.1em] text-red-ink">Temă</p>
        <h1 className="mt-1 font-display text-[34px] font-extrabold leading-[1.05] tracking-[-0.02em] text-ink sm:text-[46px]">
          {theme.name}
        </h1>
        <div className="mt-4">
          <CategoryContent slug={theme.slug} name={theme.name} part="intro" />
        </div>
      </header>

      {subthemes.length > 0 && (
        <nav aria-label="Subteme" className="mb-8 flex flex-wrap gap-2">
          {subthemes.map((s) => (
            <Link
              key={s.slug}
              href={`/c/${s.slug}`}
              className="inline-flex h-9 items-center rounded-full bg-surface px-3.5 text-[14px] font-semibold text-ink ring-1 ring-inset ring-line-2 transition-shadow hover:ring-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
            >
              {s.name}
            </Link>
          ))}
        </nav>
      )}

      <section aria-labelledby="articole-tema">
        <SectionTitle id="articole-tema">Articole</SectionTitle>
        {guides.length > 0 ? (
          <div className="mt-6">
            <ArticleGrid guides={guides} headingLevel={3} />
          </div>
        ) : (
          <p className="mt-6 rounded-2xl bg-surface p-6 text-ink-2 shadow-card">
            Încă nu am publicat articole despre {lowerFirst(theme.name)}.{' '}
            <Link href="/ghiduri" className="text-red-ink underline underline-offset-2">Vezi toate articolele</Link>.
          </p>
        )}
      </section>

      <div className="mt-14">
        <CategoryContent slug={theme.slug} name={theme.name} part="faq" />
      </div>
    </>
  )
}
