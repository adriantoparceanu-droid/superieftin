import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getCategoryBySlug, getLandingProducts } from '@/lib/queries'
import { ProductCard } from '@/components/ProductCard'
import { REAL_DISCOUNT_PCT } from '@/lib/discount'
import { breadcrumbLd, itemListLd, ldScript } from '@/lib/seo/jsonld'
import { withOg } from '@/lib/seo/og'
import { absUrl } from '@/lib/seo/site'

// Landing page pentru reclamele Search: doar reduceri reale (≥5% sub mediana 30 de zile),
// sortate dupa procent. Tot ce promite anuntul trebuie sa fie adevarat aici (REGULI.md, regula 9).
export const dynamic = 'force-dynamic'

// Categorii excluse din reclame (REGULI.md regula 8; oglinda lui excluded_categories din
// ads/config/guardrails.yaml — directorul ads/ nu ajunge in imaginea web, deci e duplicat aici).
const EXCLUDED_ROOTS = ['sanatate-naturale']

type Props = { params: Promise<{ categorie: string }> }

// Numele categoriilor sunt in Title Case („Telefoane Mobile”); in fraza le vrem cu litere mici:
// „Reduceri reale la telefoane mobile”. Acronimele raman neatinse („Suport TV” → „suport TV”).
function lowerFirst(s: string) {
  return s.split(' ').map((w) => (/^[A-ZĂÂÎȘȚ]{2,}$/.test(w) ? w : w.toLocaleLowerCase('ro-RO'))).join(' ')
}

async function loadCategory(slug: string) {
  const category = await getCategoryBySlug(slug)
  if (!category) return null
  if (EXCLUDED_ROOTS.includes(category.slug) || EXCLUDED_ROOTS.includes(category.parent_slug ?? '')) return null
  return category
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { categorie } = await params
  const category = await loadCategory(categorie)
  if (!category) return {}
  const title = `Reduceri reale la ${lowerFirst(category.name)}`
  const description = `${category.name} cu prețul de azi cu minim ${REAL_DISCOUNT_PCT}% sub mediana ultimelor 30 de zile. Verificat zilnic, la mai multe magazine.`
  return {
    title,
    description,
    alternates: { canonical: `/reduceri-reale/${categorie}` },
    openGraph: withOg({ title, description, url: absUrl(`/reduceri-reale/${categorie}`) }),
  }
}

function formatCheckedAt(iso: string | null): string | null {
  if (!iso) return null
  return new Intl.DateTimeFormat('ro-RO', {
    day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Bucharest',
  }).format(new Date(iso))
}

export default async function LandingPage({ params }: Props) {
  const { categorie } = await params
  const category = await loadCategory(categorie)
  if (!category) notFound()

  const products = await getLandingProducts(categorie)
  const deals = products.filter((p) => p.discount_pct != null)
  // Fara reduceri reale: aratam cele mai apropiate de prag (nu marcate ca reducere)
  const nearest = deals.length ? [] : products.slice(0, 8)

  const shown = deals.length ? deals : nearest
  // pg intoarce Date, iar unstable_cache il serializeaza ca string — comparam ca timestamp
  const lastMs = Math.max(0, ...shown.map((p) => (p.last_checked ? new Date(p.last_checked).getTime() : 0)))
  const lastChecked = formatCheckedAt(lastMs ? new Date(lastMs).toISOString() : null)

  // Date structurate (raport SEO, A8): lista produselor afisate + breadcrumb. Textul vizibil al
  // landing-ului (folosit de reclame) ramane neschimbat.
  const pageTitle = `Reduceri reale la ${lowerFirst(category.name)}`
  const listLd = itemListLd(pageTitle, shown.map((p) => ({ name: p.name, path: `/p/${p.slug}` })))
  const crumbsLd = breadcrumbLd([
    { name: 'Acasă', path: '/' },
    { name: category.name, path: `/c/${category.slug}` },
    { name: pageTitle, path: `/reduceri-reale/${category.slug}` },
  ])

  return (
    <>
      {shown.length > 0 && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldScript(listLd) }} />}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldScript(crumbsLd) }} />
      <nav aria-label="Breadcrumb" className="text-xs text-muted mb-3">
        <Link href="/" className="hover:underline">Acasă</Link>
        {' / '}
        <Link href={`/c/${category.slug}`} className="hover:underline">{category.name}</Link>
        {' / '}
        <span>Reduceri reale</span>
      </nav>

      <header className="mb-6">
        <h1 className="font-archivo text-2xl sm:text-3xl text-[var(--color-text)]">
          Reduceri reale la {lowerFirst(category.name)}
        </h1>
        <p className="mt-2 text-sm sm:text-base text-muted max-w-3xl">
          Aici apar doar produsele care costă azi cu cel puțin {REAL_DISCOUNT_PCT}% mai puțin decât
          mediana prețurilor lor din ultimele 30 de zile — nu față de „prețul vechi” afișat de
          magazin. <Link href="/despre" className="underline underline-offset-2">Cum verificăm</Link>
        </p>
        {lastChecked && (
          <p className="mt-1 text-xs text-muted">Ultima verificare a prețurilor: {lastChecked}</p>
        )}
      </header>

      {deals.length > 0 ? (
        <>
          <p className="text-sm text-muted mb-3">
            {deals.length === 1 ? '1 reducere reală' : `${deals.length} reduceri reale`}, ordonate după procent
          </p>
          <h2 className="sr-only">Produse</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {deals.map((product) => (
              <ProductCard key={product.offer_id} product={product} />
            ))}
          </div>
        </>
      ) : (
        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="font-semibold text-lg text-[var(--color-text)]">
            Acum nu avem reduceri reale la {lowerFirst(category.name)}
          </h2>
          <p className="mt-1 text-sm text-muted">
            Prețurile sunt în intervalul lor obișnuit. Deschide un produs și apasă{' '}
            <strong>🔔 Anunță-mă când scade prețul</strong>: te anunțăm pe Telegram când ajunge la prețul ales.
          </p>
        </section>
      )}

      {/* Grila in afara cutiei: pe mobil, cardurile au nevoie de toata latimea (altfel pretul se taie) */}
      {nearest.length > 0 && (
        <>
          <h2 className="mt-6 mb-3 text-sm font-semibold text-[var(--color-text)]">Cele mai apropiate de o reducere</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {nearest.map((product) => (
              <ProductCard key={product.offer_id} product={product} />
            ))}
          </div>
        </>
      )}

      <p className="mt-8 text-sm">
        <Link href={`/c/${category.slug}`} className="text-brand underline underline-offset-2">
          Vezi toate produsele din {lowerFirst(category.name)}
        </Link>
      </p>
      {/* Legaturi suplimentare (raport SEO, A8): linkul „Cum verificăm” de sus ramane spre /despre */}
      <p className="mt-2 text-sm flex flex-wrap gap-x-5 gap-y-1">
        <Link href="/ghiduri/metodologie" className="text-brand underline underline-offset-2">
          Metodologia completă
        </Link>
        <Link href="/reduceri-reale" className="text-brand underline underline-offset-2">
          Reduceri reale în alte categorii
        </Link>
      </p>
    </>
  )
}
