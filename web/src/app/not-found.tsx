import type { Metadata } from 'next'
import Link from 'next/link'
import { getCategoryTreeStats } from '@/lib/seo/queries'
import { indexableCategories } from '@/lib/seo/categories'

// Pagina 404 in romana (raport SEO 2026-10-04, A2). Statusul ramane 404. `noindex` il pune Next
// singur pe orice 404 (un `robots` aici ar dubla tagul); fara canonical — layout-ul nu mai
// mosteneste canonical/robots.
export const metadata: Metadata = {
  title: 'Pagina nu există',
  description: 'Pagina căutată nu există sau a fost mutată.',
}

export default async function NotFound() {
  // Categoriile principale (parinti cu produse disponibile); o eroare DB nu strica pagina 404
  const roots = await getCategoryTreeStats()
    .then((all) => indexableCategories(all).filter((c) => !c.parent_slug))
    .catch(() => [])

  return (
    <section className="max-w-2xl mx-auto py-12 text-center">
      <p className="text-5xl mb-4" aria-hidden="true">🔎</p>
      <h1 className="text-2xl font-black font-archivo text-[var(--color-text)]">Pagina nu există</h1>
      <p className="mt-2 text-muted">
        Linkul poate fi vechi sau greșit, ori produsul nu mai e listat. Caută produsul sau alege o categorie.
      </p>

      <form action="/cautare" method="get" className="flex gap-2 mt-6 max-w-md mx-auto">
        <input
          name="q"
          type="search"
          placeholder="Caută produs sau brand..."
          aria-label="Caută produs sau brand"
          autoComplete="off"
          className="flex-1 px-4 py-2.5 rounded-lg border border-line bg-surface text-[var(--color-text)] text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2"
        />
        <button
          type="submit"
          className="px-5 py-2.5 bg-brand hover:bg-brand-dark text-white text-sm font-semibold rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        >
          Caută
        </button>
      </form>

      {roots.length > 0 && (
        <nav aria-label="Categorii principale" className="mt-8">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wide">Categorii</h2>
          <ul className="mt-3 flex flex-wrap justify-center gap-2">
            {roots.map((c) => (
              <li key={c.slug}>
                <Link href={`/c/${c.slug}`} className="inline-block text-sm px-3 py-1.5 rounded-full border border-line bg-surface hover:border-brand hover:text-brand transition-colors">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <p className="mt-8 text-sm flex flex-wrap justify-center gap-x-5 gap-y-2">
        <Link href="/" className="text-brand hover:underline">Pagina principală</Link>
        <Link href="/reduceri-reale" className="text-brand hover:underline">Reduceri reale azi</Link>
        <Link href="/ghiduri" className="text-brand hover:underline">Ghiduri de cumpărare</Link>
      </p>
    </section>
  )
}
