import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ListingHeader, MethodNote } from '@/components/listing/ListingParts'
import { ProductList } from '@/components/listing/ProductList'
import { RealShareChart } from './RealShareChart'
import {
  EVENT_INFLATED_MIN_PCT, EVENT_LOOKBACK_DAYS, EVENT_REAL_PCT, EVENT_REDUCED_MIN_PCT, EVENT_REFERENCE_DAYS,
  chartPoints, dayLabel, eventFaq, eventPhase, headlineSentence, isEventExcluded, lastEventDay, latestDay,
  referenceMonth, share, tableRows, type DailyStat, type EventPhase, type PriceEvent,
} from '@/lib/event-tracker'
import { getEventDailyStats, getEventTopDeals, getPriceEvent, type EventDeal } from '@/lib/event-tracker-queries'
import { getCategoryTreeStats, getRealDiscountCounts } from '@/lib/seo/queries'
import { landingCategories } from '@/lib/seo/categories'
import { breadcrumbLd, datasetLd, faqPageLd, ldScript } from '@/lib/seo/jsonld'
import { withOg } from '@/lib/seo/og'
import { absUrl, formatRoDate, roCount } from '@/lib/seo/site'
import { formatPct } from '@/lib/discount'
import { roDay } from '@/lib/price-series'

// Pagina unui eveniment urmărit (Black Friday 2026 → app/black-friday-2026/page.tsx). Generică pe
// slug-ul evenimentului (rândul din price_events), ca anul viitor `/black-friday-2027` să fie doar
// un rând nou în tabel + un page.tsx de 3 linii. Fără rută dinamică generică: fiecare eveniment
// își are URL-ul explicit (și nimic altceva nu poate răspunde 200 sub un slug inventat).
//
// Două stări:
//   - înainte de îngheț (sau până la primul calcul): ce măsurăm, de când, cum, + reducerile reale
//     de azi pe categorii (regula obișnuită, linkuri spre /reduceri-reale/<categorie>);
//   - după: fraza-fapt datată, cifre-cheie, tabel pe categorii, grafic zilnic, top reduceri reale
//     pe vertical (doar cât ține fereastra), metodologie, FAQ.
// Toate cifrele vin din tabelele precalculate de worker (lib/event-tracker-queries.ts).
// Ton pozitiv + agregat: fără clasament de magazine; „umflarea” doar pe categorie.

interface Loaded {
  event: PriceEvent
  phase: EventPhase
  stats: DailyStat[]
  day: string | null
  frozen: boolean          // referința e deja înghețată (now ≥ freeze_at)
}

async function load(slug: string): Promise<Loaded | null> {
  const event = await getPriceEvent(slug)
  if (!event) return null
  const stats = await getEventDailyStats(slug).catch(() => [] as DailyStat[])
  // „Acum” se citește o singură dată, aici (în afara randării — regula de puritate React)
  const now = new Date()
  return { event, phase: eventPhase(event, now), stats, day: latestDay(stats), frozen: now >= new Date(event.freeze_at) }
}

function titleFor(e: PriceEvent) {
  return `${e.name}: cât de reale sunt reducerile`
}

export async function eventMetadata(slug: string): Promise<Metadata> {
  const data = await load(slug).catch(() => null)
  if (!data) return {}
  const { event, stats, day } = data
  const path = `/${event.slug}`
  const title = titleFor(event)
  const total = day ? tableRows(stats, day).total : null
  const description = total
    ? headlineSentence(total, event)
    : `Măsurăm zilnic reducerile de ${event.name} față de mediana prețurilor din ${referenceMonth(event)}, `
      + `înghețată pe ${formatRoDate(event.freeze_at)}: câte sunt reale, pe categorii.`
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: withOg({ title, description, url: absUrl(path) }),
  }
}

const card = 'rounded-2xl bg-surface p-4 shadow-card ring-1 ring-inset ring-line/60 lg:p-5'
const link = 'font-semibold text-ink underline underline-offset-2 hover:text-red-ink'

function Figure({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl bg-surface-2 px-3 py-2.5">
      <dt className="text-[12px] font-semibold uppercase tracking-[.06em] text-ink-3">{label}</dt>
      <dd className="mt-0.5 font-display text-[24px] font-black leading-tight tabular-nums text-ink">{value}</dd>
      {hint && <dd className="text-[12px] text-ink-3">{hint}</dd>}
    </div>
  )
}

const pctText = (p: number | null) => (p == null ? '—' : `${p}%`)

export async function EventTrackerPage({ slug }: { slug: string }) {
  const data = await load(slug)
  if (!data) notFound()
  const { event, phase, stats, day, frozen } = data
  const path = `/${event.slug}`
  const title = titleFor(event)
  const month = referenceMonth(event)
  const freeze = formatRoDate(event.freeze_at)
  const lastDay = formatRoDate(lastEventDay(event))
  const hasData = frozen && day != null
  const { total, rows } = day ? tableRows(stats, day) : { total: null, rows: [] }
  const points = chartPoints(stats)

  // Topul reducerilor reale: doar cât ține fereastra (după ea prețurile nu mai sunt cele măsurate)
  const deals = hasData && phase === 'live' && day
    ? await getEventTopDeals(event.slug, day).catch(() => [] as EventDeal[])
    : []
  const rootsById = new Map(rows.filter((r) => !r.indent).map((r) => [r.category_id, r]))
  const dealGroups = [...rootsById.values()]
    .map((root) => ({ root, items: deals.filter((d) => d.root_id === root.category_id) }))
    .filter((g) => g.items.length > 0)

  // Înainte de îngheț: reducerile reale de azi (regula obișnuită), pe categorii
  const [catStats, counts] = hasData
    ? [[], {} as Record<string, number>]
    : await Promise.all([
      getCategoryTreeStats().catch(() => []),
      getRealDiscountCounts().catch(() => ({} as Record<string, number>)),
    ])
  const landing = landingCategories(catStats).filter((c) => !isEventExcluded(c.slug, c.parent_slug))
  const todayRoots = landing.filter((c) => !c.parent_slug)

  const faq = eventFaq(event)
  const crumbs = breadcrumbLd([{ name: 'Acasă', path: '/' }, { name: event.name, path }])
  const faqLd = faqPageLd(faq)
  const startDay = roDay(event.starts_at)   // ziua din România (toISOString ar da ziua UTC, cu o zi înainte)
  const dataset = hasData && total
    ? datasetLd({
      name: `${event.name} — reduceri reale vs. reduceri umflate, pe zile și categorii`,
      description: `Agregate zilnice măsurate de superieftin.ro: produse reduse, reduceri reale (preț cu cel puțin ${EVENT_REAL_PCT}% sub mediana din ${month}, înghețată pe ${freeze}) și reduceri umflate, pe categorii de produse, în magazinele online din România.`,
      path,
      temporalCoverage: `${startDay}/${day}`,
      dateModified: new Date(total.computed_at).toISOString(),
      variableMeasured: [
        'Produse urmărite', 'Produse reduse', 'Reduceri reale (% din produsele reduse)',
        'Reducerea reală mediană (%)', 'Reduceri umflate (% din produsele reduse)', 'Magazine incluse',
      ],
      keywords: ['Black Friday', 'reduceri reale', 'prețuri', 'România'],
    })
    : null

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldScript(crumbs) }} />
      {faqLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldScript(faqLd) }} />}
      {dataset && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldScript(dataset) }} />}

      <ListingHeader crumbs={[{ label: 'Acasă', href: '/' }, { label: event.name }]} title={title} />

      {hasData && total ? (
        <>
          {/* Fraza-fapt datată (citabilă) + momentul calculului */}
          <section aria-labelledby="pe-scurt" className={card}>
            <h2 id="pe-scurt" className="sr-only">Pe scurt</h2>
            <p className="text-[17px] font-semibold leading-snug text-ink lg:text-[19px]">{headlineSentence(total, event)}</p>
            <p className="mt-1.5 text-[12.5px] text-ink-3">
              {phase === 'after'
                ? <>Arhivă: măsurătorile s-au încheiat pe {lastDay}. Cifrele de mai jos sunt cele din {dayLabel(total.day)}.</>
                : <>Calculat zilnic, după verificarea prețurilor. Ultimul calcul: {new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Bucharest' }).format(new Date(total.computed_at))}.</>}
            </p>
            <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              <Figure label="Produse urmărite" value={total.tracked.toLocaleString('ro-RO')} hint="cu referință, disponibile" />
              <Figure label="Reduse" value={total.reduse.toLocaleString('ro-RO')} hint={`față de maximul pe ${EVENT_LOOKBACK_DAYS} zile`} />
              <Figure label="Reduceri reale" value={pctText(share(total.reduse_reale, total.reduse))} hint="din produsele reduse" />
              <Figure label="Reducerea reală mediană" value={total.real_discount_median_pct == null ? '—' : `${formatPct(total.real_discount_median_pct)}%`} hint={`sub mediana din ${month}`} />
              <Figure label="Magazine incluse" value={total.stores.toLocaleString('ro-RO')} />
            </dl>
          </section>

          {/* Tabelul pe categorii */}
          <section aria-labelledby="pe-categorii" className={`mt-4 ${card}`}>
            <h2 id="pe-categorii" className="text-lg font-extrabold text-ink">Pe categorii, {dayLabel(total.day)}</h2>
            <p className="mt-0.5 text-[12.5px] text-ink-3">
              „Umflate” = reduse după ce prețul urcase cu cel puțin {EVENT_INFLATED_MIN_PCT}% peste mediana din {month}. Doar agregat, pe categorii.
            </p>
            <div className="-mx-4 mt-2 overflow-x-auto px-4 lg:-mx-5 lg:px-5">
              <table className="w-full min-w-[560px] border-collapse text-[13.5px] tabular-nums">
                <thead>
                  <tr className="text-left text-[12px] text-ink-3">
                    <th scope="col" className="py-1.5 pr-3 font-medium">Categorie</th>
                    <th scope="col" className="py-1.5 pr-3 text-right font-medium">Urmărite</th>
                    <th scope="col" className="py-1.5 pr-3 text-right font-medium">Reduse</th>
                    <th scope="col" className="py-1.5 pr-3 text-right font-medium">Reale (din reduse)</th>
                    <th scope="col" className="py-1.5 pr-3 text-right font-medium">Reducere reală mediană</th>
                    <th scope="col" className="py-1.5 text-right font-medium">Umflate (din reduse)</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.category_id} className="border-t border-line">
                      <th scope="row" className={`py-1.5 pr-3 text-left ${r.indent ? 'pl-4 font-normal text-ink-2' : 'font-semibold text-ink'}`}>
                        <Link href={`/c/${r.category_slug}`} className="hover:text-red-ink hover:underline underline-offset-2">{r.category_name}</Link>
                      </th>
                      <td className="py-1.5 pr-3 text-right text-ink-2">{r.tracked.toLocaleString('ro-RO')}</td>
                      <td className="py-1.5 pr-3 text-right text-ink-2">{r.reduse.toLocaleString('ro-RO')}</td>
                      <td className="py-1.5 pr-3 text-right font-semibold text-ink">{pctText(share(r.reduse_reale, r.reduse))}</td>
                      <td className="py-1.5 pr-3 text-right text-ink-2">{r.real_discount_median_pct == null ? '—' : `${formatPct(r.real_discount_median_pct)}%`}</td>
                      <td className="py-1.5 text-right text-ink-2">{pctText(share(r.umflate, r.reduse))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Graficul zilnic */}
          {points.length > 0 && (
            <section aria-labelledby="pe-zile" className={`mt-4 ${card}`}>
              <h2 id="pe-zile" className="text-lg font-extrabold text-ink">Reduceri reale din produsele reduse, pe zile</h2>
              <p className="mt-0.5 text-[12.5px] text-ink-3">Toate categoriile, de la {formatRoDate(event.starts_at)}.</p>
              <RealShareChart points={points} />
            </section>
          )}

          {/* Top reduceri reale pe vertical (cât ține fereastra) */}
          {dealGroups.length > 0 && (
            <section aria-labelledby="top-reale" className="mt-6">
              <h2 id="top-reale" className="text-xl font-extrabold text-ink">Cele mai mari reduceri reale de azi</h2>
              <p className="mt-0.5 max-w-3xl text-[12.5px] text-ink-3">
                Ordonate după reducerea față de mediana din {month}. Insigna de pe fiecare produs compară prețul cu mediana
                obișnuită pe ultimele 30 de zile, care în campanie poate fi deja mai jos.
              </p>
              {dealGroups.map(({ root, items }) => (
                <div key={root.category_id} className="mt-4">
                  <h3 className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 text-base font-extrabold text-ink">
                    {root.category_name}
                    <Link href={`/reduceri-reale/${root.category_slug}`} className="text-[13px] font-semibold text-ink underline underline-offset-2 hover:text-red-ink">
                      Toate reducerile reale din categorie
                    </Link>
                  </h3>
                  <ProductList products={items} />
                </div>
              ))}
            </section>
          )}
        </>
      ) : (
        <section aria-labelledby="incepe" className={card}>
          <h2 id="incepe" className="text-lg font-extrabold text-ink">
            {frozen
              ? `Referința a fost înghețată pe ${freeze}`
              : `Măsurătorile pe referința înghețată încep pe ${freeze}.`}
          </h2>
          <p className="mt-1.5 max-w-3xl text-[14.5px] text-ink-2">
            {frozen
              ? 'Prima măsurătoare apare aici după verificarea zilnică a prețurilor.'
              : <>Până atunci adunăm prețurile din {month}: mediana lor devine referința cu care comparăm fiecare reducere, zilnic, până pe {lastDay}.</>}
          </p>
        </section>
      )}

      {/* Metoda (mereu vizibilă) */}
      <section aria-labelledby="metoda" className={`mt-4 ${card}`}>
        <h2 id="metoda" className="text-lg font-extrabold text-ink">Cum măsurăm</h2>
        <dl className="mt-2 grid gap-3 text-[14px] text-ink-2 sm:grid-cols-3">
          <div>
            <dt className="font-bold text-ink">Referința</dt>
            <dd className="mt-0.5">Mediana prețurilor fiecărui produs din cele {EVENT_REFERENCE_DAYS} de zile dinaintea lui {freeze}, înghețată atunci și neschimbată până la final.</dd>
          </div>
          <div>
            <dt className="font-bold text-ink">Reducere reală</dt>
            <dd className="mt-0.5">Prețul de azi e cu cel puțin {EVENT_REAL_PCT}% sub referință.</dd>
          </div>
          <div>
            <dt className="font-bold text-ink">Reducere umflată</dt>
            <dd className="mt-0.5">Produsul e redus (cel puțin {EVENT_REDUCED_MIN_PCT}% sub maximul lui din ultimele {EVENT_LOOKBACK_DAYS} zile), dar prețul urcase înainte cu cel puțin {EVENT_INFLATED_MIN_PCT}% peste referință, iar azi nu e cu cel puțin {EVENT_REAL_PCT}% sub ea.</dd>
          </div>
        </dl>
        <p className="mt-3 text-[13px] text-ink-3">
          Intră în calcul doar ofertele disponibile acum (în stoc, confirmate în ultimele 3 zile).{' '}
          <Link href="/ghiduri/metodologie" className={link}>Metodologia completă</Link>
        </p>
      </section>

      {/* Înainte de îngheț: reducerile reale de azi, regula obișnuită */}
      {!hasData && todayRoots.length > 0 && (
        <section aria-labelledby="azi" className="mt-6">
          <h2 id="azi" className="text-xl font-extrabold text-ink">Reduceri reale azi</h2>
          <MethodNote className="mt-2 max-w-3xl" />
          <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {landing.map((c) => {
              const k = counts[c.slug] ?? 0
              return (
                <li key={c.slug}>
                  <Link
                    href={`/reduceri-reale/${c.slug}`}
                    className="flex min-h-11 items-center justify-between gap-3 rounded-[10px] bg-surface px-3 py-2 ring-1 ring-inset ring-line-2 transition-shadow hover:ring-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
                  >
                    <span className={`text-sm text-ink ${c.parent_slug ? '' : 'font-bold'}`}>{c.name}</span>
                    <span className={`whitespace-nowrap text-xs tabular-nums ${k > 0 ? 'font-bold text-red-ink' : 'text-ink-3'}`}>
                      {k > 0 ? roCount(k, 'reduceri reale', 'reducere reală') : 'niciuna acum'}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {/* FAQ (aceleași texte și în FAQPage) */}
      <section aria-labelledby="intrebari" className="mt-6">
        <h2 id="intrebari" className="text-xl font-extrabold text-ink">Întrebări frecvente</h2>
        <div className="mt-2 space-y-3">
          {faq.map((f) => (
            <div key={f.q} className={card}>
              <h3 className="text-[15px] font-bold text-ink">{f.q}</h3>
              <p className="mt-1 text-[14px] text-ink-2">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      <p className="mt-6 flex flex-wrap gap-x-5 gap-y-1 text-sm">
        <Link href="/reduceri-reale" className={link}>Reduceri reale pe categorii</Link>
        <Link href="/ghiduri" className={link}>Ghiduri de cumpărare</Link>
        <Link href="/ghiduri/metodologie" className={link}>Metodologia</Link>
      </p>
    </>
  )
}
