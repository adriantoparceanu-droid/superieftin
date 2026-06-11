import {
  createCategoryAction, updateCategoryAction, toggleCategoryVisibilityAction,
  moveCategoryAction, deleteCategoryAction,
} from '@/lib/admin/actions'
import { getCategoriesTree, type AdminCategory } from '@/lib/admin/queries'

function CategoryRow({ cat, all, level }: { cat: AdminCategory; all: AdminCategory[]; level: number }) {
  const topLevel = all.filter((c) => !c.parent_id && c.id !== cat.id)
  return (
    <tr className="border-t border-line">
      <td className="px-4 py-2">
        <form action={updateCategoryAction} className="flex items-center gap-2" id={`cat-${cat.id}`}>
          <input type="hidden" name="id" value={cat.id} />
          <span className="text-muted">{level > 0 ? '└' : ''}</span>
          <input name="icon" defaultValue={cat.icon ?? ''} placeholder="🏷" className="w-10 border border-line rounded px-1 py-1 text-sm text-center" />
          <input name="name" defaultValue={cat.name} className="border border-line rounded px-2 py-1 text-sm flex-1 min-w-32" />
          <select name="parent_id" defaultValue={cat.parent_id ?? ''} className="border border-line rounded px-1 py-1 text-xs" disabled={all.some((c) => c.parent_id === cat.id)}>
            <option value="">(nivel 1)</option>
            {topLevel.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button type="submit" className="text-xs text-brand hover:underline">salvează</button>
        </form>
      </td>
      <td className="px-4 py-2 text-xs text-muted">/c/{cat.slug}</td>
      <td className="px-4 py-2 text-right text-sm">{cat.product_count.toLocaleString('ro-RO')}</td>
      <td className="px-4 py-2">
        <div className="flex items-center gap-1 justify-end">
          <form action={moveCategoryAction}><input type="hidden" name="id" value={cat.id} /><input type="hidden" name="direction" value="up" /><button className="px-1 text-muted hover:text-brand">↑</button></form>
          <form action={moveCategoryAction}><input type="hidden" name="id" value={cat.id} /><input type="hidden" name="direction" value="down" /><button className="px-1 text-muted hover:text-brand">↓</button></form>
          <form action={toggleCategoryVisibilityAction}><input type="hidden" name="id" value={cat.id} /><button className="px-1" title={cat.is_visible ? 'Ascunde' : 'Afișează'}>{cat.is_visible ? '👁' : '🚫'}</button></form>
          <form action={deleteCategoryAction} className="flex items-center gap-1">
            <input type="hidden" name="id" value={cat.id} />
            <select name="reassign_to" className="border border-line rounded text-xs px-1 py-0.5" title="Mută produsele în...">
              <option value="">(nemapate)</option>
              {all.filter((c) => c.id !== cat.id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button type="submit" className="text-red-600 text-xs hover:underline">șterge</button>
          </form>
        </div>
      </td>
    </tr>
  )
}

export default async function CategoriiPage() {
  const categories = await getCategoriesTree()
  const ordered: { cat: AdminCategory; level: number }[] = []
  for (const top of categories.filter((c) => !c.parent_id)) {
    ordered.push({ cat: top, level: 0 })
    for (const child of categories.filter((c) => c.parent_id === top.id)) {
      ordered.push({ cat: child, level: 1 })
    }
  }

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold mb-6">Categorii</h1>

      <form action={createCategoryAction} className="bg-white border border-line rounded-xl p-4 flex flex-wrap items-end gap-3 mb-6">
        <div>
          <label className="block text-xs text-muted mb-1">Nume categorie nouă</label>
          <input name="name" required className="border border-line rounded-lg px-3 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Iconiță</label>
          <input name="icon" placeholder="📦" className="w-14 border border-line rounded-lg px-2 py-1.5 text-sm text-center" />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Părinte (opțional)</label>
          <select name="parent_id" className="border border-line rounded-lg px-2 py-1.5 text-sm">
            <option value="">— nivel 1 —</option>
            {categories.filter((c) => !c.parent_id).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="bg-brand text-white text-sm font-semibold rounded-lg px-4 py-1.5 hover:opacity-90">
          Adaugă
        </button>
      </form>

      <div className="bg-white border border-line rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left text-muted">
            <tr>
              <th className="px-4 py-2">Categorie</th>
              <th className="px-4 py-2">URL</th>
              <th className="px-4 py-2 text-right">Produse</th>
              <th className="px-4 py-2 text-right">Acțiuni</th>
            </tr>
          </thead>
          <tbody>
            {ordered.map(({ cat, level }) => (
              <CategoryRow key={cat.id} cat={cat} all={categories} level={level} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
