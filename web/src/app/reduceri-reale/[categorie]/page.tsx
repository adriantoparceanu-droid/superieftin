import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getCategoryBySlug, getLandingProducts } from '@/lib/queries'
import { ProductList } from '@/components/listing/ProductList'
import { ListInfo, ListingHeader, MethodNote } from '@/components/listing/ListingParts'
import { BellIcon } from '@/components/product/icons'
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
      <ListingHeader
        crumbs={[
          { label: 'Acasă', href: '/' },
          { label: category.name, href: `/c/${category.slug}` },
          { label: 'Reduceri reale' },
        ]}
        title={<>Reduceri reale la {lowerFirst(category.name)}</>}
      />

      {/* Textul de metodă al landing-ului (citit de vizitatorii din reclame) — neschimbat, doar în
          caseta „.method” din machetă, cu data ultimei verificări sub el */}
      <MethodNote className="mb-1 max-w-3xl">
        Aici apar doar produsele care costă azi cu cel puțin {REAL_DISCOUNT_PCT}% mai puțin decât
        mediana prețurilor lor din ultimele 30 de zile — nu față de „prețul vechi” afișat de
        magazin. <Link href="/despre" className="font-semibold text-ink underline underline-offset-2 hover:text-red-ink">Cum verificăm</Link>
      </MethodNote>

      {deals.length > 0 ? (
        <>
          <ListInfo aside={lastChecked ? <>Ultima verificare a prețurilor: {lastChecked}</> : undefined}>
            {deals.length === 1 ? '1 reducere reală' : `${deals.length} reduceri reale`}, ordonate după procent
          </ListInfo>
          <h2 className="sr-only">Produse</h2>
          <ProductList products={deals} />
        </>
      ) : (
        <>
          {lastChecked && <ListInfo>Ultima verificare a prețurilor: {lastChecked}</ListInfo>}
          {/* Starea goală: spunem cinstit că acum nu sunt reduceri și trimitem spre alertă */}
          <section className="mt-1 flex gap-3 rounded-2xl bg-surface p-4 shadow-card ring-1 ring-inset ring-line/60 lg:p-5">
            <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-tint text-amber-ink">
              <BellIcon className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-extrabold leading-tight text-ink">
                Acum nu avem reduceri reale la {lowerFirst(category.name)}
              </h2>
              <p className="mt-1 text-sm text-ink-2">
                Prețurile sunt în intervalul lor obișnuit. Deschide un produs și folosește cardul{' '}
                <strong className="text-ink">„Alertă de preț”</strong>: te anunțăm pe Telegram când ajunge la prețul ales.
              </p>
            </div>
          </section>
        </>
      )}

      {/* Lista în afara casetei: pe mobil, rândurile au nevoie de toată lățimea */}
      {nearest.length > 0 && (
        <>
          <h2 className="mt-6 mb-2 text-base font-extrabold text-ink">Cele mai apropiate de o reducere</h2>
          <ProductList products={nearest} />
        </>
      )}

      <p className="mt-8 text-sm">
        <Link href={`/c/${category.slug}`} className="font-semibold text-ink underline underline-offset-[3px] hover:text-red-ink">
          Vezi toate produsele din {lowerFirst(category.name)}
        </Link>
      </p>
      {/* Legături suplimentare (raport SEO, A8): linkul „Cum verificăm” de sus rămâne spre /despre */}
      <p className="mt-2 text-sm flex flex-wrap gap-x-5 gap-y-1">
        <Link href="/ghiduri/metodologie" className="font-semibold text-ink underline underline-offset-[3px] hover:text-red-ink">
          Metodologia completă
        </Link>
        <Link href="/reduceri-reale" className="font-semibold text-ink underline underline-offset-[3px] hover:text-red-ink">
          Reduceri reale în alte categorii
        </Link>
      </p>
    </>
  )
}
