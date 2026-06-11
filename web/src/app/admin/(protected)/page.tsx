import Link from 'next/link'
import { getRetailerStats, getUnmappedCount, getRecentSyncs } from '@/lib/admin/queries'

// Paginile admin sunt dinamice implicit: layout-ul protejat citeste cookies()

export default async function AdminDashboard() {
  const [retailers, unmapped, syncs] = await Promise.all([
    getRetailerStats(),
    getUnmappedCount(),
    getRecentSyncs(10),
  ])
  const totalProducts = retailers.reduce((s, r) => s + r.products, 0)
  const totalOffers = retailers.reduce((s, r) => s + r.offers, 0)

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white border border-line rounded-xl p-4">
          <p className="text-sm text-muted">Produse</p>
          <p className="text-2xl font-bold">{totalProducts.toLocaleString('ro-RO')}</p>
        </div>
        <div className="bg-white border border-line rounded-xl p-4">
          <p className="text-sm text-muted">Oferte</p>
          <p className="text-2xl font-bold">{totalOffers.toLocaleString('ro-RO')}</p>
        </div>
        <Link href="/admin/mapare" className={`border rounded-xl p-4 ${unmapped ? 'bg-amber-50 border-amber-300' : 'bg-white border-line'}`}>
          <p className="text-sm text-muted">Produse nemapate</p>
          <p className={`text-2xl font-bold ${unmapped ? 'text-amber-600' : ''}`}>{unmapped.toLocaleString('ro-RO')}</p>
          {unmapped > 0 && <p className="text-xs text-amber-600 mt-1">Mapează-le →</p>}
        </Link>
      </div>

      <h2 className="text-lg font-semibold mb-3">Retaileri</h2>
      <div className="bg-white border border-line rounded-xl overflow-hidden mb-8">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left text-muted">
            <tr>
              <th className="px-4 py-2">Retailer</th>
              <th className="px-4 py-2">Activ</th>
              <th className="px-4 py-2 text-right">Produse</th>
              <th className="px-4 py-2 text-right">Oferte</th>
            </tr>
          </thead>
          <tbody>
            {retailers.map((r) => (
              <tr key={r.id} className="border-t border-line">
                <td className="px-4 py-2 font-medium">{r.name}</td>
                <td className="px-4 py-2">{r.is_active ? '✅' : '—'}</td>
                <td className="px-4 py-2 text-right">{r.products.toLocaleString('ro-RO')}</td>
                <td className="px-4 py-2 text-right">{r.offers.toLocaleString('ro-RO')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="text-lg font-semibold mb-3">Sincronizări recente</h2>
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
                <td className="px-4 py-2">{s.feed_name ?? s.filename ?? '—'}</td>
                <td className="px-4 py-2">{s.source}</td>
                <td className="px-4 py-2 text-right">{s.products_count?.toLocaleString('ro-RO') ?? '—'}</td>
                <td className="px-4 py-2 text-right">{s.unmapped_count?.toLocaleString('ro-RO') ?? '—'}</td>
                <td className="px-4 py-2">{s.status === 'success' ? '✅' : '⚠️ ' + s.status}</td>
                <td className="px-4 py-2 text-muted">{new Date(s.synced_at).toLocaleString('ro-RO')}</td>
              </tr>
            ))}
            {!syncs.length && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-muted">Nicio sincronizare încă.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
