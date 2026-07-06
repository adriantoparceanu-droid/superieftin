'use client'

import { useState, useRef, useEffect } from 'react'
import { CategoryIcon, CATEGORY_ICON_NAMES } from '@/components/CategoryIcon'

// Picker vizual de iconite: afiseaza iconitele intr-o grila cu cautare. Valoarea aleasa
// (cheia kebab din CategoryIcon) se trimite prin input-ul ascuns `name`, deci se comporta
// ca un camp normal in orice <form> (creare sau editare categorie).
export function IconPicker({ name = 'icon', defaultValue = null }: { name?: string; defaultValue?: string | null }) {
  const [value, setValue] = useState(defaultValue ?? '')
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  // Inchide pickerul la click in afara
  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const filtered = q
    ? CATEGORY_ICON_NAMES.filter((n) => n.includes(q.toLowerCase()))
    : CATEGORY_ICON_NAMES

  return (
    <div className="relative" ref={ref}>
      <input type="hidden" name={name} value={value} />
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Alege iconiță"
        className="flex items-center gap-1.5 border border-line rounded px-2 py-1 text-xs hover:border-brand"
      >
        <CategoryIcon name={value || undefined} className="w-4 h-4 text-brand shrink-0" />
        <span className="text-muted truncate max-w-24">{value || '(fără)'}</span>
        <span className="text-muted">▾</span>
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-64 bg-white border border-line rounded-lg shadow-lg p-2">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="caută iconiță..."
            className="w-full border border-line rounded px-2 py-1 text-xs mb-2"
          />
          <div className="grid grid-cols-7 gap-1 max-h-52 overflow-auto">
            <button
              type="button"
              title="(fără)"
              onClick={() => { setValue(''); setOpen(false) }}
              className={`flex items-center justify-center h-8 rounded text-muted hover:bg-surface ${value === '' ? 'ring-1 ring-brand bg-brand/10' : ''}`}
            >
              ∅
            </button>
            {filtered.map((n) => (
              <button
                key={n}
                type="button"
                title={n}
                onClick={() => { setValue(n); setOpen(false) }}
                className={`flex items-center justify-center h-8 rounded hover:bg-surface ${value === n ? 'ring-1 ring-brand bg-brand/10' : ''}`}
              >
                <CategoryIcon name={n} className="w-4 h-4" />
              </button>
            ))}
            {!filtered.length && (
              <p className="col-span-7 text-xs text-muted text-center py-3">Nicio iconiță găsită</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
