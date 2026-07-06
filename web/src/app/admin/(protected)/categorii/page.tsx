import { createCategoryAction } from '@/lib/admin/actions'
import { getCategoriesTree } from '@/lib/admin/queries'
import { CategoryBuilder } from '@/components/admin/CategoryBuilder'
import { IconPicker } from '@/components/admin/IconPicker'

export default async function CategoriiPage() {
  const categories = await getCategoriesTree()

  // Cheia se schimbă la orice modificare server (editare/vizibilitate/ștergere/reordonare),
  // forțând re-inițializarea builder-ului cu datele proaspete.
  const dataKey = categories.map((c) => `${c.id}.${c.parent_id}.${c.sort_order}.${c.is_visible ? 1 : 0}.${c.icon ?? ''}.${c.name}`).join('|')

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold mb-2">Categorii</h1>
      <p className="text-sm text-muted mb-6">
        Trage categoriile (mânerul ⠿) pentru a le reordona; trage spre dreapta ca să le imbrici sub alta
        (maxim 2 niveluri). Ordinea de aici dă și ordinea din grila „Categorii” de pe homepage.
      </p>

      <form action={createCategoryAction} className="bg-white border border-line rounded-xl p-4 flex flex-wrap items-end gap-3 mb-6">
        <div>
          <label className="block text-xs text-muted mb-1">Nume categorie nouă</label>
          <input name="name" required className="border border-line rounded-lg px-3 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Iconiță</label>
          <IconPicker name="icon" />
        </div>
        <button type="submit" className="bg-brand text-white text-sm font-semibold rounded-lg px-4 py-1.5 hover:opacity-90">
          Adaugă
        </button>
      </form>

      <CategoryBuilder key={dataKey} categories={categories} />
    </div>
  )
}
