import type { Metadata } from 'next'
import Link from 'next/link'
import { getTimingEligible, type TimingCategory } from '@/lib/observator/queries'
import { MIN_TIMING_PRODUCTS, faqPageLd, plainPct, timingSummary, trackedSincePhrase } from '@/lib/observator/observator'
import { breadcrumbLd, itemListLd } from '@/lib/seo/jsonld'
import { withOg } from '@/lib/seo/og'
import { absUrl, formatRoDate, lowerFirst, roCount } from '@/lib/seo/site'
import { ListingHeader } from '@/components/listing/ListingParts'
import { CARD, FactLead, Faq, H2, JsonLd, LINK, ObservatorLinks } from '@/components/observator/ObservatorParts'

// /cand-sa-cumperi — lista categoriilor cu date suficiente pentru „Când să cumperi” (seria
// săptămânală din category_buy_timing, migrația 037). Fără Sănătate & Naturale (exclusă de worker).
// Randată la cerere (DB-ul nu e accesibil la build), datele în cache o oră.
export const dynamic = 'force-dynamic'

const TITLE = 'Când să cumperi — cât de des apar reduceri reale, pe categorii'
const DESCRIPTION =
  'Pentru fiecare categorie urmărită: cât de des au apărut reduceri reale, cât au durat și în ce săptămâni ' +
  'prețurile au fost cele mai joase față de obișnuit. Calculat din prețurile zilnice ale magazinelor online din România.'

export async function generateMetadata(): Promise<Metadata> {
  const cats = await getTimingEligible().catch(() => [] as TimingCategory[])
  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: '/cand-sa-cumperi' },
    ...(cats.length ? {} : { robots: { index: false, follow: true } }),
    openGraph: withOg({ title: TITLE, description: DESCRIPTION, url: absUrl('/cand-sa-cumperi') }),
  }
}

const FAQ = [
  {
    q: 'Ce arată paginile „Când să cumperi”?',
    a: 'Pentru o categorie, cât de des au avut produsele ei o reducere reală (preț cu cel puțin 5% sub mediana pe 30 de zile), cât a durat de obicei o astfel de reducere și în ce săptămâni nivelul prețurilor a fost cel mai jos față de prețul obișnuit al fiecărui produs.',
  },
  {
    q: 'Pot afla din ele când va fi cel mai ieftin?',
    a: 'Nu. Cifrele descriu ce s-a întâmplat în perioada în care am urmărit categoria. Până nu avem cel puțin 12 luni de date nu putem spune dacă un tipar se repetă de la an la an.',
  },
  {
    q: 'De ce nu găsesc toate categoriile?',
    a: `O categorie are pagină doar dacă urmărim cel puțin ${MIN_TIMING_PRODUCTS} de produse din ea de câteva săptămâni. Categoria Sănătate & Naturale și farmacia veterinară nu sunt incluse.`,
  },
]

export default async function BuyTimingHub() {
  const cats = await getTimingEligible().catch(() => [] as TimingCategory[])
  const roots = cats.filter((c) => !c.parent_slug || !cats.some((p) => p.slug === c.parent_slug))
  // Numărăm categoriile distincte: un părinte care are subcategorii în listă nu se numără separat
  const distinct = cats.filter((c) => !cats.some((x) => x.parent_slug === c.slug)).length
  const since = cats.map((c) => c.tracked_since).sort()[0]
  const computed = cats.map((c) => c.computed_at).sort().reverse()[0]

  const crumbs = [{ name: 'Acasă', path: '/' }, { name: 'Când să cumperi', path: '/cand-sa-cumperi' }]
  const list = itemListLd(TITLE, cats.map((c) => ({ name: `Când să cumperi ${lowerFirst(c.name)}`, path: `/cand-sa-cumperi/${c.slug}` })))

  const row = (c: TimingCategory) => {
    const s = timingSummary(c.weeks)
    return (
      <li key={c.slug}>
        <Link
          href={`/cand-sa-cumperi/${c.slug}`}
          className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-0.5 rounded-[10px] bg-surface px-3 py-2 ring-1 ring-inset ring-line-2 transition-shadow hover:ring-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
        >
          <span className="text-sm font-semibold text-ink">{c.name}</span>
          <span className="text-xs tabular-nums text-ink-3">
            {s.realShare != null ? `${plainPct(s.realShare)} din zile cu reducere reală` : 'fără reduceri reale'}
          </span>
        </Link>
      </li>
    )
  }

  return (
    <>
      <JsonLd data={breadcrumbLd(crumbs)} />
      {cats.length > 0 && <JsonLd data={list} />}
      <JsonLd data={faqPageLd(FAQ)} />

      <ListingHeader crumbs={[{ label: 'Acasă', href: '/' }, { label: 'Când să cumperi' }]} title="Când să cumperi" />

      {cats.length > 0 && since && computed ? (
        <>
          <FactLead>
            Urmărim {roCount(distinct, 'categorii', 'categorie')} cu date suficiente pentru a arăta cât de des apar reducerile
            reale, {trackedSincePhrase(since, 'prețurile')}. Cifrele se recalculează
            săptămânal din prețurile zilnice; ultima actualizare: {formatRoDate(computed)}.
          </FactLead>
          <div className="space-y-4">
            {roots.map((r) => {
              const subs = cats.filter((c) => c.parent_slug === r.slug)
              return (
                <section key={r.slug} className={CARD}>
                  <h2 className={H2}>
                    <Link href={`/cand-sa-cumperi/${r.slug}`} className="hover:text-red-ink hover:underline underline-offset-2">
                      Când să cumperi {lowerFirst(r.name)}
                    </Link>
                  </h2>
                  {subs.length > 0 && <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">{subs.map(row)}</ul>}
                </section>
              )
            })}
          </div>
        </>
      ) : (
        <FactLead>
          Încă nu avem destule date pentru nicio categorie. O pagină apare când urmărim cel puțin {MIN_TIMING_PRODUCTS} de
          produse din categorie de câteva săptămâni. Până atunci, vezi <Link href="/reduceri-reale" className={LINK}>reducerile reale de azi</Link>.
        </FactLead>
      )}

      <Faq items={FAQ} />
      <ObservatorLinks current="cand" />
    </>
  )
}
