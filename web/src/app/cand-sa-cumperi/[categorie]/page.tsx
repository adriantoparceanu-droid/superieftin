import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getEditionRows, getPublishedEditions, getTimingCategories, type TimingCategory } from '@/lib/observator/queries'
import {
  datasetLd, faqPageLd, lowestLevelWeeks, monthLabel, monthSlug, plainPct, seasonalityAllowed, signedPct, solidWeeks,
  timingEligible, timingFact, timingSummary, topRealWeeks, trackedSinceDate, weekLabel,
} from '@/lib/observator/observator'
import { breadcrumbLd } from '@/lib/seo/jsonld'
import { isExcludedFromAds } from '@/lib/seo/categories'
import { withOg } from '@/lib/seo/og'
import { absUrl, lowerFirst } from '@/lib/seo/site'
import { ListingHeader } from '@/components/listing/ListingParts'
import { BarChart } from '@/components/observator/BarChart'
import { CARD, FactLead, Faq, H2, JsonLd, LINK, ObservatorLinks, Stat } from '@/components/observator/ObservatorParts'

// /cand-sa-cumperi/<categorie> — „Când să cumperi”, PE CATEGORIE (nu pe model): cât de des au
// apărut reduceri reale, cât au durat, săptămânile cu prețurile cele mai joase față de obișnuit.
// Doar categoriile cu date suficiente (timingEligible: ≥ 50 de produse); restul → 404 (designul:
// „restul nu există, nici noindex”). Fără Sănătate & Naturale. ISR: o dată pe oră.
//
// Regula 9: spunem doar ce s-a întâmplat „de la <data>, de când urmărim categoria”; sub 12 luni de
// date nu afirmăm tipare anuale (seasonalityAllowed).
export const revalidate = 3600
export const dynamicParams = true

export async function generateStaticParams() {
  return []
}

type Props = { params: Promise<{ categorie: string }> }

async function loadCategory(slug: string): Promise<TimingCategory | null> {
  // Fără .catch: o eroare de DB rămâne eroare (ISR păstrează pagina veche), nu un 404 în cache
  const all = await getTimingCategories()
  const c = all.find((x) => x.slug === slug)
  if (!c || !timingEligible(c.weeks) || isExcludedFromAds(c.slug, c.parent_slug)) return null
  return c
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { categorie } = await params
  const c = await loadCategory(categorie)
  if (!c) return { title: 'Pagină negăsită' }
  const title = `Când să cumperi ${lowerFirst(c.name)} — cât de des apar reduceri reale`
  const description =
    `De la ${trackedSinceDate(c.tracked_since)}, de când urmărim categoria: cât de des au avut ${lowerFirst(c.name)} o reducere reală, cât a durat ` +
    'și în ce săptămâni prețurile au fost cele mai joase față de obișnuit. Date zilnice superieftin.ro.'
  const path = `/cand-sa-cumperi/${c.slug}`
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: withOg({ title, description, url: absUrl(path) }),
  }
}

const pct1 = (v: number) => plainPct(v)

export default async function BuyTimingPage({ params }: Props) {
  const { categorie } = await params
  const c = await loadCategory(categorie)
  if (!c) notFound()

  const s = timingSummary(c.weeks)
  const last = c.weeks[c.weeks.length - 1]
  const name = lowerFirst(c.name)
  const fact = timingFact(name, c.tracked_since, s, c.computed_at, last.products)
  const seasonal = seasonalityAllowed(c.tracked_since)
  const topReal = topRealWeeks(c.weeks)
  const lowest = lowestLevelWeeks(c.weeks)
  const chartWeeks = c.weeks.slice(-26) // cel mult o jumătate de an pe grafic (rămâne lizibil pe telefon)
  const topKeys = new Set(topReal.map((w) => w.week))

  // Rândul categoriei din ultima ediție a indicelui (dacă a intrat în ea)
  const editions = await getPublishedEditions().catch(() => [])
  const latest = editions[0]
  const indexRow = latest
    ? (await getEditionRows(latest.month).catch(() => [])).find((r) => r.category_slug === c.slug)
    : undefined

  const firstWeek = c.weeks[0].week
  const lastWeekEnd = (() => { const d = new Date(`${last.week}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 6); return d.toISOString().slice(0, 10) })()

  const faq = [
    { q: `Cât de des apar reduceri reale la ${name}?`, a: fact },
    {
      q: `Există o perioadă a anului în care ${name} sunt mai ieftine?`,
      a: seasonal
        ? `Avem peste 12 luni de date; săptămânile cu cele mai multe reduceri reale sunt listate pe pagină. Un tipar dintr-un singur an nu garantează că se repetă.`
        : `Încă nu putem spune: urmărim categoria de la ${trackedSinceDate(c.tracked_since)}, adică mai puțin de 12 luni. Pagina arată doar ce s-a întâmplat în perioada urmărită, nu un tipar anual.`,
    },
    {
      q: 'Ce înseamnă „reducere reală”?',
      a: 'Prețul unui produs într-o zi este cu cel puțin 5% sub mediana prețurilor aceluiași produs din ultimele 30 de zile — nu față de „prețul vechi” afișat de magazin.',
    },
    {
      q: 'Ce este „nivelul prețurilor față de obișnuit”?',
      a: 'Pentru fiecare produs urmărit de cel puțin 4 săptămâni comparăm prețul săptămânii cu prețul lui obișnuit (mediana săptămânilor urmărite); 100 = prețul obișnuit, 95 = cu 5% mai ieftin. Pentru categorie luăm mediana pe produse.',
    },
  ]

  const path = `/cand-sa-cumperi/${c.slug}`
  const crumbs = [
    { name: 'Acasă', path: '/' },
    { name: 'Când să cumperi', path: '/cand-sa-cumperi' },
    { name: c.name, path },
  ]
  const dataset = datasetLd({
    name: `Reduceri reale la ${name}, pe săptămâni (superieftin.ro)`,
    description: `Seria săptămânală pentru ${name}: procentul zilelor-produs cu reducere reală, durata medie a reducerilor și nivelul prețurilor față de prețul obișnuit al fiecărui produs.`,
    path,
    dateModified: c.computed_at,
    temporalCoverage: `${firstWeek}/${lastWeekEnd}`,
    variableMeasured: ['zile-produs cu reducere reală (%)', 'durata medie a unei reduceri reale (zile)', 'nivelul median al prețurilor față de obișnuit (100 = obișnuit)'],
  })

  return (
    <>
      <JsonLd data={breadcrumbLd(crumbs)} />
      <JsonLd data={dataset} />
      <JsonLd data={faqPageLd(faq)} />

      <ListingHeader
        crumbs={[{ label: 'Acasă', href: '/' }, { label: 'Când să cumperi', href: '/cand-sa-cumperi' }, { label: c.name }]}
        title={`Când să cumperi ${name}`}
      />

      <FactLead>{fact}</FactLead>

      <section className={CARD}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat value={s.realShare != null ? plainPct(s.realShare) : '—'} label="din zilele-produs cu reducere reală" />
          <Stat value={s.avgStreak != null ? s.avgStreak.toLocaleString('ro-RO', { maximumFractionDigits: 1 }) : '—'} label="zile durează în medie o reducere reală" />
          <Stat value={last.products.toLocaleString('ro-RO')} label="produse urmărite în ultima săptămână" />
          <Stat value={trackedSinceDate(c.tracked_since)} label="urmărim categoria de la" />
        </div>
        {!seasonal && (
          <p className="mt-3 text-sm text-ink-3">
            Avem mai puțin de 12 luni de date pentru {name}, deci nu putem spune încă dacă tiparul de mai jos se repetă de la
            an la an. Cifrele descriu doar perioada urmărită.
          </p>
        )}
      </section>

      <section className={`mt-4 ${CARD}`}>
        <h2 className={H2}>Reduceri reale, pe săptămâni</h2>
        <p className="mt-1 text-sm text-ink-3">Procentul zilelor-produs cu reducere reală, în fiecare săptămână (luni–duminică). Cu roșu: săptămânile cu cele mai multe.</p>
        <BarChart
          ariaLabel={`Procentul zilelor cu reducere reală la ${name}, pe săptămâni`}
          format={pct1}
          bars={chartWeeks.map((w) => ({
            key: w.week,
            value: w.real_discount_share,
            tick: new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${w.week}T00:00:00Z`)),
            title: `${weekLabel(w.week)}: ${w.real_discount_share != null ? plainPct(w.real_discount_share) : '—'} (${w.products} produse)`,
            highlight: topKeys.has(w.week),
          }))}
        />
      </section>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <section className={CARD}>
          <h2 className={H2}>Cele mai multe reduceri reale</h2>
          {topReal.length ? (
            <ol className="mt-2 space-y-1.5 text-sm">
              {topReal.map((w) => (
                <li key={w.week} className="flex justify-between gap-3">
                  <span className="text-ink-2">{weekLabel(w.week)}</span>
                  <span className="font-semibold tabular-nums text-ink">{plainPct(w.real_discount_share)} din zile</span>
                </li>
              ))}
            </ol>
          ) : <p className="mt-2 text-sm text-ink-3">În perioada urmărită nu am înregistrat reduceri reale în săptămânile cu date suficiente.</p>}
        </section>
        <section className={CARD}>
          <h2 className={H2}>Prețuri cele mai joase față de obișnuit</h2>
          {lowest.length ? (
            <ol className="mt-2 space-y-1.5 text-sm">
              {lowest.map((w) => (
                <li key={w.week} className="flex justify-between gap-3">
                  <span className="text-ink-2">{weekLabel(w.week)}</span>
                  <span className="font-semibold tabular-nums text-ink">{signedPct((w.basket_median ?? 100) - 100)} față de obișnuit</span>
                </li>
              ))}
            </ol>
          ) : <p className="mt-2 text-sm text-ink-3">Nivelul median al prețurilor a rămas la prețul obișnuit în toate săptămânile cu date suficiente: cele mai multe produse nu și-au schimbat prețul de la o săptămână la alta.</p>}
        </section>
      </div>

      <section className={`mt-4 ${CARD}`}>
        <h2 className={H2}>Toate săptămânile</h2>
        <div className="mt-2 max-h-[420px] overflow-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead className="sticky top-0 bg-surface">
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-3">
                <th className="py-2 pr-3 font-semibold">Săptămâna</th>
                <th className="py-2 pr-3 font-semibold text-right">Produse</th>
                <th className="py-2 pr-3 font-semibold text-right">Zile cu reducere reală</th>
                <th className="py-2 font-semibold text-right">Nivel (100 = obișnuit)</th>
              </tr>
            </thead>
            <tbody>
              {[...c.weeks].reverse().map((w) => {
                const solid = solidWeeks([w]).length > 0
                return (
                  <tr key={w.week} className={`border-b border-line last:border-0 ${solid ? '' : 'text-ink-3'}`}>
                    <td className="py-1.5 pr-3">{weekLabel(w.week)}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{w.products.toLocaleString('ro-RO')}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{plainPct(w.real_discount_share)}</td>
                    <td className="py-1.5 text-right tabular-nums">{w.basket_median != null ? w.basket_median.toLocaleString('ro-RO', { maximumFractionDigits: 1 }) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-ink-3">Cu gri: săptămâni cu mai puțin de 50 de produse urmărite (nu intră în topurile de mai sus).</p>
      </section>

      <section className={`mt-4 ${CARD}`}>
        <h2 className={H2}>Mai departe</h2>
        <ul className="mt-2 space-y-1 text-[15px]">
          <li><Link href={`/reduceri-reale/${c.slug}`} className={LINK}>Reducerile reale de azi la {name}</Link></li>
          <li><Link href={`/c/${c.slug}`} className={LINK}>Toate produsele din {name}</Link></li>
          {latest && indexRow && (
            <li>
              <Link href={`/indice/${monthSlug(latest.month)}`} className={LINK}>Indicele prețurilor, {monthLabel(latest.month)}</Link>
              <span className="text-ink-3"> — la {name}: {signedPct(indexRow.median_change_pct)} față de luna anterioară</span>
            </li>
          )}
        </ul>
      </section>

      <Faq items={faq} />
      <ObservatorLinks current="cand" />
    </>
  )
}
