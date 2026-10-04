import type { Metadata } from 'next'
import Link from 'next/link'
import { listPublishedGuides, getGuideCategories } from '@/lib/guides/queries'
import { formatGuideDate } from '@/lib/guides/format'

// Randata la cerere: filtrul ?categorie= o face dinamica oricum, iar la build DB-ul nu e
// accesibil. Interogarea e mica (doar tabela guides), deci nu incarca serverul.
export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ categorie?: string }> }

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { categorie } = await searchParams
  return {
    title: 'Ghiduri de cumpărare — prețuri verificate',
    description: 'Ghiduri de cumpărare cu prețuri actualizate automat și reduceri verificate față de mediana ultimelor 30 de zile.',
    alternates: { canonical: '/ghiduri' },
    // Variantele filtrate nu se indexeaza separat (continut duplicat al listei principale)
    ...(categorie ? { robots: { index: false, follow: true } } : {}),
  }
}

export default async function GuidesPage({ searchParams }: Props) {
  const { categorie } = await searchParams
  const [guides, categories] = await Promise.all([
    listPublishedGuides(categorie ?? null).catch(() => []),
    getGuideCategories().catch(() => []),
  ])

  // Jetoanele de filtru, ca pe liste (macheta: .chip / .chip.on)
  const pill = (active: boolean) =>
    `inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13.5px] font-semibold transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink ${
      active ? 'bg-ink text-[var(--bg)]' : 'bg-surface text-ink ring-1 ring-inset ring-line-2 hover:ring-ink'
    }`

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-5">
        <h1 className="text-[26px] font-extrabold leading-[1.1] text-ink sm:text-[34px]">Ghiduri de cumpărare</h1>
        <p className="mt-2 max-w-[44rem] text-[15px] leading-relaxed text-ink-2 sm:text-base">
          Prețurile din ghiduri se actualizează automat din datele noastre, iar o reducere e „reală”
          doar dacă prețul e cu minim 5% sub mediana ultimelor 30 de zile.{' '}
          <Link href="/ghiduri/metodologie" className="text-red-ink underline underline-offset-2">Cum lucrăm</Link>
        </p>
      </header>

      {categories.length > 1 && (
        <nav aria-label="Filtru categorii" className="mb-5 flex flex-wrap gap-2">
          <Link href="/ghiduri" className={pill(!categorie)} aria-current={!categorie ? 'page' : undefined}>Toate</Link>
          {categories.map((c) => (
            <Link key={c.slug} href={`/ghiduri?categorie=${c.slug}`} className={pill(categorie === c.slug)} aria-current={categorie === c.slug ? 'page' : undefined}>
              {c.name} <span className="tabular-nums opacity-70">{c.count}</span>
            </Link>
          ))}
        </nav>
      )}

      {guides.length === 0 ? (
        <p className="rounded-2xl bg-surface p-6 text-ink-2 shadow-card">
          Încă nu am publicat ghiduri{categorie ? ' în această categorie' : ''}. Până atunci, vezi{' '}
          <Link href="/reduceri-reale" className="text-red-ink underline underline-offset-2">reducerile reale de azi</Link>.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {guides.map((g) => (
            // Tot cardul e clicabil (linkul titlului se intinde peste card cu after:absolute)
            <li key={g.slug} className="group relative flex flex-col rounded-2xl bg-surface p-4 shadow-card transition-shadow hover:shadow-pop sm:p-5">
              {g.category_name && (
                <span className="text-[12px] font-extrabold uppercase tracking-[.06em] text-red-ink">{g.category_name}</span>
              )}
              <h2 className="mt-1 text-[19px] font-extrabold leading-snug text-ink">
                <Link
                  href={`/ghiduri/${g.slug}`}
                  className="rounded after:absolute after:inset-0 after:rounded-2xl group-hover:text-red-ink focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ink"
                >
                  {g.title}
                </Link>
              </h2>
              {/* Rezumatul = meta description (text simplu; `summary` e Markdown) */}
              {g.meta_description && (
                <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-ink-2">{g.meta_description}</p>
              )}
              {g.published_at && (
                <p className="mt-auto pt-3 text-xs text-ink-3">
                  <time dateTime={g.published_at}>{formatGuideDate(g.published_at)}</time>
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
