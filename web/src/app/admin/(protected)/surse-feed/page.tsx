import { Fragment } from 'react'
import { addExternalFeedAction, toggleExternalFeedAction, deleteExternalFeedAction } from '@/lib/admin/actions'
import { getExternalFeeds, getCategoryOptions, getCategoriesTree } from '@/lib/admin/queries'
import FeedCategoryPicker from '@/components/admin/FeedCategoryPicker'

// Starea filtrului de categorii (external_feeds.category_filter, migratia 028), pe scurt
function FilterBadge({ filter }: { filter: string[] | null }) {
  if (filter == null) return <span className="text-xs text-muted">Toate categoriile</span>
  if (filter.length === 0) {
    return (
      <span className="inline-block rounded-full bg-amber-100 text-amber-800 text-xs font-semibold px-2 py-0.5">
        ⚠ Nicio categorie aleasă — feed-ul nu importă nimic
      </span>
    )
  }
  return (
    <span className="text-xs font-semibold text-gray-800" title={filter.join('\n')}>
      {filter.length} {filter.length === 1 ? 'categorie aleasă' : 'categorii alese'}
    </span>
  )
}

export default async function SurseFeedPage() {
  const [feeds, categoryOptions, tree] = await Promise.all([getExternalFeeds(), getCategoryOptions(), getCategoriesTree()])
  // Parintii posibili pentru „Creează categorie nouă” = categoriile principale din meniu
  const parents = tree.filter((c) => c.parent_id == null).map((c) => ({ id: c.id, name: c.name }))

  return (
    <div className="max-w-6xl">
      <h1 className="text-2xl font-bold mb-2">Surse feed</h1>
      <p className="text-sm text-muted mb-6">
        Feed-uri externe sincronizate automat de worker (ex. 2Performant per advertiser). Dezactivează un feed
        pentru a-l scoate din sincronizare fără a-l șterge, sau elimină-l definitiv dacă dă erori și nu mai e folosit.
        La feed-urile 2Performant poți alege <strong>ce categorii din feed se importă</strong> („Alege categoriile”) —
        util la feed-urile mari dominate de un singur tip de produs (ex. huse). Debifarea nu șterge nimic: ofertele
        categoriilor scoase devin „fără stoc” singure după 3 zile.
      </p>

      <form action={addExternalFeedAction} className="bg-white border border-line rounded-xl p-4 flex flex-wrap items-end gap-3 mb-6">
        <div className="flex-1 min-w-[260px]">
          <label className="block text-xs text-muted mb-1">URL feed (XML/CSV)</label>
          <input name="url" type="url" required placeholder="https://api.2performant.com/feed/…" className="w-full border border-line rounded-lg px-3 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Rețea</label>
          <select name="network" defaultValue="2performant" className="border border-line rounded-lg px-3 py-1.5 text-sm">
            <option value="2performant">2performant</option>
            <option value="profitshare">profitshare</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Etichetă (opțional)</label>
          <input name="label" placeholder="ex. evomag.ro" className="border border-line rounded-lg px-3 py-1.5 text-sm" />
        </div>
        <label className="text-xs text-muted flex items-center gap-1 pb-2" title="Feed-ul se creează fără nicio categorie aleasă: workerul îl sare până alegi categoriile mai jos (doar 2Performant)">
          <input type="checkbox" name="choose_categories" defaultChecked /> Alege categoriile înainte de primul import
        </label>
        <button type="submit" className="bg-brand text-white text-sm font-semibold rounded-lg px-4 py-1.5 hover:opacity-90">
          Adaugă feed
        </button>
      </form>

      <div className="bg-white border border-line rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left text-muted">
            <tr>
              <th className="px-4 py-2">Etichetă</th>
              <th className="px-4 py-2">Rețea</th>
              <th className="px-4 py-2">URL</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Categorii importate</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {feeds.map((f) => (
              <Fragment key={f.id}>
              <tr className="border-t border-line">
                <td className="px-4 py-2 font-medium">{f.label ?? '—'}</td>
                <td className="px-4 py-2 capitalize text-muted">{f.network}</td>
                <td className="px-4 py-2 text-muted truncate max-w-[280px]" title={f.url}>{f.url}</td>
                <td className="px-4 py-2">{f.is_active ? '✅ activ' : <span className="text-muted">— inactiv</span>}</td>
                <td className="px-4 py-2">
                  {f.network === '2performant' ? <FilterBadge filter={f.category_filter} /> : <span className="text-xs text-muted">—</span>}
                </td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  <form action={toggleExternalFeedAction} className="inline">
                    <input type="hidden" name="id" value={f.id} />
                    <button type="submit" className="text-xs text-brand hover:underline mr-3">
                      {f.is_active ? 'dezactivează' : 'reactivează'}
                    </button>
                  </form>
                  <form action={deleteExternalFeedAction} className="inline">
                    <input type="hidden" name="id" value={f.id} />
                    <button type="submit" className="text-xs text-red-600 hover:underline">
                      șterge
                    </button>
                  </form>
                </td>
              </tr>
              {f.network === '2performant' && (
                <tr>
                  <td colSpan={6} className="px-4 pb-3">
                    <FeedCategoryPicker feedId={f.id} categoryOptions={categoryOptions} parents={parents} />
                  </td>
                </tr>
              )}
              </Fragment>
            ))}
            {!feeds.length && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-muted">Niciun feed extern configurat.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
