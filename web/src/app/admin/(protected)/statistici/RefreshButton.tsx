'use client'

import { useFormStatus } from 'react-dom'

// Butonul din formularul „Actualizează acum”. Componenta client doar ca sa arate „Se trimite…”
// cat timp server action-ul pune jobul in coada (altfel un click pare sa nu faca nimic).
export function RefreshButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="border border-line bg-white text-sm rounded-lg px-3 py-1.5 hover:bg-surface disabled:opacity-60"
    >
      {pending ? 'Se trimite…' : '⟳ Actualizează acum'}
    </button>
  )
}
