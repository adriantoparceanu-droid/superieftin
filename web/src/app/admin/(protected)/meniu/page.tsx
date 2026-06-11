import {
  createMenuItemAction, toggleMenuItemAction, moveMenuItemAction, deleteMenuItemAction,
} from '@/lib/admin/actions'
import { getMenuItemsAdmin, getCategoriesTree, type AdminMenuItem } from '@/lib/admin/queries'

function MenuRow({ item, level }: { item: AdminMenuItem; level: number }) {
  return (
    <tr className="border-t border-line">
      <td className="px-4 py-2 font-medium">
        <span className="text-muted">{level > 0 ? '└ ' : ''}</span>{item.label}
      </td>
      <td className="px-4 py-2 text-xs text-muted">
        {item.category_slug ? `/c/${item.category_slug}` : item.url}
      </td>
      <td className="px-4 py-2">
        <div className="flex items-center gap-1 justify-end">
          <form action={moveMenuItemAction}><input type="hidden" name="id" value={item.id} /><input type="hidden" name="direction" value="up" /><button className="px-1 text-muted hover:text-brand">↑</button></form>
          <form action={moveMenuItemAction}><input type="hidden" name="id" value={item.id} /><input type="hidden" name="direction" value="down" /><button className="px-1 text-muted hover:text-brand">↓</button></form>
          <form action={toggleMenuItemAction}><input type="hidden" name="id" value={item.id} /><button className="px-1" title={item.is_visible ? 'Ascunde' : 'Afișează'}>{item.is_visible ? '👁' : '🚫'}</button></form>
          <form action={deleteMenuItemAction}><input type="hidden" name="id" value={item.id} /><button className="text-red-600 text-xs hover:underline px-1">șterge</button></form>
        </div>
      </td>
    </tr>
  )
}

export default async function MeniuPage() {
  const [items, categories] = await Promise.all([getMenuItemsAdmin(), getCategoriesTree()])
  const ordered: { item: AdminMenuItem; level: number }[] = []
  for (const top of items.filter((i) => !i.parent_id)) {
    ordered.push({ item: top, level: 0 })
    for (const child of items.filter((i) => i.parent_id === top.id)) {
      ordered.push({ item: child, level: 1 })
    }
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-2">Meniu</h1>
      <p className="text-sm text-muted mb-6">Meniul din headerul site-ului. O intrare arată fie spre o categorie, fie spre un link custom.</p>

      <form action={createMenuItemAction} className="bg-white border border-line rounded-xl p-4 flex flex-wrap items-end gap-3 mb-6">
        <div>
          <label className="block text-xs text-muted mb-1">Etichetă</label>
          <input name="label" required className="border border-line rounded-lg px-3 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Categorie</label>
          <select name="category_id" className="border border-line rounded-lg px-2 py-1.5 text-sm">
            <option value="">— sau link custom →</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Link custom</label>
          <input name="url" placeholder="/cautare?q=..." className="border border-line rounded-lg px-3 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Sub itemul</label>
          <select name="parent_id" className="border border-line rounded-lg px-2 py-1.5 text-sm">
            <option value="">— nivel 1 —</option>
            {items.filter((i) => !i.parent_id).map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
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
              <th className="px-4 py-2">Etichetă</th>
              <th className="px-4 py-2">Destinație</th>
              <th className="px-4 py-2 text-right">Acțiuni</th>
            </tr>
          </thead>
          <tbody>
            {ordered.map(({ item, level }) => <MenuRow key={item.id} item={item} level={level} />)}
            {!ordered.length && (
              <tr><td colSpan={3} className="px-4 py-6 text-center text-muted">Meniul e gol.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
