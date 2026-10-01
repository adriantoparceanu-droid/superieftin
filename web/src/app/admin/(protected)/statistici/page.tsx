import Link from 'next/link'
import {
  parsePeriod, PERIODS, getGa4SyncState, hasGa4Data, getGa4Overview, getGa4Series, getGa4Breakdown,
  getProductLabels, getCategoryLabels, getRetailerClicks, getOrganicKeywords, getAdsSearchTerms,
  type Ga4SyncState, type BreakdownRow, type BreakdownKind, type RetailerClicksRow,
} from '@/lib/admin/ga4-stats'
import { refreshGa4StatsAction } from '@/lib/admin/actions'
import { Ga4Chart } from './Ga4Chart'
import { RefreshButton } from './RefreshButton'

// Trafic general din Google Analytics 4, salvat zilnic de worker (job `ga4-sync`) in Postgres.
// Pagina e dinamica (layout-ul protejat citeste cookies() → fiecare incarcare citeste din DB),
// fara unstable_cache: datele se schimba o data pe zi si interogarile sunt mici.
// Design: docs/plans/2026-09-28-admin-statistici-ga4-design.md

type Props = { searchParams: Promise<{ zile?: string | string[] }> }

// ---------- Formatare ----------

const int = (n: number) => n.toLocaleString('ro-RO')

// raport 0..1 → „12,3%”; fara numitor → „—”
function pct(num: number, den: number, digits = 1): string {
  if (!den) return '—'
  return `${((num / den) * 100).toLocaleString('ro-RO', { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`
}

// „2026-09-27” → „27 sept. 2026” (UTC, ca sa nu se mute ziua cu fusul orar al serverului)
function fmtDay(day: string, withYear = false): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString('ro-RO', {
    day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}), timeZone: 'UTC',
  })
}

// Momentele (timestamptz) le afisam mereu in ora Romaniei — containerul de pe VPS e UTC.
function fmtMoment(d: Date): string {
  return new Intl.DateTimeFormat('ro-RO', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Bucharest',
  }).format(d)
}

// ---------- Variatia fata de perioada anterioara ----------

// ▲ / ▼ procentual. „—” cand perioada anterioara nu are date (sau e 0): o crestere „de la zero”
// nu are procent si ar induce in eroare.
function Delta({ cur, prev, hasPrev }: { cur: number; prev: number; hasPrev: boolean }) {
  if (!hasPrev || !prev) {
    return <span className="text-xs text-muted" title="Fără date în perioada anterioară">—</span>
  }
  const change = ((cur - prev) / prev) * 100
  const rounded = Math.round(change * 10) / 10
  if (rounded === 0) return <span className="text-xs text-muted">= față de perioada anterioară</span>
  const up = rounded > 0
  return (
    <span className={`text-xs font-semibold ${up ? 'text-success' : 'text-red-700'}`} title="Față de perioada anterioară de aceeași lungime">
      {up ? '▲' : '▼'} {Math.abs(rounded).toLocaleString('ro-RO')}%
    </span>
  )
}

function Card({ label, value, delta, note, title }: {
  label: string; value: string; delta: React.ReactNode; note?: React.ReactNode; title?: string
}) {
  return (
    <div className="bg-white border border-line rounded-xl p-4" title={title}>
      <p className="text-sm text-muted">{label}</p>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-2">{delta}</div>
      {note && <p className="text-xs text-muted mt-1">{note}</p>}
    </div>
  )
}

// ---------- Tabele ----------

interface Column<R> { label: string; right?: boolean; render: (r: R) => React.ReactNode }

// Tabel generic in stilul adminului. Randul „restul” (key = null) apare ultimul, estompat.
function StatTable<R>({ title, columns, rows, isRest, empty, note, footer }: {
  title: string
  columns: Column<R>[]
  rows: R[]
  isRest?: (r: R) => boolean
  empty: string
  note?: React.ReactNode
  footer?: React.ReactNode[]   // rand de totaluri, cate o celula pe coloana (doar daca exista randuri)
}) {
  return (
    <section>
      <h2 className="text-lg font-semibold mb-3">{title}</h2>
      <div className="bg-white border border-line rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left text-muted">
            <tr>
              {columns.map((c) => (
                <th key={c.label} className={`px-4 py-2 ${c.right ? 'text-right' : ''}`}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className={`border-t border-line ${isRest?.(r) ? 'text-muted italic' : ''}`}>
                {columns.map((c) => (
                  <td key={c.label} className={`px-4 py-2 ${c.right ? 'text-right tabular-nums whitespace-nowrap' : ''}`}>
                    {c.render(r)}
                  </td>
                ))}
              </tr>
            ))}
            {!rows.length && (
              <tr><td colSpan={columns.length} className="px-4 py-6 text-center text-muted">{empty}</td></tr>
            )}
          </tbody>
          {footer && rows.length > 0 && (
            <tfoot className="bg-surface font-semibold">
              <tr className="border-t border-line">
                {footer.map((cell, i) => (
                  <td key={i} className={`px-4 py-2 ${columns[i]?.right ? 'text-right tabular-nums whitespace-nowrap' : ''}`}>{cell}</td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {note && <p className="text-xs text-muted mt-2">{note}</p>}
    </section>
  )
}

// Numele parametrului GA4 din spatele fiecarei defalcari personalizate (pentru mesajul de lipsa)
const CUSTOM_DIMENSION: Partial<Record<BreakdownKind, string>> = {
  retailer: 'merchant_name',
  product: 'product_id',
  category: 'category',
}

// Mesajul pentru un tabel gol: daca workerul a raportat ca dimensiunea lipseste din GA4, spunem
// exact asta (altfel pare o eroare a paginii).
function emptyMessage(kind: BreakdownKind, warnings: string[]): string {
  const dim = CUSTOM_DIMENSION[kind]
  if (dim && warnings.some((w) => w.includes(`„${kind}”`))) {
    return `Nu există date — dimensiunea „${dim}” nu e înregistrată în GA4 (Admin → Definiții personalizate).`
  }
  return 'Nu există date pentru perioada aleasă.'
}

// Eticheta randului „restul”
function restLabel(r: BreakdownRow): string {
  return `Restul (${int(r.rest_count)})`
}

// Cale de pagina (landing / pagePath) → link spre site, ca sa o poti deschide direct
function PathCell({ path }: { path: string }) {
  if (!path.startsWith('/')) return <span className="text-muted">{path}</span>
  return (
    <a href={path} target="_blank" rel="noreferrer" className="font-mono text-xs hover:text-brand break-all">
      {path}
    </a>
  )
}

// „12,5 lei” — costurile din Google Ads, cu 2 zecimale
const lei = (n: number) => `${n.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} lei`

// Search Console da URL-ul complet (https://www.superieftin.ro/p/...) → pastram doar calea
function toPath(url: string): string {
  try {
    const u = new URL(url)
    return `${u.pathname}${u.search}`
  } catch {
    return url
  }
}

const DEVICE_LABEL: Record<string, string> = {
  mobile: 'Mobil',
  desktop: 'Desktop',
  tablet: 'Tabletă',
  'smart tv': 'Smart TV',
}

// ---------- Stare neconfigurata ----------

function SetupSteps({ state }: { state: Ga4SyncState | null }) {
  return (
    <div className="bg-white border border-line rounded-xl p-6 text-sm space-y-4">
      <p>
        Nu există încă date din Google Analytics. Workerul le aduce zilnic, după ce configurezi accesul (o singură dată):
      </p>
      <ol className="list-decimal pl-5 space-y-2">
        <li>
          <strong>Google Cloud</strong> (proiectul existent): activează <em>Google Analytics Data API</em>, creează un
          <em> cont de serviciu</em> și descarcă o <em>cheie JSON</em> pentru el.
        </li>
        <li>
          <strong>GA4</strong> → Admin → Gestionarea accesului la proprietate: adaugă adresa de email a contului de
          serviciu cu rolul <em>Viewer</em> (doar citire).
        </li>
        <li>
          <strong><code>.env</code></strong> (la rădăcina proiectului): <code>GA4_PROPERTY_ID</code> (ID-ul numeric al
          proprietății) și <code>GA4_SERVICE_ACCOUNT_JSON</code> (conținutul cheii JSON). Apoi repornește workerul.
        </li>
        <li>
          <strong>Test</strong>: <code>cd worker &amp;&amp; npm run ga4:check</code> (verifică doar conexiunea), apoi{' '}
          <code>npm run ga4:sync:now</code> (prima rulare aduce ultimele 90 de zile).
        </li>
      </ol>
      <p className="text-muted">
        Ghid detaliat pentru setările din GA4: <code>docs/ads-program/ghid-setari-ga4.md</code>.
      </p>
      {state?.last_error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">
          <strong>Ultima încercare a eșuat</strong>
          {state.last_error_at && <> ({fmtMoment(state.last_error_at)})</>}: {state.last_error}
        </div>
      )}
      <form action={refreshGa4StatsAction} className="flex items-center gap-3">
        <RefreshButton />
        <span className="text-xs text-muted">Workerul trebuie să ruleze; rezultatul apare după ~1 minut (reîncarcă pagina).</span>
      </form>
    </div>
  )
}

// ---------- Pagina ----------

export default async function StatisticiPage({ searchParams }: Props) {
  const days = parsePeriod((await searchParams).zile)
  const [state, hasData] = await Promise.all([getGa4SyncState(), hasGa4Data()])
  const warnings = state?.warnings ?? []

  const header = (
    <>
      <h1 className="text-2xl font-bold mb-2">Statistici</h1>
      <p className="text-sm text-muted mb-6">
        Traficul site-ului din Google Analytics 4, adus zilnic de worker, lângă clickurile reale din baza noastră de date.
      </p>
    </>
  )

  if (!hasData && !state?.last_success_at) {
    return (
      <div className="max-w-3xl">
        {header}
        <SetupSteps state={state} />
      </div>
    )
  }

  const [overview, series, sources, landings, pages, devices, products, categories, retailers, organic, adsTerms] = await Promise.all([
    getGa4Overview(days),
    getGa4Series(days),
    getGa4Breakdown('source', days),
    getGa4Breakdown('landing', days),
    getGa4Breakdown('page', days),
    getGa4Breakdown('device', days),
    getGa4Breakdown('product', days),
    getGa4Breakdown('category', days),
    getRetailerClicks(days),
    getOrganicKeywords(days),
    getAdsSearchTerms(days),
  ])
  const [productLabels, categoryLabels] = await Promise.all([
    getProductLabels(products.rows.map((r) => r.key)),
    getCategoryLabels(categories.rows.map((r) => r.key)),
  ])

  const cur = overview.current
  const prev = overview.previous
  const hasPrev = prev.days_with_data > 0
  const lastError = state?.last_error_at && (!state.last_success_at || state.last_error_at > state.last_success_at)
  const isRest = (r: BreakdownRow) => r.key === null

  // Magazine: top 10 + „restul” (sume). Randurile fara pereche raman vizibile cu „—”, nu inventam.
  const topRetailers = retailers.slice(0, 10)
  const restRetailers = retailers.slice(10)
  const retailerRows: (RetailerClicksRow & { rest?: number })[] = restRetailers.length
    ? [...topRetailers, {
        name: `Restul (${restRetailers.length})`,
        ga4: restRetailers.reduce((s, r) => s + (r.ga4 ?? 0), 0),
        db: restRetailers.reduce((s, r) => s + (r.db ?? 0), 0),
        rest: restRetailers.length,
      }]
    : topRetailers
  const retailerDimMissing = warnings.some((w) => w.includes('„retailer”'))
  const unmatchedGa4 = retailers.filter((r) => r.db === null).length
  // Avertismentele workerului pentru cuvinte cheie (prefixele din ga4-sync)
  const gscWarnings = warnings.filter((w) => w.startsWith('Search Console'))
  const adsWarnings = warnings.filter((w) => w.startsWith('Google Ads'))

  return (
    <div className="max-w-6xl">
      {header}

      {/* Selectorul de perioada: linkuri simple cu ?zile=, fara JavaScript */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="inline-flex rounded-lg border border-line bg-white p-1">
          {PERIODS.map((p) => (
            <Link
              key={p}
              href={`/admin/statistici?zile=${p}`}
              className={`px-3 py-1 rounded-md text-sm ${p === days ? 'bg-brand text-white font-semibold' : 'hover:bg-surface'}`}
            >
              {p} zile
            </Link>
          ))}
        </div>
        <span className="text-sm text-muted">
          {fmtDay(overview.start)} – {fmtDay(overview.end, true)} (până ieri inclusiv)
          {cur.days_with_data < days && <> · date GA4 pentru {cur.days_with_data} din {days} zile</>}
        </span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <Card
          label="Utilizatori"
          title="Suma utilizatorilor zilnici: cine revine în mai multe zile e numărat o dată pe zi (GA4 nu deduplică între zile)."
          value={int(cur.users)}
          delta={<><Delta cur={cur.users} prev={prev.users} hasPrev={hasPrev} /><span className="text-xs text-muted">{pct(cur.new_users, cur.users, 0)} noi</span></>}
          note="suma utilizatorilor zilnici"
        />
        <Card label="Sesiuni" value={int(cur.sessions)} delta={<Delta cur={cur.sessions} prev={prev.sessions} hasPrev={hasPrev} />} />
        <Card label="Afișări de pagină" value={int(cur.page_views)} delta={<Delta cur={cur.page_views} prev={prev.page_views} hasPrev={hasPrev} />} />
        <Card
          label="Clickuri spre magazine (GA4)"
          value={int(cur.affiliate_clicks)}
          delta={<Delta cur={cur.affiliate_clicks} prev={prev.affiliate_clicks} hasPrev={hasPrev} />}
          note="doar vizitatorii care au acceptat cookie-urile de analiză"
        />
        <Card
          label="Clickuri reale (DB)"
          value={int(cur.db_clicks)}
          delta={<Delta cur={cur.db_clicks} prev={prev.db_clicks} hasPrev={prev.db_clicks > 0} />}
          note={cur.db_clicks > 0 ? <>GA4 vede ~{pct(cur.affiliate_clicks, cur.db_clicks, 0)} din ele</> : 'clickurile clienților spre magazine, din baza noastră (fără admin și roboți)'}
        />
        <Card
          label="Rată de click"
          title="Clickuri spre magazine (GA4) împărțit la sesiuni (GA4): din câte vizite pleacă cineva spre un magazin."
          value={pct(cur.affiliate_clicks, cur.sessions)}
          delta={
            <Delta
              cur={cur.sessions ? cur.affiliate_clicks / cur.sessions : 0}
              prev={prev.sessions ? prev.affiliate_clicks / prev.sessions : 0}
              hasPrev={hasPrev}
            />
          }
          note="clickuri spre magazine / sesiuni"
        />
      </div>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">Pe zile</h2>
        <div className="bg-white border border-line rounded-xl p-4">
          <Ga4Chart data={series} />
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <StatTable
          title="Surse de trafic"
          rows={sources.rows}
          isRest={isRest}
          empty={emptyMessage('source', warnings)}
          columns={[
            { label: 'Sursă / mediu', render: (r) => (r.key === null ? restLabel(r) : r.key) },
            { label: 'Sesiuni', right: true, render: (r) => int(r.sessions) },
            { label: 'Clickuri', right: true, render: (r) => int(r.affiliate_clicks) },
            { label: 'Rată de click', right: true, render: (r) => pct(r.affiliate_clicks, r.sessions) },
          ]}
        />

        <StatTable
          title="Dispozitive"
          rows={devices.rows}
          isRest={isRest}
          empty={emptyMessage('device', warnings)}
          columns={[
            { label: 'Dispozitiv', render: (r) => (r.key === null ? restLabel(r) : DEVICE_LABEL[r.key] ?? r.key) },
            { label: 'Sesiuni', right: true, render: (r) => int(r.sessions) },
            { label: '% din sesiuni', right: true, render: (r) => pct(r.sessions, devices.total.sessions) },
          ]}
        />

        <StatTable
          title="Pagini de intrare"
          rows={landings.rows}
          isRest={isRest}
          empty={emptyMessage('landing', warnings)}
          note="Prima pagină văzută într-o vizită. Rata de click mică pe o pagină cu multe sesiuni = pagină de îmbunătățit."
          columns={[
            { label: 'Pagină', render: (r) => (r.key === null ? restLabel(r) : <PathCell path={r.key} />) },
            { label: 'Sesiuni', right: true, render: (r) => int(r.sessions) },
            { label: 'Rată de click', right: true, render: (r) => pct(r.affiliate_clicks, r.sessions) },
          ]}
        />

        <StatTable
          title="Pagini vizitate"
          rows={pages.rows}
          isRest={isRest}
          empty={emptyMessage('page', warnings)}
          columns={[
            { label: 'Pagină', render: (r) => (r.key === null ? restLabel(r) : <PathCell path={r.key} />) },
            { label: 'Afișări', right: true, render: (r) => int(r.page_views) },
          ]}
        />

        <StatTable
          title="Magazine"
          rows={retailerRows}
          isRest={(r) => r.rest !== undefined}
          empty="Niciun click spre magazine în perioada aleasă."
          note={
            <>
              „Reale” = clickurile clienților din baza noastră (fără admin, roboți și cele spre oferte șterse între timp).
              {unmatchedGa4 > 0 && <> {unmatchedGa4} {unmatchedGa4 === 1 ? 'nume din GA4 nu se potrivește' : 'nume din GA4 nu se potrivesc'} cu niciun magazin din baza de date (coloana „reale” = —).</>}
              {retailerDimMissing && <> Coloana GA4 lipsește: dimensiunea „merchant_name” nu e înregistrată în GA4 (Admin → Definiții personalizate).</>}
            </>
          }
          columns={[
            { label: 'Magazin', render: (r) => r.name },
            { label: 'Clickuri GA4', right: true, render: (r) => (r.ga4 === null ? <span className="text-muted" title="Nu apare în GA4">—</span> : int(r.ga4)) },
            { label: 'Clickuri reale (DB)', right: true, render: (r) => (r.db === null ? <span className="text-muted" title="Numele din GA4 nu se potrivește cu niciun magazin din baza de date">—</span> : int(r.db)) },
            { label: 'GA4 vede', right: true, render: (r) => (r.ga4 !== null && r.db ? pct(r.ga4, r.db, 0) : '—') },
          ]}
        />

        <StatTable
          title="Categorii"
          rows={categories.rows}
          isRest={isRest}
          empty={emptyMessage('category', warnings)}
          columns={[
            {
              label: 'Categorie',
              render: (r) => {
                if (r.key === null) return restLabel(r)
                const name = categoryLabels.get(r.key)
                return name
                  ? <Link href={`/c/${r.key}`} target="_blank" className="hover:text-brand">{name}</Link>
                  : <span className="text-muted">{r.key}</span>
              },
            },
            { label: 'Clickuri spre magazine', right: true, render: (r) => int(r.affiliate_clicks) },
          ]}
        />
      </div>

      <div className="mb-8">
        <StatTable
          title="Produse"
          rows={products.rows}
          isRest={isRest}
          empty={emptyMessage('product', warnings)}
          columns={[
            {
              label: 'Produs',
              render: (r) => {
                if (r.key === null) return restLabel(r)
                const p = productLabels.get(r.key)
                if (p) return <Link href={`/p/${p.slug}`} target="_blank" className="hover:text-brand line-clamp-1">{p.name}</Link>
                // cheie numerica fara produs = produs sters din DB; altfel valoarea bruta din GA4
                return <span className="text-muted">{/^\d+$/.test(r.key) ? `#${r.key} (produs șters)` : r.key}</span>
              },
            },
            { label: 'Clickuri spre magazine', right: true, render: (r) => int(r.affiliate_clicks) },
          ]}
        />
      </div>

      {/* Cuvinte cheie: GA4 nu le da prin API, vin direct din Search Console si Google Ads */}
      <h2 className="text-xl font-bold mb-1">Cuvinte cheie</h2>
      <p className="text-sm text-muted mb-4">Ce caută oamenii în Google când ajung la noi — gratuit (organic) și prin reclame.</p>
      <div className="space-y-8 mb-8">
        <StatTable
          title="Organic (Google Search Console)"
          rows={organic.rows}
          empty={gscWarnings.length ? `Nu există date — ${gscWarnings[0]}` : 'Nu există căutări organice în perioada aleasă.'}
          footer={['Total perioadă', int(organic.total_clicks), int(organic.total_impressions), pct(organic.total_clicks, organic.total_impressions), '', '']}
          note={
            <>
              Google ascunde căutările foarte rare, deci totalurile sunt mai mici decât în Search Console. Poziția 1 = primul rezultat.
              {' '}Search Console are 2–3 zile întârziere
              {organic.last_day && organic.last_day < overview.end ? <>: ultima zi cu date este {fmtDay(organic.last_day, true)}.</> : '.'}
            </>
          }
          columns={[
            { label: 'Căutarea', render: (r) => r.query },
            { label: 'Clickuri', right: true, render: (r) => int(r.clicks) },
            { label: 'Afișări', right: true, render: (r) => int(r.impressions) },
            { label: 'CTR', right: true, render: (r) => pct(r.clicks, r.impressions) },
            {
              label: 'Poziția medie', right: true,
              render: (r) => (r.position === null ? '—' : r.position.toLocaleString('ro-RO', { minimumFractionDigits: 1, maximumFractionDigits: 1 })),
            },
            { label: 'Pagina principală', render: (r) => <PathCell path={toPath(r.page)} /> },
          ]}
        />

        <StatTable
          title="Reclame (Google Ads)"
          rows={adsTerms.rows}
          empty={
            adsWarnings.length
              ? `Nu există date — ${adsWarnings[0]}`
              : 'Încă nu există termeni — apar după primele afișări ale reclamelor (datele de ieri, aduse la 06:15).'
          }
          footer={['Total perioadă', '', int(adsTerms.total_clicks), int(adsTerms.total_impressions), lei(adsTerms.total_cost),
            adsTerms.total_clicks ? lei(adsTerms.total_cost / adsTerms.total_clicks) : '—']}
          note={adsTerms.rows.length > 0 && '⚠ = termenul apare deja organic în primele 3 poziții: poate plătim pentru un click pe care l-am fi primit oricum.'}
          columns={[
            {
              label: 'Termenul căutat',
              render: (r) => (
                <>
                  {r.search_term}
                  {r.organic_position !== null && (
                    <span
                      className="ml-1 text-amber-600 cursor-help"
                      title={`apare deja organic pe poziția ~${r.organic_position.toLocaleString('ro-RO')}`}
                    >⚠</span>
                  )}
                </>
              ),
            },
            { label: 'Campania', render: (r) => <span className="text-xs">{r.campaign}</span> },
            { label: 'Clickuri', right: true, render: (r) => int(r.clicks) },
            { label: 'Afișări', right: true, render: (r) => int(r.impressions) },
            { label: 'Cost', right: true, render: (r) => lei(r.cost) },
            { label: 'CPC mediu', right: true, render: (r) => (r.clicks ? lei(r.cost / r.clicks) : '—') },
          ]}
        />
      </div>

      {/* Subsol: de unde vin cifrele, cand s-au actualizat, problemele ultimei rulari */}
      <footer className="border-t border-line pt-4 text-sm space-y-3">
        <p className="text-muted">
          GA4 numără doar vizitatorii care au acceptat cookie-urile de analiză. Clickurile reale vin din baza noastră de
          date și sunt complete (toți clienții; fără clickurile din browserul de admin și ale roboților). Tabelele păstrează doar primele 50 de rânduri pe zi pentru fiecare tip, deci „restul” nu
          e tot traficul.
        </p>
        <p>
          Actualizat ultima dată:{' '}
          <strong>{state?.last_success_at ? fmtMoment(state.last_success_at) : '—'}</strong>
          <span className="text-muted"> (automat în fiecare dimineață; datele sunt până ieri)</span>
        </p>
        {lastError && state?.last_error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-900">
            <strong>Ultima actualizare a eșuat</strong>
            {state.last_error_at && <> ({fmtMoment(state.last_error_at)})</>}
            {state.consecutive_failures > 1 && <>, de {state.consecutive_failures} ori la rând</>}: {state.last_error}
          </div>
        )}
        {warnings.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">
            <strong>Avertismente la ultima rulare:</strong>
            <ul className="mt-1 list-disc pl-5">
              {warnings.map((w) => <li key={w}>{w}</li>)}
            </ul>
          </div>
        )}
        <form action={refreshGa4StatsAction} className="flex flex-wrap items-center gap-3">
          <RefreshButton />
          <span className="text-xs text-muted">Aduce din nou ultimele 3 zile. Rezultatul apare după ~1 minut (reîncarcă pagina).</span>
        </form>
      </footer>
    </div>
  )
}
