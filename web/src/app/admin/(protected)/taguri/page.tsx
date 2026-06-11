import { createTagAction, deleteTagAction } from '@/lib/admin/actions'
import { getTagsWithCounts } from '@/lib/admin/queries'

export default async function TaguriPage() {
  const tags = await getTagsWithCounts()

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">Taguri</h1>

      <form action={createTagAction} className="bg-white border border-line rounded-xl p-4 flex items-end gap-3 mb-6">
        <div className="flex-1">
          <label className="block text-xs text-muted mb-1">Tag nou (ex: Refurbished, 5G, Gaming)</label>
          <input name="name" required className="w-full border border-line rounded-lg px-3 py-1.5 text-sm" />
        </div>
        <button type="submit" className="bg-brand text-white text-sm font-semibold rounded-lg px-4 py-1.5 hover:opacity-90">
          Adaugă
        </button>
      </form>

      <div className="bg-white border border-line rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left text-muted">
            <tr>
              <th className="px-4 py-2">Tag</th>
              <th className="px-4 py-2">URL</th>
              <th className="px-4 py-2 text-right">Produse</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {tags.map((t) => (
              <tr key={t.id} className="border-t border-line">
                <td className="px-4 py-2 font-medium">{t.name}</td>
                <td className="px-4 py-2 text-xs text-muted">/t/{t.slug}</td>
                <td className="px-4 py-2 text-right">{t.product_count.toLocaleString('ro-RO')}</td>
                <td className="px-4 py-2 text-right">
                  <form action={deleteTagAction}>
                    <input type="hidden" name="id" value={t.id} />
                    <button type="submit" className="text-red-600 text-xs hover:underline">șterge</button>
                  </form>
                </td>
              </tr>
            ))}
            {!tags.length && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-muted">Niciun tag încă.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
