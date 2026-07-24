import {
  refreshEmagCatalogAction,
  toggleScraperCategoryAction,
  updateScraperCategoryMaxPagesAction,
  deleteScraperCategoryAction,
} from '@/lib/admin/actions'
import { getScraperCategories, getAvailableEmagCategories, getCategoryOptions } from '@/lib/admin/queries'
import ScraperCategoryPicker from '@/components/admin/ScraperCategoryPicker'

export default async function ScraperCategoriiPage() {
  const [categories, catalog, categoryOptions] = await Promise.all([
    getScraperCategories(),
    getAvailableEmagCategories(),
    getCategoryOptions(),
  ])

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-2">Categorii scanate — eMAG</h1>
      <p className="text-sm text-muted mb-6">
        eMAG nu oferă feed de produse — categoriile de mai jos sunt singurele scanate de scraper (nu tot site-ul).
        Dezactivează o categorie ca s-o scoți din scanare fără s-o ștergi, sau ajustează numărul de pagini
        (afectează direct câte produse și câte cereri se fac la eMAG per rulare).
      </p>

      <form action={refreshEmagCatalogAction} className="flex items-center gap-3 mb-3">
        <button type="submit" className="border border-line bg-white text-sm rounded-lg px-3 py-1.5 hover:bg-surface">
          ⟳ Actualizează lista din eMAG
        </button>
        <span className="text-xs text-muted">
          {catalog.lastSyncedAt
            ? `${catalog.categories.length} categorii în catalog, actualizat ${catalog.lastSyncedAt.toLocaleString('ro-RO', { dateStyle: 'short', timeStyle: 'short' })}`
            : 'Catalog gol — actualizarea rulează prin worker (durează câteva secunde).'}
        </span>
      </form>

      <ScraperCategoryPicker available={catalog.categories} categories={categoryOptions} />

      <div className="bg-white border border-line rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left text-muted">
            <tr>
              <th className="px-4 py-2">Etichetă</th>
              <th className="px-4 py-2">Path</th>
              <th className="px-4 py-2">Categorie site</th>
              <th className="px-4 py-2">Max pagini</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.id} className="border-t border-line">
                <td className="px-4 py-2 font-medium">{c.label}</td>
                <td className="px-4 py-2 text-muted">{c.path}</td>
                <td className="px-4 py-2 text-muted">{c.category_name ?? <span className="text-red-600">nemapată</span>}</td>
                <td className="px-4 py-2">
                  <form action={updateScraperCategoryMaxPagesAction} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={c.id} />
                    <input
                      name="max_pages"
                      type="number"
                      min={1}
                      max={20}
                      defaultValue={c.max_pages}
                      className="border border-line rounded-lg px-2 py-1 text-sm w-16"
                    />
                    <button type="submit" className="text-xs text-brand hover:underline">salvează</button>
                  </form>
                </td>
                <td className="px-4 py-2">
                  {c.enabled ? '✅ activă' : <span className="text-muted">— inactivă</span>}
                </td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  <form action={toggleScraperCategoryAction} className="inline">
                    <input type="hidden" name="id" value={c.id} />
                    <button type="submit" className="text-xs text-brand hover:underline mr-3">
                      {c.enabled ? 'dezactivează' : 'reactivează'}
                    </button>
                  </form>
                  <form action={deleteScraperCategoryAction} className="inline">
                    <input type="hidden" name="id" value={c.id} />
                    <button type="submit" className="text-xs text-red-600 hover:underline">șterge</button>
                  </form>
                </td>
              </tr>
            ))}
            {categories.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted">Nicio categorie configurată.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
