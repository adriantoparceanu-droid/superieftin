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

  const pill = (active: boolean) =>
    `px-3 py-1 rounded-full border text-sm transition-colors ${active ? 'bg-brand text-white border-brand' : 'border-line hover:border-brand hover:text-brand'}`

  return (
    <div className="max-w-4xl mx-auto">
      <header className="mb-6">
        <h1 className="font-archivo text-2xl sm:text-3xl text-[var(--color-text)]">Ghiduri de cumpărare</h1>
        <p className="mt-2 text-muted">
          Prețurile din ghiduri se actualizează automat din datele noastre, iar o reducere e „reală”
          doar dacă prețul e cu minim 5% sub mediana ultimelor 30 de zile.{' '}
          <Link href="/ghiduri/metodologie" className="text-brand underline underline-offset-2">Cum lucrăm</Link>
        </p>
      </header>

      {categories.length > 1 && (
        <nav aria-label="Filtru categorii" className="flex flex-wrap gap-2 mb-6">
          <Link href="/ghiduri" className={pill(!categorie)}>Toate</Link>
          {categories.map((c) => (
            <Link key={c.slug} href={`/ghiduri?categorie=${c.slug}`} className={pill(categorie === c.slug)}>
              {c.name} <span className="opacity-70">({c.count})</span>
            </Link>
          ))}
        </nav>
      )}

      {guides.length === 0 ? (
        <p className="rounded-lg border border-line bg-surface p-6 text-muted">
          Încă nu am publicat ghiduri{categorie ? ' în această categorie' : ''}. Până atunci, vezi{' '}
          <Link href="/" className="text-brand underline underline-offset-2">reducerile reale de azi</Link>.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {guides.map((g) => (
            <li key={g.slug} className="rounded-xl border border-line bg-surface p-5 flex flex-col">
              {g.category_name && (
                <span className="text-xs font-semibold uppercase tracking-wide text-brand">{g.category_name}</span>
              )}
              <h2 className="mt-1 font-semibold text-lg leading-snug">
                <Link href={`/ghiduri/${g.slug}`} className="hover:text-brand">{g.title}</Link>
              </h2>
              {g.meta_description && <p className="mt-2 text-sm text-muted line-clamp-3">{g.meta_description}</p>}
              <p className="mt-auto pt-3 text-xs text-muted">
                {g.published_at ? formatGuideDate(g.published_at) : ''}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
