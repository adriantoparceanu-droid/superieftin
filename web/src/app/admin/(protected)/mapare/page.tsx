import { getUnmappedGroups, getCategoriesTree, getTagsWithCounts, getMappingRules } from '@/lib/admin/queries'
import { createMappingRuleAction, deleteMappingRuleAction } from '@/lib/admin/actions'

export default async function MaparePage() {
  const [groups, categories, tags, rules] = await Promise.all([
    getUnmappedGroups(),
    getCategoriesTree(),
    getTagsWithCounts(),
    getMappingRules(),
  ])

  const categoryOptions = categories.map((c) => {
    const parent = c.parent_id ? categories.find((p) => p.id === c.parent_id) : null
    return { id: c.id, label: parent ? `${parent.name} → ${c.name}` : c.name }
  })

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold mb-2">Mapare categorii</h1>
      <p className="text-sm text-muted mb-6">
        Categoriile din feed-uri fără regulă de mapare. Alege categoria site-ului — regula se aplică
        retroactiv pe produsele existente și automat la importurile viitoare.
      </p>

      {!groups.length && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-8 text-sm text-green-800">
          Toate produsele sunt mapate. 🎉
        </div>
      )}

      <div className="space-y-3 mb-10">
        {groups.map((g) => (
          <form
            key={`${g.retailer_id}-${g.feed_category}`}
            action={createMappingRuleAction}
            className="bg-white border border-line rounded-xl p-4 flex flex-wrap items-center gap-3"
          >
            <input type="hidden" name="feed_category" value={g.feed_category} />
            <input type="hidden" name="retailer_id" value={g.retailer_id ?? ''} />
            <div className="min-w-48 flex-1">
              <p className="font-semibold">{g.feed_category}</p>
              <p className="text-xs text-muted">
                {g.retailer_name ?? 'fără retailer'} · {g.product_count.toLocaleString('ro-RO')} produse
              </p>
            </div>
            <select name="category_id" required className="border border-line rounded-lg px-2 py-1.5 text-sm">
              <option value="">— alege categoria —</option>
              {categoryOptions.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
            <select name="tag_ids" multiple size={1} className="border border-line rounded-lg px-2 py-1.5 text-sm min-w-28" title="Taguri (Cmd+click pentru mai multe)">
              {tags.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <label className="text-xs text-muted flex items-center gap-1">
              <input type="checkbox" name="global" /> regulă globală
            </label>
            <button type="submit" className="bg-brand text-white text-sm font-semibold rounded-lg px-4 py-1.5 hover:opacity-90">
              Mapează
            </button>
          </form>
        ))}
      </div>

      <h2 className="text-lg font-semibold mb-3">Reguli existente ({rules.length})</h2>
      <div className="bg-white border border-line rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left text-muted">
            <tr>
              <th className="px-4 py-2">Categorie feed</th>
              <th className="px-4 py-2">Retailer</th>
              <th className="px-4 py-2">→ Categorie site</th>
              <th className="px-4 py-2">Taguri</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id} className="border-t border-line">
                <td className="px-4 py-2 font-medium">{r.feed_category}</td>
                <td className="px-4 py-2">{r.retailer_name ?? <span className="text-muted">globală</span>}</td>
                <td className="px-4 py-2">{r.category_name}</td>
                <td className="px-4 py-2 text-muted">{r.tag_names.join(', ') || '—'}</td>
                <td className="px-4 py-2 text-right">
                  <form action={deleteMappingRuleAction}>
                    <input type="hidden" name="id" value={r.id} />
                    <button type="submit" className="text-red-600 text-xs hover:underline">șterge</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
