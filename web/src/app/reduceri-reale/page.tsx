import type { Metadata } from 'next'
import Link from 'next/link'
import { REAL_DISCOUNT_PCT } from '@/lib/discount'
import { getCategoryTreeStats, getRealDiscountCounts } from '@/lib/seo/queries'
import { landingCategories } from '@/lib/seo/categories'
import { breadcrumbLd, itemListLd, ldScript } from '@/lib/seo/jsonld'
import { withOg } from '@/lib/seo/og'
import { absUrl, roCount } from '@/lib/seo/site'
import { ListingHeader } from '@/components/listing/ListingParts'

// Hub /reduceri-reale (raport SEO 2026-10-04, A8): legatura interna spre toate landing-urile
// /reduceri-reale/<categorie>, care erau „orfane” (doar sitemap + llms.txt). Fara Sanatate &
// Naturale (REGULI.md, regula 8). Cifrele = aceleasi conditii ca landing-urile (lib/seo/queries.ts).
export const dynamic = 'force-dynamic'

const TITLE = 'Reduceri reale azi, pe categorii'
const DESCRIPTION =
  `Categoriile în care urmărim reducerile reale: prețul de azi cu cel puțin ${REAL_DISCOUNT_PCT}% sub mediana ` +
  'prețurilor din ultimele 30 de zile, nu față de „prețul vechi” afișat de magazin.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/reduceri-reale' },
  openGraph: withOg({ title: TITLE, description: DESCRIPTION, url: absUrl('/reduceri-reale') }),
}

export default async function RealDiscountsHub() {
  const [stats, counts] = await Promise.all([
    getCategoryTreeStats().catch(() => []),
    getRealDiscountCounts().catch(() => ({} as Record<string, number>)),
  ])
  const landing = landingCategories(stats)
  const roots = landing.filter((c) => !c.parent_slug)
  // Subcategoriile al caror parinte nu are landing (ex. parinte ascuns) apar separat, nu se pierd
  const orphans = landing.filter((c) => c.parent_slug && !roots.some((r) => r.slug === c.parent_slug))
  const groups = [
    ...roots.map((r) => ({ root: r, subs: landing.filter((c) => c.parent_slug === r.slug) })),
    ...(orphans.length ? [{ root: null, subs: orphans }] : []),
  ]

  const countText = (slug: string) => {
    const n = counts[slug] ?? 0
    return n > 0 ? `${roCount(n, 'reduceri reale', 'reducere reală')} acum` : 'nicio reducere reală acum'
  }

  const listLd = itemListLd(TITLE, landing.map((c) => ({ name: `Reduceri reale la ${c.name}`, path: `/reduceri-reale/${c.slug}` })))
  const crumbsLd = breadcrumbLd([{ name: 'Acasă', path: '/' }, { name: 'Reduceri reale', path: '/reduceri-reale' }])

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldScript(listLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldScript(crumbsLd) }} />

      <ListingHeader crumbs={[{ label: 'Acasă', href: '/' }, { label: 'Reduceri reale' }]} title={TITLE} />
      <div className="mb-6">
        <p className="max-w-3xl text-sm text-ink-2 sm:text-[15px]">
          Un preț e „reducere reală” doar dacă azi e cu cel puțin {REAL_DISCOUNT_PCT}% sub mediana prețurilor
          aceluiași produs din ultimele 30 de zile — nu față de „prețul vechi” afișat de magazin. Mediana ignoră
          scumpirile de o zi făcute înainte de o „ofertă”. Numărul de reduceri se schimbă zilnic, odată cu prețurile.{' '}
          <Link href="/ghiduri/metodologie" className="font-semibold text-ink underline underline-offset-2 hover:text-red-ink">Metodologia completă</Link>
        </p>
      </div>

      {groups.length === 0 ? (
        <p className="text-sm text-ink-3">Momentan nu avem categorii cu produse disponibile.</p>
      ) : (
        <div className="space-y-4">
          {groups.map(({ root, subs }) => (
            <section key={root?.slug ?? 'altele'} className="rounded-2xl bg-surface p-4 shadow-card ring-1 ring-inset ring-line/60 lg:p-5">
              <h2 className="text-lg font-extrabold text-ink">
                {root ? (
                  <Link href={`/reduceri-reale/${root.slug}`} className="hover:text-red-ink hover:underline underline-offset-2">
                    Reduceri reale la {root.name}
                  </Link>
                ) : 'Alte categorii'}
              </h2>
              {root && <p className={`mt-0.5 text-sm tabular-nums ${(counts[root.slug] ?? 0) > 0 ? 'font-semibold text-red-ink' : 'text-ink-3'}`}>{countText(root.slug)}</p>}
              {subs.length > 0 && (
                <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {subs.map((c) => (
                    <li key={c.slug}>
                      <Link
                        href={`/reduceri-reale/${c.slug}`}
                        className="flex min-h-11 items-center justify-between gap-3 rounded-[10px] bg-surface px-3 py-2 ring-1 ring-inset ring-line-2 transition-shadow hover:ring-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
                      >
                        <span className="text-sm font-semibold text-ink">{c.name}</span>
                        <span className={`whitespace-nowrap text-xs tabular-nums ${(counts[c.slug] ?? 0) > 0 ? 'font-bold text-red-ink' : 'text-ink-3'}`}>{countText(c.slug)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}
    </>
  )
}
