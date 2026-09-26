import Link from 'next/link'
import { listGuidesAdmin, getGuideCandidates } from '@/lib/admin/guides'
import { formatPrice, formatPct, REAL_DISCOUNT_PCT } from '@/lib/discount'
import { formatGuideDate } from '@/lib/guides/format'

export default async function GhiduriAdminPage() {
  const [guides, candidates] = await Promise.all([listGuidesAdmin(), getGuideCandidates(30, 30)])

  return (
    <div className="max-w-5xl space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Ghiduri</h1>
        <div className="flex gap-3">
          <Link href="/admin/ghiduri/autori" className="text-sm border border-line bg-white rounded-lg px-4 py-1.5 hover:border-brand">Autori</Link>
          <Link href="/admin/ghiduri/nou" className="bg-brand text-white text-sm font-semibold rounded-lg px-4 py-1.5 hover:opacity-90">Ghid nou</Link>
        </div>
      </div>

      <div className="bg-white border border-line rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left text-muted">
            <tr>
              <th className="px-4 py-2">Titlu</th>
              <th className="px-4 py-2">Tip</th>
              <th className="px-4 py-2">Stare</th>
              <th className="px-4 py-2 text-right">Produse</th>
              <th className="px-4 py-2">Actualizat</th>
            </tr>
          </thead>
          <tbody>
            {guides.map((g) => (
              <tr key={g.id} className="border-t border-line">
                <td className="px-4 py-2">
                  <Link href={`/admin/ghiduri/${g.id}`} className="font-medium hover:text-brand">{g.title}</Link>
                  <div className="text-xs text-muted">/ghiduri/{g.slug}</div>
                </td>
                <td className="px-4 py-2 text-xs">{g.kind}</td>
                <td className="px-4 py-2">
                  <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${g.status === 'published' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}`}>
                    {g.status === 'published' ? 'Publicat' : 'Ciornă'}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">{g.product_count}</td>
                <td className="px-4 py-2 text-xs text-muted">{formatGuideDate(g.updated_at)}</td>
              </tr>
            ))}
            {!guides.length && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-muted">Niciun ghid încă.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <section>
        <h2 className="text-lg font-bold">Candidați pentru ghiduri</h2>
        <p className="text-sm text-muted mb-3">
          Produsele cu cele mai multe clickuri reale spre magazine în ultimele 30 de zile, cu reducerea de acum
          (față de mediana 30 de zile) și numărul de oferte disponibile. Sănătate & Naturale e exclusă (regula 8).
        </p>
        <div className="bg-white border border-line rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface text-left text-muted">
              <tr>
                <th className="px-4 py-2">Produs</th>
                <th className="px-4 py-2 text-right">Clickuri</th>
                <th className="px-4 py-2 text-right">Oferte disp.</th>
                <th className="px-4 py-2 text-right">Cel mai mic preț</th>
                <th className="px-4 py-2 text-right">Față de mediană</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((c) => (
                <tr key={c.id} className="border-t border-line">
                  <td className="px-4 py-2">
                    <Link href={`/p/${c.slug}`} target="_blank" className="hover:text-brand">{c.name}</Link>
                    <div className="text-xs text-muted">#{c.id}{c.category_name ? ` · ${c.category_name}` : ''}{c.guides ? ` · ${c.guides} ghid(uri)` : ''}</div>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{c.clicks}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{c.offers}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{c.best_price != null ? formatPrice(c.best_price) : '—'}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {c.discount_pct == null ? <span className="text-muted">—</span>
                      : c.discount_pct >= REAL_DISCOUNT_PCT ? <span className="text-brand font-semibold">−{formatPct(c.discount_pct)}%</span>
                      : c.discount_pct >= 0 ? `−${formatPct(c.discount_pct)}%` : `+${formatPct(c.discount_pct)}%`}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Link href={`/admin/ghiduri/nou?produs=${c.id}`} className="text-xs text-brand hover:underline whitespace-nowrap">Creează ghid</Link>
                  </td>
                </tr>
              ))}
              {!candidates.length && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-muted">Niciun click în ultimele 30 de zile.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
