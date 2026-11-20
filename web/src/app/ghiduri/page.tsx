import type { Metadata } from 'next'
import Link from 'next/link'
import { getMenu } from '@/lib/queries'
import { getBlogGuides, getThemeCategory } from '@/lib/guides/blog-queries'
import { byUpdatedDesc, themeGuides } from '@/lib/guides/blog'
import { ArticleGrid } from '@/components/blog/ArticleCard'
import { RSS_PATH, RSS_TITLE } from '@/lib/guides/rss'

// Randata la cerere: filtrul ?categorie= o face dinamica oricum, iar la build DB-ul nu e
// accesibil. Interogarea e mica (doar articolele publicate), deci nu incarca serverul.
export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ categorie?: string | string[] }> }

const firstParam = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const categorie = firstParam((await searchParams).categorie)
  return {
    title: 'Articole — recomandări, comparații și ghiduri de alegere',
    description: 'Toate articolele superieftin.ro: top-uri pe buget, comparații între modele și ghiduri care te ajută să alegi, scrise și verificate de echipa noastră.',
    alternates: {
      canonical: '/ghiduri',
      // Fluxul RSS al articolelor (descoperit automat de cititoare si agregatoare)
      types: { 'application/rss+xml': [{ url: RSS_PATH, title: RSS_TITLE }] },
    },
    // Variantele filtrate nu se indexeaza separat (pagina temei /c/<slug> e varianta indexabila)
    ...(categorie ? { robots: { index: false, follow: true } } : {}),
  }
}

export default async function GuidesPage({ searchParams }: Props) {
  const categorie = firstParam((await searchParams).categorie) ?? null
  const [all, menu, theme] = await Promise.all([
    getBlogGuides().catch(() => []),
    getMenu().catch(() => []),
    categorie ? getThemeCategory(categorie).catch(() => null) : Promise.resolve(null),
  ])

  // Filtrul pe teme = aceeasi regula ca pagina temei (articol ↔ tema prin produse, lib/guides/blog.ts)
  const guides = theme ? themeGuides(all, theme) : categorie ? [] : [...all].sort(byUpdatedDesc)
  const themeSlugs = menu.flatMap((m) => {
    const slug = /^\/c\/([^/?#]+)$/.exec(m.href)?.[1]
    return slug ? [{ slug, label: m.label }] : []
  })
  const pills = (await Promise.all(themeSlugs.map(async (t) => {
    const cat = await getThemeCategory(t.slug).catch(() => null)
    return { ...t, count: cat ? themeGuides(all, cat).length : 0 }
  }))).filter((t) => t.count > 0)

  // Jetoanele de filtru (.chip / .chip.on)
  const pill = (active: boolean) =>
    `inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13.5px] font-semibold transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink ${
      active ? 'bg-ink text-[var(--bg)]' : 'bg-surface text-ink ring-1 ring-inset ring-line-2 hover:ring-ink'
    }`

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-[34px] font-extrabold leading-[1.05] tracking-[-0.02em] text-ink sm:text-[46px]">Articole</h1>
        <p className="mt-2 max-w-[44rem] text-[16px] leading-relaxed text-ink-2 sm:text-[17px]">
          Top-uri pe buget, comparații între modele și ghiduri care te ajută să alegi. Fiecare articol
          are un autor și un verificator.{' '}
          <Link href="/ghiduri/metodologie" className="text-red-ink underline underline-offset-2">Cum lucrăm</Link>
        </p>
      </header>

      {pills.length > 1 && (
        <nav aria-label="Filtru teme" className="mb-8 flex flex-wrap gap-2">
          <Link href="/ghiduri" className={pill(!categorie)} aria-current={!categorie ? 'page' : undefined}>Toate</Link>
          {pills.map((c) => (
            <Link key={c.slug} href={`/ghiduri?categorie=${c.slug}`} className={pill(categorie === c.slug)} aria-current={categorie === c.slug ? 'page' : undefined}>
              {c.label} <span className="tabular-nums opacity-70">{c.count}</span>
            </Link>
          ))}
        </nav>
      )}

      {guides.length === 0 ? (
        <p className="rounded-2xl bg-surface p-6 text-ink-2 shadow-card">
          {categorie
            ? <>Încă nu am publicat articole în această temă. <Link href="/ghiduri" className="text-red-ink underline underline-offset-2">Vezi toate articolele</Link>.</>
            : 'Primele articole apar în curând.'}
        </p>
      ) : (
        <div className="border-t-[3px] border-ink pt-6">
          <ArticleGrid guides={guides} headingLevel={2} />
        </div>
      )}
    </div>
  )
}
