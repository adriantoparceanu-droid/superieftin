import type { Metadata } from 'next'
import Link from 'next/link'
import { getCategoryTreeStats } from '@/lib/seo/queries'
import { indexableCategories } from '@/lib/seo/categories'
import { INK_BUTTON } from '@/components/article'

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
    <section className="mx-auto max-w-2xl py-8 text-center sm:py-14">
      {/* Lupa desenata (in loc de emoji): pe tokeni, corecta si in modul intunecat */}
      <div aria-hidden="true" className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-surface text-ink-3 shadow-card">
        <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="10.5" cy="10.5" r="6" />
          <path d="m15 15 5 5M8.5 8.5l4 4M12.5 8.5l-4 4" />
        </svg>
      </div>
      <p className="mt-5 font-display text-[13px] font-extrabold uppercase tracking-[.08em] text-red-ink">Eroare 404</p>
      <h1 className="mt-1 text-[28px] font-extrabold leading-[1.1] text-ink sm:text-[36px]">Pagina nu există</h1>
      <p className="mx-auto mt-2.5 max-w-md text-[15px] leading-relaxed text-ink-2 sm:text-base">
        Linkul poate fi vechi sau greșit, ori produsul nu mai e listat. Caută produsul sau alege o categorie.
      </p>

      <form action="/cautare" method="get" role="search" className="mx-auto mt-6 flex max-w-md gap-2">
        <input
          name="q"
          type="search"
          placeholder="Caută produs sau brand..."
          aria-label="Caută produs sau brand"
          autoComplete="off"
          className="min-h-12 min-w-0 flex-1 rounded-xl border-[1.5px] border-line-2 bg-surface px-4 text-[15px] text-ink placeholder:text-ink-3 focus:border-ink focus:outline-none"
        />
        <button type="submit" className={INK_BUTTON}>Caută</button>
      </form>

      {roots.length > 0 && (
        <nav aria-label="Categorii principale" className="mt-8">
          <h2 className="text-[12px] font-extrabold uppercase tracking-[.08em] text-ink-3">Categorii</h2>
          <ul className="mt-3 flex flex-wrap justify-center gap-2">
            {roots.map((c) => (
              <li key={c.slug}>
                <Link href={`/c/${c.slug}`} className="inline-flex h-9 items-center rounded-full bg-surface px-3.5 text-[13.5px] font-semibold text-ink ring-1 ring-inset ring-line-2 transition-shadow hover:ring-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <p className="mt-8 flex flex-wrap justify-center gap-x-5 gap-y-2 text-[15px] font-semibold">
        <Link href="/" className="text-red-ink underline-offset-2 hover:underline">Pagina principală</Link>
        <Link href="/reduceri-reale" className="text-red-ink underline-offset-2 hover:underline">Reduceri reale azi</Link>
        <Link href="/ghiduri" className="text-red-ink underline-offset-2 hover:underline">Ghiduri de cumpărare</Link>
      </p>
    </section>
  )
}
