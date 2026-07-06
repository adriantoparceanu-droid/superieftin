import Link from 'next/link'
import {
  getRetailerStats, getUnmappedCount, getRecentSyncs,
  getPlatformStats, getTopClickedProducts, getTopSearches, getFeedFreshness,
} from '@/lib/admin/queries'

// Paginile admin sunt dinamice implicit: layout-ul protejat citeste cookies()

// "acum 3 zile", "acum 5 ore" etc. — primeste varsta in secunde (calculata in DB).
function timeAgo(seconds: number): string {
  const min = Math.floor(seconds / 60)
  if (min < 60) return `acum ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `acum ${h} h`
  const d = Math.floor(h / 24)
  return `acum ${d} ${d === 1 ? 'zi' : 'zile'}`
}

export default async function AdminDashboard() {
  const [retailers, unmapped, syncs, stats, topProducts, topSearches, freshness] = await Promise.all([
    getRetailerStats(),
    getUnmappedCount(),
    getRecentSyncs(10),
    getPlatformStats(),
    getTopClickedProducts(30, 10),
    getTopSearches(30, 10),
    getFeedFreshness(),
  ])
  const totalProducts = retailers.reduce((s, r) => s + r.products, 0)
  const totalOffers = retailers.reduce((s, r) => s + r.offers, 0)
  const coveragePct = Math.round(stats.affiliate_coverage * 100)

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white border border-line rounded-xl p-4">
          <p className="text-sm text-muted">Produse</p>
          <p className="text-2xl font-bold">{totalProducts.toLocaleString('ro-RO')}</p>
        </div>
        <div className="bg-white border border-line rounded-xl p-4">
          <p className="text-sm text-muted">Oferte</p>
          <p className="text-2xl font-bold">{totalOffers.toLocaleString('ro-RO')}</p>
        </div>
        <Link href="/admin/advertiseri" className="bg-white border border-line rounded-xl p-4 hover:border-brand">
          <p className="text-sm text-muted">Advertiseri activi</p>
          <p className="text-2xl font-bold">{stats.advertisers_active.toLocaleString('ro-RO')}<span className="text-base font-normal text-muted"> / {stats.advertisers_total}</span></p>
        </Link>
        <div className="bg-white border border-line rounded-xl p-4">
          <p className="text-sm text-muted">Acoperire afiliere</p>
          <p className={`text-2xl font-bold ${coveragePct >= 50 ? 'text-success' : 'text-amber-600'}`}>{coveragePct}%</p>
          <p className="text-xs text-muted mt-1">{stats.offers_affiliate.toLocaleString('ro-RO')} oferte cu link afiliat</p>
        </div>
        <div className="bg-white border border-line rounded-xl p-4">
          <p className="text-sm text-muted">Click-uri (30 zile)</p>
          <p className="text-2xl font-bold">{stats.clicks_30d.toLocaleString('ro-RO')}</p>
          <p className="text-xs text-muted mt-1">{stats.clicks_7d.toLocaleString('ro-RO')} în ultimele 7 zile</p>
        </div>
        <Link href="/admin/mapare" className={`border rounded-xl p-4 ${unmapped ? 'bg-amber-50 border-amber-300' : 'bg-white border-line'}`}>
          <p className="text-sm text-muted">Produse nemapate</p>
          <p className={`text-2xl font-bold ${unmapped ? 'text-amber-600' : ''}`}>{unmapped.toLocaleString('ro-RO')}</p>
          {unmapped > 0 && <p className="text-xs text-amber-600 mt-1">Mapează-le →</p>}
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <section>
          <h2 className="text-lg font-semibold mb-3">Cele mai accesate produse (30 zile)</h2>
          <div className="bg-white border border-line rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface text-left text-muted">
                <tr>
                  <th className="px-4 py-2">Produs</th>
                  <th className="px-4 py-2 text-right">Click-uri</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((p) => (
                  <tr key={p.id} className="border-t border-line">
                    <td className="px-4 py-2">
                      <Link href={`/p/${p.slug}`} className="flex items-center gap-2 hover:text-brand">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {p.image_url && <img src={p.image_url} alt="" className="w-8 h-8 object-contain rounded shrink-0" />}
                        <span className="line-clamp-1">{p.name}</span>
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-right font-semibold">{p.clicks.toLocaleString('ro-RO')}</td>
                  </tr>
                ))}
                {!topProducts.length && (
                  <tr><td colSpan={2} className="px-4 py-6 text-center text-muted">Niciun click încă.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">Cele mai căutate (30 zile)</h2>
          <div className="bg-white border border-line rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface text-left text-muted">
                <tr>
                  <th className="px-4 py-2">Termen</th>
                  <th className="px-4 py-2 text-right">Căutări</th>
                  <th className="px-4 py-2 text-right">Rezultate medii</th>
                </tr>
              </thead>
              <tbody>
                {topSearches.map((s) => (
                  <tr key={s.term} className="border-t border-line">
                    <td className="px-4 py-2">{s.term}</td>
                    <td className="px-4 py-2 text-right font-semibold">{s.searches.toLocaleString('ro-RO')}</td>
                    <td className={`px-4 py-2 text-right ${s.avg_results === 0 ? 'text-amber-600' : 'text-muted'}`}>{s.avg_results ?? '—'}</td>
                  </tr>
                ))}
                {!topSearches.length && (
                  <tr><td colSpan={3} className="px-4 py-6 text-center text-muted">Nicio căutare încă.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <h2 className="text-lg font-semibold mb-3">Prospețime feed / scraper</h2>
      <div className="bg-white border border-line rounded-xl overflow-hidden mb-8">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left text-muted">
            <tr>
              <th className="px-4 py-2">Sursă</th>
              <th className="px-4 py-2">Tip</th>
              <th className="px-4 py-2 text-right">Produse</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Ultima verificare</th>
            </tr>
          </thead>
          <tbody>
            {freshness.map((f) => {
              const stale = f.age_seconds > 2 * 86400
              return (
                <tr key={f.feed_link} className="border-t border-line">
                  <td className="px-4 py-2 font-medium">{f.feed_name ?? f.feed_link}</td>
                  <td className="px-4 py-2 text-muted">{f.source}</td>
                  <td className="px-4 py-2 text-right">{f.products_count?.toLocaleString('ro-RO') ?? '—'}</td>
                  <td className="px-4 py-2">{f.status === 'success' ? '✅' : '⚠️ ' + f.status}</td>
                  <td className={`px-4 py-2 ${stale ? 'text-amber-600 font-medium' : 'text-muted'}`}>
                    {timeAgo(f.age_seconds)}
                  </td>
                </tr>
              )
            })}
            {!freshness.length && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-muted">Nicio verificare încă.</td></tr>
            )}
          </tbody>
        </table>
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
