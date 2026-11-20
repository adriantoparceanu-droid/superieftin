import type { Metadata } from 'next'
import Link from 'next/link'
import { logSearch } from '@/lib/queries'
import { getBlogGuides, searchGuideSlugs } from '@/lib/guides/blog-queries'
import { TrackSearch } from '@/components/analytics/TrackSearch'
import { ArticleGrid } from '@/components/blog/ArticleCard'
import { Crumbs } from '@/components/listing/ListingParts'
import { roCount } from '@/lib/seo/site'

export const dynamic = 'force-dynamic'

// Cautarea in ARTICOLE (blogul, 20.11.2026): titlu, rezumat, meta description si corp, fara
// diacritice (lib/guides/blog-queries.ts → searchGuideSlugs). Nu mai cauta in produse.

type Props = {
  searchParams: Promise<{ q?: string | string[] }>
}

const firstParam = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const query = firstParam((await searchParams).q)?.trim() ?? ''
  return {
    title: query ? `„${query}” — căutare în articole` : 'Căutare în articole',
    description: 'Caută în articolele superieftin.ro: recomandări, comparații și ghiduri de alegere.',
    // noindex (rezultatele de cautare nu se indexeaza), dar follow: robotii pot urma linkurile
    // spre articole. Fara canonical (raport SEO, A9).
    robots: { index: false, follow: true },
  }
}

export default async function SearchPage({ searchParams }: Props) {
  const query = (firstParam((await searchParams).q)?.trim() ?? '').slice(0, 100)

  const [slugs, all] = query
    ? await Promise.all([searchGuideSlugs(query).catch(() => []), getBlogGuides().catch(() => [])])
    : [[], []]
  const bySlug = new Map(all.map((g) => [g.slug, g]))
  const results = slugs.flatMap((s) => bySlug.get(s) ?? [])

  // Termenul cautat se logheaza (fara date personale), pentru subiecte noi de articole
  if (query) void logSearch(query, results.length)

  return (
    <div>
      {query && <TrackSearch term={query} />}
      <Crumbs items={[{ label: 'Acasă', href: '/' }, { label: 'Căutare' }]} />
      <h1 className="mt-3 font-display text-[30px] font-extrabold leading-[1.1] text-ink sm:text-[40px]">
        {query ? <>Rezultate pentru „{query}”</> : 'Caută în articole'}
      </h1>
      {query && results.length > 0 && (
        <p className="mt-1 text-[14px] tabular-nums text-ink-3">{roCount(results.length, 'articole', 'articol')}</p>
      )}

      {/* Formularul de căutare (GET, merge și fără JavaScript) */}
      <form action="/cautare" method="get" role="search" className="mt-5 mb-8 flex max-w-xl gap-2">
        <input
          name="q"
          type="search"
          defaultValue={query}
          placeholder="Ex.: telefon sub 1.500 lei, televizor 55 inch"
          aria-label="Caută în articole"
          autoFocus
          autoComplete="off"
          className="h-12 min-w-0 flex-1 rounded-xl bg-surface px-4 text-[15px] text-ink ring-[1.5px] ring-inset ring-line-2 placeholder:text-ink-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink"
        />
        <button
          type="submit"
          className="inline-flex h-12 items-center rounded-xl bg-ink px-5 font-display text-[15px] font-extrabold text-[var(--bg)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
        >
          Caută
        </button>
      </form>

      {query && results.length === 0 && (
        <p className="rounded-2xl bg-surface p-6 text-ink-2 shadow-card">
          Niciun articol pentru „{query}”. Încearcă alte cuvinte sau{' '}
          <Link href="/ghiduri" className="text-red-ink underline underline-offset-2">vezi toate articolele</Link>.
        </p>
      )}

      {results.length > 0 && <ArticleGrid guides={results} headingLevel={2} />}
    </div>
  )
}
