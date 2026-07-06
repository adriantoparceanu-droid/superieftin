import { createMenuItemAction } from '@/lib/admin/actions'
import { getMenuItemsAdmin, getCategoriesTree } from '@/lib/admin/queries'
import { MenuBuilder } from '@/components/admin/MenuBuilder'

export default async function MeniuPage() {
  const [items, categories] = await Promise.all([getMenuItemsAdmin(), getCategoriesTree()])

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-2">Meniu</h1>
      <p className="text-sm text-muted mb-6">
        Meniul din headerul site-ului. Trage itemii pentru a-i reordona; trage spre dreapta ca să-i
        imbrici sub alt item (maxim 3 niveluri). O intrare arată fie spre o categorie, fie spre un link custom.
      </p>

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
        <button type="submit" className="bg-brand text-white text-sm font-semibold rounded-lg px-4 py-1.5 hover:opacity-90">
          Adaugă
        </button>
      </form>

      <MenuBuilder initialItems={items} />
    </div>
  )
}
