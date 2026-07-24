'use client'

import { useMemo, useState } from 'react'
import { addScraperCategoryAction } from '@/lib/admin/actions'
import type { AvailableCategory, CategoryOption } from '@/lib/admin/queries'

// Cautare fara diacritice: 'mașini' gaseste 'Masini de spalat rufe'
function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

// Formular de adaugare categorie scanata: cauta in catalogul adus de worker din sitemap-ul
// eMAG, completeaza automat path + eticheta la selectie, iar tu alegi categoria de site
// tinta (produsele se mapeaza automat acolo). Cu catalogul gol, path-ul se poate scrie manual.
export default function ScraperCategoryPicker({
  available, categories,
}: { available: AvailableCategory[]; categories: CategoryOption[] }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [path, setPath] = useState('')
  const [label, setLabel] = useState('')
  const [categoryId, setCategoryId] = useState('')

  const matches = useMemo(() => {
    const q = norm(query.trim())
    if (q.length < 2) return []
    return available.filter((c) => norm(c.label).includes(q) || c.path.includes(q)).slice(0, 30)
  }, [query, available])

  function select(c: AvailableCategory) {
    setPath(c.path)
    setLabel(c.label)
    // Sugereaza categoria de site cu numele cel mai apropiat de eticheta eMAG
    const guess = categories.find((o) => norm(o.label).includes(norm(c.label)) || norm(c.label).includes(norm(o.label.split('›').pop() ?? '')))
    if (guess) setCategoryId(String(guess.id))
    setQuery(c.label)
    setOpen(false)
  }

  async function submit(formData: FormData) {
    await addScraperCategoryAction(formData)
    setQuery(''); setPath(''); setLabel(''); setCategoryId('')
  }

  return (
    <form action={submit} className="bg-white border border-line rounded-xl p-4 mb-6">
      {available.length > 0 ? (
        <div className="relative mb-3">
          <label className="block text-xs text-muted mb-1">
            Caută categoria eMAG ({available.length} în catalog)
          </label>
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            placeholder="ex. masini de spalat"
            className="border border-line rounded-lg px-3 py-1.5 text-sm w-full max-w-md"
          />
          {open && matches.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full max-w-md max-h-64 overflow-y-auto bg-white border border-line rounded-lg shadow-lg">
              {matches.map((c) => (
                <li key={c.path}>
                  <button
                    type="button"
                    disabled={c.taken}
                    onMouseDown={(e) => { e.preventDefault(); if (!c.taken) select(c) }}
                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-surface disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="font-medium">{c.label}</span>{' '}
                    <span className="text-muted">/{c.path}</span>
                    {c.taken && <span className="text-muted"> — deja adăugată</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted mb-3">
          Catalogul de categorii e gol — apasă „Actualizează lista din eMAG&rdquo; de mai sus
          (worker-ul trebuie să ruleze) sau completează câmpurile manual.
        </p>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-muted mb-1">Path categorie eMAG</label>
          <input
            name="path" required value={path} onChange={(e) => setPath(e.target.value)}
            placeholder="ex. telefoane-mobile"
            className="border border-line rounded-lg px-3 py-1.5 text-sm w-48"
          />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Etichetă (admin)</label>
          <input
            name="label" required value={label} onChange={(e) => setLabel(e.target.value)}
            placeholder="ex. Telefoane mobile"
            className="border border-line rounded-lg px-3 py-1.5 text-sm w-48"
          />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Categorie site (mapare)</label>
          <select
            name="category_id" required value={categoryId} onChange={(e) => setCategoryId(e.target.value)}
            className="border border-line rounded-lg px-3 py-1.5 text-sm w-56 bg-white"
          >
            <option value="">— alege categoria —</option>
            {categories.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Max pagini</label>
          <input
            name="max_pages" type="number" min={1} max={20} defaultValue={3}
            className="border border-line rounded-lg px-3 py-1.5 text-sm w-20"
          />
        </div>
        <button type="submit" className="bg-brand text-white text-sm font-semibold rounded-lg px-4 py-1.5 hover:opacity-90">
          Adaugă categorie
        </button>
      </div>
    </form>
  )
}
