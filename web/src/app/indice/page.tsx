import type { Metadata } from 'next'
import Link from 'next/link'
import { getPublishedEditions } from '@/lib/observator/queries'
import {
  MIN_INDEX_BASKET, datasetLd, editionFact, faqPageLd, monthLabel, monthSlug, signedPct, type Edition,
} from '@/lib/observator/observator'
import { breadcrumbLd } from '@/lib/seo/jsonld'
import { withOg } from '@/lib/seo/og'
import { absUrl, roCount } from '@/lib/seo/site'
import { ListingHeader } from '@/components/listing/ListingParts'
import { BarChart } from '@/components/observator/BarChart'
import { Badge, CARD, FactLead, Faq, H2, JsonLd, LINK, ObservatorLinks, Stat } from '@/components/observator/ObservatorParts'

// /indice — indicele lunar al prețurilor (observatorul reducerilor reale, migrația 037): ultima
// ediție + arhiva. Cifrele vin gata calculate de worker (jobul price-index); pagina doar citește.
// Randată la cerere (DB-ul nu e accesibil la build) cu datele în cache o oră (lib/observator/queries.ts).
export const dynamic = 'force-dynamic'

const TITLE = 'Indicele prețurilor online, lună de lună'
const DESCRIPTION =
  'Indicele lunar superieftin.ro: variația prețului tipic pe categorii, pe un coș stabil de produse, ' +
  'cu cele mai mari scăderi și numărul de reduceri reale. Calculat din prețurile zilnice ale magazinelor online din România.'

export async function generateMetadata(): Promise<Metadata> {
  const editions = await getPublishedEditions().catch(() => [] as Edition[])
  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: '/indice' },
    // Fără nicio ediție publicată pagina ar fi goală → nu o indexăm până apare prima
    ...(editions.length ? {} : { robots: { index: false, follow: true } }),
    openGraph: withOg({ title: TITLE, description: DESCRIPTION, url: absUrl('/indice') }),
  }
}

const FAQ = [
  {
    q: 'Ce este indicele prețurilor superieftin.ro?',
    a: 'O măsurătoare lunară a prețurilor din magazinele online pe care le urmărim. Pentru fiecare categorie comparăm prețul tipic al acelorași produse în două luni consecutive și publicăm variația, cele mai mari scăderi și câte produse au avut reduceri reale.',
  },
  {
    q: 'Ce este coșul stabil?',
    a: 'Produsele care au avut preț în stoc în AMBELE luni comparate. Produsele apărute sau dispărute între timp nu intră în calcul, ca schimbările din catalogul magazinelor să nu fie confundate cu schimbări de preț.',
  },
  {
    q: 'Cum se calculează variația unei categorii?',
    a: 'Pentru fiecare produs luăm mediana prețurilor zilnice în stoc din lună, la fiecare magazin, și păstrăm valoarea cea mai mică. Variația categoriei este mediana variațiilor pe produs: câteva produse cu scumpiri sau ieftiniri extreme nu mută cifra întregii categorii.',
  },
  {
    q: 'De ce lipsesc unele categorii?',
    a: `O categorie apare doar dacă are cel puțin ${MIN_INDEX_BASKET} de produse în coșul stabil; sub acest număr variația ar depinde de prea puține produse. Categoria Sănătate & Naturale și farmacia veterinară nu sunt incluse.`,
  },
  {
    q: 'Ce înseamnă „calculat retroactiv”?',
    a: 'Edițiile lunilor de dinaintea lansării indicelui au fost calculate ulterior, cu aceeași metodă, din istoricul de prețuri pe care îl aveam deja. Le marcăm separat ca să fie clar că nu au fost publicate la vremea lor.',
  },
  {
    q: 'Se mai schimbă o ediție după publicare?',
    a: 'Nu. O ediție publicată rămâne neschimbată, ca arhivă. Dacă descoperim o eroare, adăugăm o notă de corecție vizibilă pe pagina ediției, în loc să rescriem cifrele.',
  },
]

export default async function IndexHub() {
  const editions = await getPublishedEditions().catch(() => [] as Edition[])
  const latest = editions[0]
  const chrono = [...editions].reverse()

  const crumbs = [{ name: 'Acasă', path: '/' }, { name: 'Indicele prețurilor', path: '/indice' }]
  const dataset = latest
    ? datasetLd({
        name: 'Indicele lunar al prețurilor online din România (superieftin.ro)',
        description: 'Variația lunară a prețului tipic pe categorii de produse, pe un coș stabil, calculată din prețurile zilnice ale magazinelor online urmărite de superieftin.ro.',
        path: '/indice',
        dateModified: latest.computed_at,
        temporalCoverage: `${monthSlug(chrono[0].month)}/${monthSlug(latest.month)}`,
        variableMeasured: ['variația mediană a prețului pe produs (%)', 'mărimea coșului stabil', 'produse cu reducere reală în lună'],
        keywords: ['indice prețuri', 'prețuri online România', 'reduceri reale'],
      })
    : null

  return (
    <>
      <JsonLd data={breadcrumbLd(crumbs)} />
      <JsonLd data={dataset} />
      <JsonLd data={faqPageLd(FAQ)} />

      <ListingHeader crumbs={[{ label: 'Acasă', href: '/' }, { label: 'Indicele prețurilor' }]} title="Indicele prețurilor" />

      {latest ? (
        <>
          <FactLead>{editionFact(latest)}</FactLead>

          <section className={CARD}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className={H2}>
                Ultima ediție: <Link href={`/indice/${monthSlug(latest.month)}`} className="hover:text-red-ink hover:underline underline-offset-2">{monthLabel(latest.month)}</Link>
              </h2>
              {latest.retroactive && <Badge>calculat retroactiv</Badge>}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat value={signedPct(latest.median_change_pct)} label="variația mediană față de luna anterioară" />
              <Stat value={latest.basket_size.toLocaleString('ro-RO')} label="produse în coșul stabil" />
              <Stat value={latest.categories.toLocaleString('ro-RO')} label="categorii incluse" />
              <Stat value={latest.real_discounts.toLocaleString('ro-RO')} label="produse cu cel puțin o zi de reducere reală" />
            </div>
            <p className="mt-3 text-sm">
              <Link href={`/indice/${monthSlug(latest.month)}`} className={LINK}>Vezi ediția pe categorii, cu cele mai mari scăderi →</Link>
            </p>
          </section>

          {chrono.length > 1 && (
            <section className={`mt-4 ${CARD}`}>
              <h2 className={H2}>Variația mediană, lună de lună</h2>
              <BarChart
                ariaLabel="Variația mediană a prețurilor pe produs, pe luni"
                format={(v) => signedPct(v)}
                bars={chrono.map((e) => ({
                  key: e.month,
                  value: e.median_change_pct,
                  tick: monthLabel(e.month).replace(/ \d{4}$/, ''),
                  title: `${monthLabel(e.month)}: ${signedPct(e.median_change_pct)} (coș de ${roCount(e.basket_size, 'produse', 'produs')})`,
                  highlight: e.month === latest.month,
                }))}
              />
            </section>
          )}

          <section className={`mt-4 ${CARD}`}>
            <h2 className={H2}>Arhiva edițiilor</h2>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-3">
                    <th className="py-2 pr-3 font-semibold">Luna</th>
                    <th className="py-2 pr-3 font-semibold text-right">Variația mediană</th>
                    <th className="py-2 pr-3 font-semibold text-right">Coș</th>
                    <th className="py-2 pr-3 font-semibold text-right">Categorii</th>
                    <th className="py-2 font-semibold text-right">Cu reducere reală</th>
                  </tr>
                </thead>
                <tbody>
                  {editions.map((e) => (
                    <tr key={e.month} className="border-b border-line last:border-0">
                      <td className="py-2 pr-3">
                        <Link href={`/indice/${monthSlug(e.month)}`} className="font-semibold text-ink hover:text-red-ink hover:underline underline-offset-2">{monthLabel(e.month)}</Link>
                        {e.retroactive && <span className="ml-2"><Badge>retroactiv</Badge></span>}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">{signedPct(e.median_change_pct)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{e.basket_size.toLocaleString('ro-RO')}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{e.categories}</td>
                      <td className="py-2 text-right tabular-nums">{e.real_discounts.toLocaleString('ro-RO')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : (
        <FactLead>
          Încă nu am publicat nicio ediție a indicelui. Ediția unei luni se calculează după ce luna se încheie, din
          prețurile zilnice înregistrate în acea lună și în luna anterioară.
        </FactLead>
      )}

      <section className={`mt-4 ${CARD}`}>
        <h2 className={H2}>Cum citești indicele</h2>
        <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-ink-2">
          O variație de −2% înseamnă că, pentru jumătate dintre produsele din coș, prețul lunar a scăzut cu cel puțin 2%
          față de luna anterioară. Prețul lunar al unui produs e mediana prețurilor zilnice în stoc, la magazinul cel mai
          ieftin. Indicele descrie ce s-a întâmplat; nu este o estimare a prețurilor viitoare.{' '}
          <Link href="/ghiduri/metodologie" className={LINK}>Metodologia completă</Link>
        </p>
      </section>

      <Faq items={FAQ} />
      <ObservatorLinks current="indice" />
    </>
  )
}
