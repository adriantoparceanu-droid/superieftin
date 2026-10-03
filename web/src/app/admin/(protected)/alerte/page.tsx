import type { Metadata } from 'next'
import Link from 'next/link'
import { getAlertStats, getTopWatchedProducts, getEmailSubscribers, type AlertChannelStats } from '@/lib/admin/queries'
import { deleteEmailSubscriberAction, deleteEmailAlertAction } from '@/lib/admin/actions'
import {
  distanceToTargetPct, formatDistance, parsePage, parseSearch, parseSubscriberStatus, totalPages,
  type SubscriberStatus,
} from '@/lib/admin/alerts-format'
import { RevealEmail } from '@/components/admin/RevealEmail'
import { ConfirmDeleteButton } from '@/components/admin/ConfirmDeleteButton'

// Admin → Alerte: cifrele alertelor de pret (Telegram + email), produsele cele mai urmarite si
// abonatii pe email (cu stergere pentru cererile GDPR). Pagina e dinamica (layout-ul protejat
// citeste cookies() → fiecare incarcare citeste din DB, fara cache). Telegram: doar cifre agregate.
// Adresele de email apar mascat; cea intreaga doar la click (revealSubscriberEmailAction).

export const metadata: Metadata = { robots: { index: false, follow: false } }

const TOP_PER_PAGE = 20
const SUBS_PER_PAGE = 25

type SP = { q?: string | string[]; stare?: string | string[]; pagina?: string | string[]; top?: string | string[] }
type Props = { searchParams: Promise<SP> }

const int = (n: number) => n.toLocaleString('ro-RO')
const lei = (n: number | null) =>
  n == null ? '—' : `${n.toLocaleString('ro-RO', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} lei`

// Momentele le afisam in ora Romaniei — containerul de pe VPS e UTC
function fmt(d: Date | null, withTime = false): string {
  if (!d) return '—'
  return new Intl.DateTimeFormat('ro-RO', {
    day: 'numeric', month: 'short', year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
    timeZone: 'Europe/Bucharest',
  }).format(d)
}

// URL-ul paginii cu parametrii curenti + modificarile date (valorile goale / implicite dispar)
function href(cur: { q: string | null; stare: SubscriberStatus; pagina: number; top: number }, change: Partial<typeof cur>): string {
  const next = { ...cur, ...change }
  const p = new URLSearchParams()
  if (next.q) p.set('q', next.q)
  if (next.stare !== 'toti') p.set('stare', next.stare)
  if (next.pagina > 1) p.set('pagina', String(next.pagina))
  if (next.top > 1) p.set('top', String(next.top))
  const s = p.toString()
  return `/admin/alerte${s ? `?${s}` : ''}`
}

function Card({ label, value, note, title }: { label: string; value: React.ReactNode; note?: React.ReactNode; title?: string }) {
  return (
    <div className="bg-white border border-line rounded-xl p-4" title={title}>
      <p className="text-sm text-muted">{label}</p>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      {note && <p className="text-xs text-muted mt-1">{note}</p>}
    </div>
  )
}

function Pager({ page, pages, link, anchor }: { page: number; pages: number; link: (p: number) => string; anchor: string }) {
  if (pages <= 1) return null
  const cls = 'px-3 py-1 rounded-lg border border-line bg-white text-sm hover:border-brand'
  return (
    <nav className="flex items-center gap-2 mt-3 text-sm" aria-label="Paginare">
      {page > 1 ? <Link href={`${link(page - 1)}#${anchor}`} className={cls}>← Înapoi</Link> : <span className={`${cls} opacity-40`}>← Înapoi</span>}
      <span className="text-muted">Pagina {page} din {pages}</span>
      {page < pages ? <Link href={`${link(page + 1)}#${anchor}`} className={cls}>Înainte →</Link> : <span className={`${cls} opacity-40`}>Înainte →</span>}
    </nav>
  )
}

function ChannelRow({ label, c, digests }: { label: string; c: AlertChannelStats; digests?: React.ReactNode }) {
  return (
    <tr className="border-t border-line">
      <td className="px-4 py-2 font-medium">{label}</td>
      <td className="px-4 py-2 text-right tabular-nums">{int(c.notified_7d)}</td>
      <td className="px-4 py-2 text-right tabular-nums">{int(c.notified_30d)}</td>
      <td className="px-4 py-2 text-right tabular-nums">{int(c.notify_total)}</td>
      <td className="px-4 py-2 text-right tabular-nums">{int(c.rearmed_7d)}</td>
      <td className="px-4 py-2 text-right tabular-nums">{int(c.rearmed_30d)}</td>
      <td className="px-4 py-2 text-right tabular-nums">{digests ?? <span className="text-muted">—</span>}</td>
    </tr>
  )
}

export default async function AlertePage({ searchParams }: Props) {
  const sp = await searchParams
  const cur = {
    q: parseSearch(sp.q),
    stare: parseSubscriberStatus(Array.isArray(sp.stare) ? sp.stare[0] : sp.stare),
    pagina: parsePage(sp.pagina),
    top: parsePage(sp.top),
  }

  const [stats, top, subs] = await Promise.all([
    getAlertStats(),
    getTopWatchedProducts(TOP_PER_PAGE, (cur.top - 1) * TOP_PER_PAGE),
    getEmailSubscribers({ search: cur.q, status: cur.stare, limit: SUBS_PER_PAGE, offset: (cur.pagina - 1) * SUBS_PER_PAGE }),
  ])
  const { email: em, telegram: tg } = stats

  return (
    <div className="max-w-6xl">
      <h1 className="text-2xl font-bold mb-2">Alerte de preț</h1>
      <p className="text-sm text-muted mb-6">
        Alertele puse de vizitatori pe Telegram și pe email. O alertă vie e fie <strong>armată</strong> (așteaptă ca
        prețul să coboare la prag), fie <strong>trimisă</strong> (a anunțat și așteaptă ca prețul să urce din nou peste
        prag + marja de re-armare). Pe Telegram vezi doar cifre agregate.
      </p>

      <h2 className="text-lg font-semibold mb-3">Abonați și alerte</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
        <Card
          label="Abonați email confirmați"
          value={int(stats.subscribers_confirmed)}
          note={<>{int(stats.subscribers_unconfirmed)} neconfirmați (se șterg după 7 zile)</>}
        />
        <Card
          label="Alerte active pe email"
          value={int(em.active)}
          note={<>{int(em.armed)} armate · {int(em.sent)} trimise{stats.email_pending ? <> · {int(stats.email_pending)} așteaptă confirmarea</> : null}</>}
        />
        <Card
          label="Alerte active pe Telegram"
          value={int(tg.active)}
          note={<>{int(tg.armed)} armate · {int(tg.sent)} trimise · {int(stats.telegram_users_active)} utilizatori</>}
        />
        <Card
          label="Produse urmărite"
          value={int(stats.products_watched)}
          note="produse distincte cu alerte active"
        />
        <Card
          label="Trimise, așteaptă re-armarea"
          value={int(em.sent + tg.sent)}
          note={<>email {int(em.sent)} · Telegram {int(tg.sent)}</>}
        />
        <Card
          label="Re-armate (30 zile)"
          value={int(em.rearmed_30d + tg.rearmed_30d)}
          note={<>{int(em.rearmed_7d + tg.rearmed_7d)} în ultimele 7 zile · {int(em.rearmed_ever + tg.rearmed_ever)} vreodată</>}
          title="Alerte a căror ultimă re-armare cade în interval (limită inferioară)"
        />
        <Card
          label="Emailuri cu alerte (30 zile)"
          value={<>≥ {int(stats.digests_30d)}</>}
          note={<>≥ {int(stats.digests_7d)} în ultimele 7 zile · {int(stats.digests_ever)} abonați au primit vreodată</>}
          title="Abonați al căror ultim email cu alerte cade în interval — limită inferioară a numărului de emailuri"
        />
        {(em.stopped + tg.stopped) > 0 && (
          <Card
            label="Alerte oprite"
            value={int(em.stopped + tg.stopped)}
            note={<>email {int(em.stopped)} · Telegram {int(tg.stopped)} (dinainte de re-armare sau oprite de utilizator)</>}
          />
        )}
      </div>

      <h2 className="text-lg font-semibold mb-3">Anunțuri trimise</h2>
      <div className="bg-white border border-line rounded-xl overflow-x-auto mb-2">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left text-muted">
            <tr>
              <th className="px-4 py-2">Canal</th>
              <th className="px-4 py-2 text-right">Alerte anunțate (7 zile)</th>
              <th className="px-4 py-2 text-right">Alerte anunțate (30 zile)</th>
              <th className="px-4 py-2 text-right">Anunțuri, total</th>
              <th className="px-4 py-2 text-right">Re-armate (7 zile)</th>
              <th className="px-4 py-2 text-right">Re-armate (30 zile)</th>
              <th className="px-4 py-2 text-right">Emailuri digest (7 / 30 zile)</th>
            </tr>
          </thead>
          <tbody>
            <ChannelRow label="Email" c={em} digests={<>≥ {int(stats.digests_7d)} / ≥ {int(stats.digests_30d)}</>} />
            <ChannelRow label="Telegram" c={tg} />
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted mb-8 max-w-4xl">
        Nu se păstrează un istoric al trimiterilor: fiecare alertă reține doar <em>ultimul</em> anunț, <em>ultima</em>{' '}
        re-armare și numărul total de anunțuri; fiecare abonat reține doar <em>ultimul</em> email cu alerte. De aceea
        coloanele pe 7 / 30 de zile numără alertele (sau abonații) cu cel puțin un eveniment în interval — o limită
        inferioară, nu numărul exact de mesaje. „Anunțuri, total” adună contoarele alertelor care încă există (alertele
        și abonații șterși dispar și din cifre).
      </p>

      <h2 id="produse" className="text-lg font-semibold mb-3 scroll-mt-4">Produse urmărite</h2>
      <div className="bg-white border border-line rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left text-muted">
            <tr>
              <th className="px-4 py-2">Produs</th>
              <th className="px-4 py-2 text-right">Alerte active</th>
              <th className="px-4 py-2 text-right">Cel mai mic preț acum</th>
              <th className="px-4 py-2 text-right">Prag mediu</th>
              <th className="px-4 py-2 text-right">Prag min. / max.</th>
              <th className="px-4 py-2 text-right" title="Cât trebuie să scadă cel mai mic preț disponibil ca să atingă pragul">Până la prag (mediu / cel mai apropiat)</th>
            </tr>
          </thead>
          <tbody>
            {top.rows.map((r) => {
              const dAvg = distanceToTargetPct(r.best_price, r.target_avg)
              const dNear = distanceToTargetPct(r.best_price, r.target_max)
              return (
                <tr key={r.product_id} className="border-t border-line align-top">
                  <td className="px-4 py-2">
                    <Link href={`/p/${r.slug}`} className="flex items-center gap-2 hover:text-brand" target="_blank">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {r.image_url && <img src={r.image_url} alt="" width={32} height={32} loading="lazy" className="w-8 h-8 object-contain rounded shrink-0" />}
                      <span className="line-clamp-2">{r.name}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums whitespace-nowrap">
                    <span className="font-semibold">{int(r.alerts)}</span>
                    <div className="text-xs text-muted">email {int(r.email_alerts)} · Telegram {int(r.telegram_alerts)}</div>
                    {r.sent_alerts > 0 && <div className="text-xs text-muted">{int(r.sent_alerts)} trimise</div>}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums whitespace-nowrap">
                    {r.best_price == null ? <span className="text-muted">fără ofertă disponibilă</span> : lei(r.best_price)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums whitespace-nowrap">{lei(Math.round(r.target_avg * 100) / 100)}</td>
                  <td className="px-4 py-2 text-right tabular-nums whitespace-nowrap">
                    {lei(r.target_min)}
                    {r.target_max !== r.target_min && <div className="text-xs text-muted">max. {lei(r.target_max)}</div>}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums whitespace-nowrap">
                    <span className={dAvg != null && dAvg <= 0 ? 'text-success font-semibold' : ''}>{formatDistance(dAvg)}</span>
                    <span className="text-muted"> / </span>
                    <span className={dNear != null && dNear <= 0 ? 'text-success font-semibold' : ''}>{formatDistance(dNear)}</span>
                    {r.reached > 0 && <div className="text-xs text-success">{int(r.reached)} {r.reached === 1 ? 'prag atins' : 'praguri atinse'} acum</div>}
                  </td>
                </tr>
              )
            })}
            {!top.rows.length && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-muted">Nicio alertă activă încă.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <Pager page={cur.top} pages={totalPages(top.total, TOP_PER_PAGE)} link={(p) => href(cur, { top: p })} anchor="produse" />
      <p className="text-xs text-muted mt-2 mb-8">
        Doar alertele active și confirmate. „Cel mai mic preț acum” = cea mai ieftină ofertă disponibilă (în stoc,
        confirmată în ultimele 3 zile, magazin nepus pe pauză) — aceeași regulă după care pleacă alertele.
        „Atins” = prețul de acum e la sau sub prag.
      </p>

      <h2 id="abonati" className="text-lg font-semibold mb-3 scroll-mt-4">Abonați pe email</h2>
      <form method="get" action="/admin/alerte#abonati" className="bg-white border border-line rounded-xl p-4 flex flex-wrap items-end gap-3 mb-4">
        <div>
          <label htmlFor="q" className="block text-xs text-muted mb-1">Caută după adresă (parțial)</label>
          <input id="q" name="q" type="search" defaultValue={cur.q ?? ''} placeholder="ex. kidsport" maxLength={100} className="border border-line rounded-lg px-3 py-1.5 text-sm w-64" />
        </div>
        <div>
          <label htmlFor="stare" className="block text-xs text-muted mb-1">Stare</label>
          <select id="stare" name="stare" defaultValue={cur.stare} className="border border-line rounded-lg px-3 py-1.5 text-sm bg-white">
            <option value="toti">Toți</option>
            <option value="confirmati">Confirmați</option>
            <option value="neconfirmati">Neconfirmați</option>
          </select>
        </div>
        {cur.top > 1 && <input type="hidden" name="top" value={cur.top} />}
        <button type="submit" className="bg-brand text-white text-sm font-semibold rounded-lg px-4 py-1.5 hover:opacity-90">Filtrează</button>
        {(cur.q || cur.stare !== 'toti') && (
          <Link href={`${href(cur, { q: null, stare: 'toti', pagina: 1 })}#abonati`} className="text-sm text-muted hover:text-brand">Resetează</Link>
        )}
        <span className="ml-auto text-sm text-muted">{int(subs.total)} {subs.total === 1 ? 'abonat' : 'abonați'}</span>
      </form>

      <div className="bg-white border border-line rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left text-muted">
            <tr>
              <th className="px-4 py-2">Adresă</th>
              <th className="px-4 py-2">Abonat la</th>
              <th className="px-4 py-2">Confirmat la</th>
              <th className="px-4 py-2 text-right">Alerte active</th>
              <th className="px-4 py-2">Ultimul email cu alerte</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {subs.rows.map((s) => (
              <tr key={s.id} className="border-t border-line align-top">
                <td className="px-4 py-2">
                  <RevealEmail id={s.id} masked={s.email_masked} />
                  {s.alerts.length > 0 && (
                    <details className="mt-1">
                      <summary className="cursor-pointer text-xs text-brand">Alertele lui ({s.alerts.length})</summary>
                      <ul className="mt-2 space-y-2">
                        {s.alerts.map((a) => (
                          <li key={a.id} className="text-xs flex flex-wrap items-baseline gap-x-2">
                            <Link href={`/p/${a.product_slug}`} target="_blank" className="hover:text-brand line-clamp-1 max-w-72">{a.product_name}</Link>
                            <span className="tabular-nums">prag {lei(a.target_price)}</span>
                            <span className="text-muted">
                              {!a.is_active ? 'oprită' : !a.confirmed ? 'neconfirmată' : a.triggered_at ? 'trimisă' : 'armată'}
                              {a.notify_count > 0 && <> · {a.notify_count} {a.notify_count === 1 ? 'anunț' : 'anunțuri'}, ultimul {fmt(a.last_notified_at)}</>}
                            </span>
                            <ConfirmDeleteButton
                              action={deleteEmailAlertAction}
                              id={a.id}
                              label="șterge alerta"
                              confirmText={`Ștergi alerta pentru „${a.product_name}”? Abonatul rămâne.`}
                            />
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </td>
                <td className="px-4 py-2 text-muted whitespace-nowrap">{fmt(s.created_at, true)}</td>
                <td className="px-4 py-2 whitespace-nowrap">
                  {s.confirmed_at ? <span className="text-muted">{fmt(s.confirmed_at, true)}</span> : <span className="inline-block rounded-full px-2 py-0.5 text-xs font-semibold bg-amber-100 text-amber-800">neconfirmat</span>}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {int(s.active_alerts)}
                  {s.pending_alerts > 0 && <div className="text-xs text-muted">+{int(s.pending_alerts)} neconfirmate</div>}
                </td>
                <td className="px-4 py-2 text-muted whitespace-nowrap">{fmt(s.last_digest_at, true)}</td>
                <td className="px-4 py-2 text-right">
                  <ConfirmDeleteButton
                    action={deleteEmailSubscriberAction}
                    id={s.id}
                    label="Șterge abonatul"
                    confirmText={`Ștergi definitiv abonatul ${s.email_masked} și toate alertele lui (${s.alerts.length})? Acțiunea nu se poate anula.`}
                    className="text-xs font-semibold text-red-700 border border-red-200 rounded-lg px-2 py-1 hover:bg-red-50 disabled:opacity-50 whitespace-nowrap"
                  />
                </td>
              </tr>
            ))}
            {!subs.rows.length && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-muted">
                {cur.q || cur.stare !== 'toti' ? 'Niciun abonat nu se potrivește filtrului.' : 'Niciun abonat pe email încă.'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
      <Pager page={cur.pagina} pages={totalPages(subs.total, SUBS_PER_PAGE)} link={(p) => href(cur, { pagina: p })} anchor="abonati" />
      <p className="text-xs text-muted mt-2">
        Adresele apar mascat; „arată” o cere de la server doar pentru tine. „Șterge abonatul” (cereri GDPR) șterge
        definitiv adresa și toate alertele ei — la fel ca dezabonarea din email. Abonații neconfirmați se șterg automat
        după 7 zile.
      </p>
    </div>
  )
}
