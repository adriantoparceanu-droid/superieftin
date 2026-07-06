import { getAffiliateAdvertisers } from '@/lib/admin/queries'

export default async function AdvertisersPage() {
  const advertisers = await getAffiliateAdvertisers()

  const active = advertisers.filter((a) => a.status === 'active')
  const byNetwork = new Map<string, number>()
  for (const a of active) byNetwork.set(a.network, (byNetwork.get(a.network) ?? 0) + 1)

  const fmtCommission = (c: number | null) =>
    c === null ? '—' : `${c.toLocaleString('ro-RO', { maximumFractionDigits: 2 })}%`

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold mb-2">Advertiseri afiliați</h1>
      <p className="text-sm text-muted mb-6">
        Magazinele afiliabile din rețele și comisionul maxim per advertiser. „Activ” = ești aprobat în program
        (link-urile aduc comision); ceilalți apar în site fără link de comision.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border border-line rounded-xl p-4">
          <p className="text-sm text-muted">Total advertiseri</p>
          <p className="text-2xl font-bold">{advertisers.length.toLocaleString('ro-RO')}</p>
        </div>
        <div className="bg-white border border-line rounded-xl p-4">
          <p className="text-sm text-muted">Activi (aprobați)</p>
          <p className="text-2xl font-bold text-success">{active.length.toLocaleString('ro-RO')}</p>
        </div>
        {[...byNetwork.entries()].map(([network, count]) => (
          <div key={network} className="bg-white border border-line rounded-xl p-4">
            <p className="text-sm text-muted capitalize">{network}</p>
            <p className="text-2xl font-bold">{count.toLocaleString('ro-RO')}</p>
          </div>
        ))}
      </div>

      <div className="bg-white border border-line rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left text-muted">
            <tr>
              <th className="px-4 py-2">Advertiser</th>
              <th className="px-4 py-2">Rețea</th>
              <th className="px-4 py-2">Domeniu</th>
              <th className="px-4 py-2 text-right">Comision</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Actualizat</th>
            </tr>
          </thead>
          <tbody>
            {advertisers.map((a, i) => (
              <tr key={`${a.network}-${a.domain}-${i}`} className="border-t border-line">
                <td className="px-4 py-2 font-medium">{a.name ?? '—'}</td>
                <td className="px-4 py-2 capitalize text-muted">{a.network}</td>
                <td className="px-4 py-2 text-muted">{a.domain ?? '—'}</td>
                <td className="px-4 py-2 text-right font-semibold">{fmtCommission(a.commission)}</td>
                <td className="px-4 py-2">{a.status === 'active' ? '✅ activ' : <span className="text-muted">— {a.status}</span>}</td>
                <td className="px-4 py-2 text-muted">{new Date(a.updated_at).toLocaleDateString('ro-RO')}</td>
              </tr>
            ))}
            {!advertisers.length && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-muted">Niciun advertiser sincronizat încă.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
