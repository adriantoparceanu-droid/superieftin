import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getEditionRows, getPublishedEditions, getTimingEligible, type IndexRowView } from '@/lib/observator/queries'
import {
  MIN_INDEX_BASKET, cheapestText, datasetLd, editionFact, editionTitle, faqPageLd, groupIndexRows, monthLabel,
  monthSlug, parseMonthParam, plainPct, previousMonthOf, signedPct, changeVerb, type Edition,
} from '@/lib/observator/observator'
import { breadcrumbLd } from '@/lib/seo/jsonld'
import { withOg } from '@/lib/seo/og'
import { absUrl, lowerFirst, roCount } from '@/lib/seo/site'
import { ListingHeader } from '@/components/listing/ListingParts'
import { Badge, CARD, FactLead, Faq, H2, JsonLd, LINK, ObservatorLinks, Stat } from '@/components/observator/ObservatorParts'

// /indice/2026-09 — o ediție lunară a indicelui (imutabilă: workerul nu rescrie o ediție publicată).
// Lună în alt format sau nepublicată → 404. ISR: regenerată cel mult o dată pe oră.
export const revalidate = 3600
export const dynamicParams = true

// Nimic la build (DB-ul nu e accesibil atunci); fiecare ediție se randează la prima vizită
export async function generateStaticParams() {
  return []
}

type Props = { params: Promise<{ luna: string }> }

async function loadEdition(luna: string): Promise<{ edition: Edition; all: Edition[] } | null> {
  const month = parseMonthParam(luna)
  if (!month) return null
  // Fără .catch: o eroare de DB trebuie să rămână eroare (ISR păstrează pagina veche), nu să
  // devină un 404 pus în cache pentru o oră
  const all = await getPublishedEditions()
  const edition = all.find((e) => e.month === month)
  return edition ? { edition, all } : null
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { luna } = await params
  const found = await loadEdition(luna)
  if (!found) return { title: 'Ediție negăsită' }
  const { edition } = found
  const title = editionTitle(edition.month)
  const description =
    `${monthLabel(edition.month)}: variația mediană a prețurilor pe un coș stabil de ${roCount(edition.basket_size, 'produse', 'produs')}, ` +
    `pe categorii, cu cele mai mari scăderi și numărul de reduceri reale. Indicele lunar superieftin.ro.`
  const path = `/indice/${monthSlug(edition.month)}`
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: withOg({ title, description, url: absUrl(path), type: 'article' }),
  }
}

function RowCells({ r, timing, child }: { r: IndexRowView; timing: Set<string>; child?: boolean }) {
  const name = r.linkable
    ? <Link href={`/c/${r.category_slug}`} className="font-semibold text-ink hover:text-red-ink hover:underline underline-offset-2">{r.category_name}</Link>
    : <span className="font-semibold text-ink">{r.category_name}</span>
  return (
    <tr className="border-b border-line last:border-0 align-top">
      <td className={`py-2 pr-3 ${child ? 'pl-4' : ''}`}>
        {name}
        {timing.has(r.category_slug) && (
          <Link href={`/cand-sa-cumperi/${r.category_slug}`} className="block text-xs text-ink-3 underline underline-offset-2 hover:text-red-ink">când să cumperi</Link>
        )}
      </td>
      <td className="py-2 pr-3 text-right tabular-nums font-semibold">{signedPct(r.median_change_pct)}</td>
      <td className="py-2 pr-3 text-right tabular-nums">{plainPct(r.share_down_pct, 0)}</td>
      <td className="py-2 pr-3 text-right tabular-nums">{r.basket_size.toLocaleString('ro-RO')}</td>
      <td className="py-2 text-right tabular-nums">{r.real_discounts.toLocaleString('ro-RO')}</td>
    </tr>
  )
}

export default async function EditionPage({ params }: Props) {
  const { luna } = await params
  const found = await loadEdition(luna)
  if (!found) notFound()
  const { edition, all } = found
  const [rows, timingCats] = await Promise.all([
    getEditionRows(edition.month).catch(() => [] as IndexRowView[]),
    getTimingEligible().catch(() => []),
  ])
  const timing = new Set(timingCats.map((c) => c.slug))
  const groups = groupIndexRows(rows)
  const leaves = groups.flatMap((g) => (g.children.length ? g.children : [g.root]))

  const idx = all.findIndex((e) => e.month === edition.month)
  const newer = idx > 0 ? all[idx - 1] : null
  const older = idx < all.length - 1 ? all[idx + 1] : null

  const label = monthLabel(edition.month)
  const prevLabel = monthLabel(previousMonthOf(edition.month))
  const path = `/indice/${monthSlug(edition.month)}`

  // Întrebările frecvente ale ediției: răspunsuri din cifrele ei (citabile, datate prin luna din întrebare)
  const ranked = [...leaves].filter((r) => r.median_change_pct != null).sort((a, b) => a.median_change_pct! - b.median_change_pct!)
  const lowest = ranked[0]
  const highest = ranked[ranked.length - 1]
  const faq = [
    { q: `Cu cât s-au schimbat prețurile online în ${label}?`, a: editionFact(edition) },
    ...(lowest ? [{
      q: `Cum au evoluat prețurile pe categorii în ${label}?`,
      a: `Dintre cele ${roCount(leaves.length, 'categorii', 'categorie')} incluse, la ${lowerFirst(lowest.category_name)} prețul tipic ${changeVerb(lowest.median_change_pct)} față de ${prevLabel}` +
        (highest && highest !== lowest ? `, iar la ${lowerFirst(highest.category_name)} ${changeVerb(highest.median_change_pct)}.` : '.'),
    }] : []),
    {
      q: 'Ce produse intră în calcul?',
      a: `Doar produsele cu preț în stoc atât în ${prevLabel}, cât și în ${label} (coșul stabil), din categoriile cu cel puțin ${MIN_INDEX_BASKET} de astfel de produse. Sănătate & Naturale și farmacia veterinară nu sunt incluse.`,
    },
  ]

  const crumbs = [{ name: 'Acasă', path: '/' }, { name: 'Indicele prețurilor', path: '/indice' }, { name: label, path }]
  const dataset = datasetLd({
    name: `Indicele prețurilor superieftin.ro — ${label}`,
    description: `Variația prețului tipic pe categorii între ${prevLabel} și ${label}, pe un coș stabil de ${roCount(edition.basket_size, 'produse', 'produs')}.`,
    path,
    dateModified: edition.computed_at,
    temporalCoverage: `${monthSlug(previousMonthOf(edition.month))}/${monthSlug(edition.month)}`,
    variableMeasured: ['variația mediană a prețului pe produs (%)', 'procentul produselor mai ieftine decât luna anterioară', 'produse cu reducere reală în lună'],
  })

  return (
    <>
      <JsonLd data={breadcrumbLd(crumbs)} />
      <JsonLd data={dataset} />
      <JsonLd data={faqPageLd(faq)} />

      <ListingHeader
        crumbs={[{ label: 'Acasă', href: '/' }, { label: 'Indicele prețurilor', href: '/indice' }, { label }]}
        title={editionTitle(edition.month)}
      >
        {edition.retroactive && <Badge>calculat retroactiv, din istoricul de prețuri</Badge>}
      </ListingHeader>

      <FactLead>{editionFact(edition)}</FactLead>

      {edition.correction_note && (
        <p className="mb-4 max-w-3xl rounded-xl bg-amber-tint px-4 py-3 text-sm text-ink">
          <strong className="text-amber-ink">Notă de corecție:</strong> {edition.correction_note}
        </p>
      )}

      <section className={CARD}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat value={signedPct(edition.median_change_pct)} label={`variația mediană față de ${prevLabel}`} />
          <Stat value={edition.basket_size.toLocaleString('ro-RO')} label="produse în coșul stabil" />
          <Stat value={edition.retailers.toLocaleString('ro-RO')} label="magazine în calcul" />
          <Stat value={edition.real_discounts.toLocaleString('ro-RO')} label="produse cu cel puțin o zi de reducere reală" />
        </div>
      </section>

      <section className={`mt-4 ${CARD}`}>
        <h2 className={H2}>Pe categorii</h2>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-3">
                <th className="py-2 pr-3 font-semibold">Categoria</th>
                <th className="py-2 pr-3 font-semibold text-right">Variația mediană</th>
                <th className="py-2 pr-3 font-semibold text-right">Mai ieftine</th>
                <th className="py-2 pr-3 font-semibold text-right">Coș</th>
                <th className="py-2 font-semibold text-right">Cu reducere reală</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <RowGroup key={g.root.category_slug} root={g.root} childRows={g.children} timing={timing} />
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-ink-3">
          „Mai ieftine” = procentul produselor din coș cu preț lunar mai mic decât în {prevLabel}. „Cu reducere reală” =
          produse cu cel puțin o zi în {label} cu prețul cu minimum 5% sub mediana lor pe 30 de zile.
        </p>
      </section>

      {leaves.some((r) => r.top_drops.length || cheapestText(r)) && (
        <section className={`mt-4 ${CARD}`}>
          <h2 className={H2}>Cele mai mari scăderi din coș</h2>
          <p className="mt-1 text-sm text-ink-3">
            Variația prețului lunar față de {prevLabel}. Prețul de azi poate fi altul — îl vezi pe pagina produsului.
          </p>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            {leaves.map((r) => (r.top_drops.length || cheapestText(r)) ? (
              <div key={r.category_slug}>
                <h3 className="text-[15px] font-bold text-ink">{r.category_name}</h3>
                {r.top_drops.length > 0 && (
                  <ol className="mt-1 space-y-1 text-sm">
                    {r.top_drops.map((d) => {
                      const slug = r.live_slugs[String(d.product_id)]
                      return (
                        <li key={d.product_id} className="flex items-baseline justify-between gap-3">
                          {slug
                            ? <Link href={`/p/${slug}`} className="min-w-0 truncate text-ink-2 hover:text-red-ink hover:underline underline-offset-2">{d.name}</Link>
                            : <span className="min-w-0 truncate text-ink-3">{d.name}</span>}
                          <span className="shrink-0 font-semibold tabular-nums text-ink">{signedPct(d.pct)}</span>
                        </li>
                      )
                    })}
                  </ol>
                )}
                {cheapestText(r) && <p className="mt-1.5 text-xs text-ink-3">{cheapestText(r)}.</p>}
              </div>
            ) : null)}
          </div>
        </section>
      )}

      <nav aria-label="Alte ediții" className="mt-4 flex flex-wrap justify-between gap-3 text-sm">
        {older ? <Link href={`/indice/${monthSlug(older.month)}`} className={LINK}>← {monthLabel(older.month)}</Link> : <span />}
        <Link href="/indice" className={LINK}>Toate edițiile</Link>
        {newer ? <Link href={`/indice/${monthSlug(newer.month)}`} className={LINK}>{monthLabel(newer.month)} →</Link> : <span />}
      </nav>

      <Faq items={faq} />
      <ObservatorLinks current="indice" />
    </>
  )
}

function RowGroup({ root, childRows, timing }: { root: IndexRowView; childRows: IndexRowView[]; timing: Set<string> }) {
  return (
    <>
      <RowCells r={root} timing={timing} />
      {childRows.map((c) => <RowCells key={c.category_slug} r={c} timing={timing} child />)}
    </>
  )
}
