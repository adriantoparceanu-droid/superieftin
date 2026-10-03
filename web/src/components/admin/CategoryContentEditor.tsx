'use client'

import { useActionState, useState, useTransition } from 'react'
import { saveCategoryContentAction } from '@/lib/admin/category-content-actions'
import type { CategoryFaqItem } from '@/lib/category-markers'

const input = 'w-full border border-line rounded-lg px-3 py-1.5 text-sm bg-white'
const MAX_FAQ = 6 // la fel ca MAX_FAQ din lib/category-markers.ts

// Editorul textului de categorie: campuri controlate (state React), ca textul sa nu se piarda
// cand salvarea e respinsa de validare (dupa o actiune de server React reseteaza formularele).
export function CategoryContentEditor({ id, intro: initialIntro, faq: initialFaq }: {
  id: number
  intro: string
  faq: CategoryFaqItem[]
}) {
  const [state, formAction, pending] = useActionState(saveCategoryContentAction, null)
  const [intro, setIntro] = useState(initialIntro)
  const [faq, setFaq] = useState<CategoryFaqItem[]>(initialFaq)
  const [, startSave] = useTransition()

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startSave(() => formAction(fd))
  }

  const setItem = (i: number, key: 'q' | 'a', value: string) =>
    setFaq((cur) => cur.map((f, j) => (j === i ? { ...f, [key]: value } : f)))
  const move = (i: number, d: -1 | 1) =>
    setFaq((cur) => {
      const j = i + d
      if (j < 0 || j >= cur.length) return cur
      const next = [...cur]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="faq" value={JSON.stringify(faq)} />

      <div>
        <label htmlFor="intro_md" className="block text-sm font-semibold mb-1">Text introductiv (Markdown)</label>
        <textarea
          id="intro_md"
          name="intro_md"
          value={intro}
          onChange={(e) => setIntro(e.target.value)}
          rows={12}
          className={`${input} font-mono`}
        />
        <p className="text-xs text-muted mt-1">
          Paragrafe separate printr-un rând gol. Linkuri: <code>[text](/c/laptopuri)</code>. Cifrele doar prin marcaje (tabelul de mai jos) — nu scrie prețuri sau procente de mână.
        </p>
      </div>

      <div>
        <p className="text-sm font-semibold mb-2">Întrebări frecvente ({faq.length}/{MAX_FAQ})</p>
        <div className="space-y-3">
          {faq.map((f, i) => (
            <div key={i} className="border border-line rounded-lg p-3 bg-white space-y-2">
              <div className="flex gap-2 items-center">
                <span className="text-xs text-muted w-5">{i + 1}.</span>
                <input
                  aria-label={`Întrebarea ${i + 1}`}
                  value={f.q}
                  onChange={(e) => setItem(i, 'q', e.target.value)}
                  placeholder="Întrebarea"
                  className={input}
                />
                <button type="button" onClick={() => move(i, -1)} className="text-muted hover:text-brand px-1" title="Mută sus">↑</button>
                <button type="button" onClick={() => move(i, 1)} className="text-muted hover:text-brand px-1" title="Mută jos">↓</button>
                <button type="button" onClick={() => setFaq((cur) => cur.filter((_, j) => j !== i))} className="text-red-600 text-xs hover:underline">șterge</button>
              </div>
              <textarea
                aria-label={`Răspunsul ${i + 1}`}
                value={f.a}
                onChange={(e) => setItem(i, 'a', e.target.value)}
                placeholder="Răspunsul (Markdown, marcaje permise)"
                rows={3}
                className={input}
              />
            </div>
          ))}
        </div>
        {faq.length < MAX_FAQ && (
          <button type="button" onClick={() => setFaq((cur) => [...cur, { q: '', a: '' }])} className="mt-2 text-sm text-brand hover:underline">
            + Adaugă o întrebare
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="bg-brand text-white text-sm font-semibold rounded-lg px-4 py-1.5 hover:opacity-90 disabled:opacity-50">
          {pending ? 'Se salvează…' : 'Salvează'}
        </button>
        {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
        {state?.message && <p className="text-sm text-green-700">{state.message}</p>}
      </div>
    </form>
  )
}
