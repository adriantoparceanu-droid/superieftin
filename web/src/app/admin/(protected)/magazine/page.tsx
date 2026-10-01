import Link from 'next/link'
import { getRetailerSources } from '@/lib/admin/queries'
import { pauseRetailerAction, resumeRetailerAction, saveRetailerNoteAction } from '@/lib/admin/actions'

// Starea surselor fiecarui magazin: calculata zilnic de worker (worker/src/lib/retailer-status.ts),
// cu motivul in romana. Pauza ascunde imediat ofertele magazinului; nota e doar pentru tine.

const STATE: Record<string, { label: string; cls: string }> = {
  ok: { label: 'OK', cls: 'bg-green-100 text-green-800' },
  paused: { label: 'Pe pauză', cls: 'bg-gray-200 text-gray-700' },
  empty: { label: 'Fără oferte', cls: 'bg-gray-100 text-gray-500' },
  feed_empty: { label: 'Feed gol', cls: 'bg-red-100 text-red-800' },
  feed_rejected: { label: 'Feed respins', cls: 'bg-red-100 text-red-800' },
  feed_missing: { label: 'Feed dezactivat', cls: 'bg-red-100 text-red-800' },
  feed_error: { label: 'Feed neimportat', cls: 'bg-red-100 text-red-800' },
  program_inactive: { label: 'Program inactiv', cls: 'bg-amber-100 text-amber-800' },
  scan_failed: { label: 'Scanare eșuată', cls: 'bg-red-100 text-red-800' },
  manual_only: { label: 'Doar import manual', cls: 'bg-amber-100 text-amber-800' },
  stale: { label: 'Neactualizat', cls: 'bg-amber-100 text-amber-800' },
}

const SOURCE_LABEL: Record<string, string> = {
  profitshare: 'Profitshare',
  '2performant': '2Performant',
  scraper: 'Scanare locală',
  upload: 'Import manual',
}

function ago(seconds: number | null): string {
  if (seconds == null) return '—'
  const h = Math.floor(seconds / 3600)
  if (h < 1) return 'acum < 1 h'
  if (h < 24) return `acum ${h} h`
  const d = Math.floor(h / 24)
  return `acum ${d} ${d === 1 ? 'zi' : 'zile'}`
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'short', timeZone: 'Europe/Bucharest' }).format(new Date(iso))
}

export default async function MagazinePage() {
  const rows = await getRetailerSources()
  const problems = rows.filter((r) => r.source_state && !['ok', 'paused', 'empty'].includes(r.source_state))

  return (
    <div className="max-w-6xl">
      <h1 className="text-2xl font-bold mb-2">Magazine & surse</h1>
      <p className="text-sm text-muted mb-6">
        De unde vin ofertele fiecărui magazin și dacă sursa mai funcționează. Starea se recalculează zilnic la
        sincronizarea de dimineață; la orice schimbare primești o avertizare pe Telegram. Ofertele neconfirmate
        de 3 zile dispar automat de pe site. <strong>Pauza</strong> le ascunde imediat (ex. când o rețea oprește
        programul) și nu șterge nimic — la reactivare revin.
      </p>

      {problems.length > 0 && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          <strong>{problems.length} {problems.length === 1 ? 'magazin are' : 'magazine au'} probleme cu sursa:</strong>{' '}
          {problems.map((p) => p.name).join(', ')}.
        </div>
      )}

      <div className="bg-white border border-line rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left text-muted">
            <tr>
              <th className="px-4 py-2">Magazin</th>
              <th className="px-4 py-2">Sursă</th>
              <th className="px-4 py-2">Stare</th>
              <th className="px-4 py-2">Actualizat</th>
              <th className="px-4 py-2 text-right">Oferte vizibile</th>
              <th className="px-4 py-2">Acțiuni</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const st = STATE[r.source_state ?? ''] ?? { label: 'Necalculat', cls: 'bg-gray-100 text-gray-500' }
              const sources = (r.sources ?? []).map((s) => SOURCE_LABEL[s] ?? s)
              return (
                <tr key={r.id} className="border-t border-line align-top">
                  <td className="px-4 py-3">
                    <div className="font-semibold">{r.name}</div>
                    {r.admin_note && <div className="text-xs text-muted mt-1 max-w-56 whitespace-pre-line">📝 {r.admin_note}</div>}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {sources.length ? sources.join(', ') : <span className="text-muted">—</span>}
                    {r.external_feeds > 0 && (
                      <div className="text-muted">
                        {r.external_feeds} feed-uri 2P active ·{' '}
                        <Link href="/admin/surse-feed" className="text-brand underline">alege categoriile</Link>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 max-w-72">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${st.cls}`}>{st.label}</span>
                    {r.source_reason && r.source_state !== 'ok' && (
                      <div className="text-xs text-muted mt-1">{r.source_reason}</div>
                    )}
                    {r.source_state && r.source_state !== 'ok' && r.source_state_since && (
                      <div className="text-xs text-muted">din {fmtDate(r.source_state_since)}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs whitespace-nowrap">
                    {ago(r.last_fresh_age_s)}
                    <div className="text-muted">{fmtDate(r.last_fresh)}</div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
                    <span className={r.offers_visible === 0 && r.offers_total > 0 ? 'text-red-700 font-semibold' : ''}>
                      {r.paused_at ? 0 : r.offers_visible.toLocaleString('ro-RO')}
                    </span>
                    <span className="text-muted"> / {r.offers_total.toLocaleString('ro-RO')}</span>
                  </td>
                  <td className="px-4 py-3">
                    <details>
                      <summary className="cursor-pointer text-brand text-xs font-semibold">Administrează</summary>
                      <div className="mt-2 space-y-3 w-64">
                        {r.paused_at ? (
                          <form action={resumeRetailerAction}>
                            <input type="hidden" name="id" value={r.id} />
                            <p className="text-xs text-muted mb-1">Pe pauză din {fmtDate(r.paused_at)}</p>
                            <button className="bg-success text-white text-xs font-semibold rounded-lg px-3 py-1.5">Reactivează</button>
                          </form>
                        ) : (
                          <form action={pauseRetailerAction} className="space-y-1">
                            <input type="hidden" name="id" value={r.id} />
                            <input name="reason" placeholder="Motiv (ex. oprit de Profitshare)" className="w-full border border-line rounded-lg px-2 py-1 text-xs" />
                            <button className="bg-gray-800 text-white text-xs font-semibold rounded-lg px-3 py-1.5">Pune pe pauză</button>
                          </form>
                        )}
                        <form action={saveRetailerNoteAction} className="space-y-1">
                          <input type="hidden" name="id" value={r.id} />
                          <textarea name="note" defaultValue={r.admin_note ?? ''} rows={2} placeholder="Notă (doar pentru tine)" className="w-full border border-line rounded-lg px-2 py-1 text-xs" />
                          <button className="border border-line text-xs font-semibold rounded-lg px-3 py-1">Salvează nota</button>
                        </form>
                        {(r.source_state === 'manual_only' || r.source_state === 'feed_missing') && (
                          <Link href="/admin/import" className="block text-xs text-brand underline">Import manual de fișier →</Link>
                        )}
                      </div>
                    </details>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted mt-3">
        Feed-urile 2Performant (inclusiv ce categorii din feed se importă) se configurează în <Link href="/admin/surse-feed" className="underline">Surse feed</Link>,
        categoriile scanate eMAG în <Link href="/admin/scraper-categorii" className="underline">Categorii scanate</Link>.
      </p>
    </div>
  )
}
