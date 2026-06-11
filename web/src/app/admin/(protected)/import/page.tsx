'use client'

import { useActionState, useEffect, useState } from 'react'
import { uploadFeedAction } from '@/lib/admin/actions'

interface SyncRow {
  id: number
  feed_name: string | null
  source: string
  filename: string | null
  products_count: number | null
  unmapped_count: number | null
  status: string
  synced_at: string
}

export default function ImportPage() {
  const [state, formAction, pending] = useActionState(uploadFeedAction, null)
  const [syncs, setSyncs] = useState<SyncRow[]>([])

  useEffect(() => {
    const load = () => fetch('/admin/import/istoric').then((r) => r.json()).then(setSyncs).catch(() => {})
    load()
    const interval = setInterval(load, 10000)  // istoric reîmprospătat — importul rulează în worker
    return () => clearInterval(interval)
  }, [state])

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-2">Import feed</h1>
      <p className="text-sm text-muted mb-6">
        Încarcă un fișier XML sau CSV în format Profitshare. Importul rulează în fundal (worker);
        rezultatul apare în istoricul de mai jos.
      </p>

      <form action={formAction} className="bg-white border border-line rounded-xl p-4 flex flex-wrap items-end gap-3 mb-4">
        <div>
          <label className="block text-xs text-muted mb-1">Fișier feed (.xml / .csv)</label>
          <input type="file" name="file" accept=".xml,.csv" required className="text-sm" />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Retailer (opțional, slug)</label>
          <input name="retailer_slug" placeholder="auto din adv_name" className="border border-line rounded-lg px-3 py-1.5 text-sm" />
        </div>
        <button
          type="submit" disabled={pending}
          className="bg-brand text-white text-sm font-semibold rounded-lg px-4 py-1.5 hover:opacity-90 disabled:opacity-50"
        >
          {pending ? 'Se încarcă…' : 'Importă'}
        </button>
      </form>

      {state?.message && <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3 mb-6">{state.message}</p>}
      {state?.error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 mb-6">{state.error}</p>}

      <h2 className="text-lg font-semibold mb-3">Istoric importuri</h2>
      <div className="bg-white border border-line rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left text-muted">
            <tr>
              <th className="px-4 py-2">Feed</th>
              <th className="px-4 py-2">Sursă</th>
              <th className="px-4 py-2 text-right">Produse</th>
              <th className="px-4 py-2 text-right">Nemapate</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Data</th>
            </tr>
          </thead>
          <tbody>
            {syncs.map((s) => (
              <tr key={s.id} className="border-t border-line">
                <td className="px-4 py-2">{s.filename ?? s.feed_name ?? '—'}</td>
                <td className="px-4 py-2">{s.source}</td>
                <td className="px-4 py-2 text-right">{s.products_count?.toLocaleString('ro-RO') ?? '—'}</td>
                <td className="px-4 py-2 text-right">{s.unmapped_count?.toLocaleString('ro-RO') ?? '—'}</td>
                <td className="px-4 py-2">{s.status === 'success' ? '✅' : '⚠️ ' + s.status}</td>
                <td className="px-4 py-2 text-muted">{new Date(s.synced_at).toLocaleString('ro-RO')}</td>
              </tr>
            ))}
            {!syncs.length && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-muted">Niciun import încă.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
