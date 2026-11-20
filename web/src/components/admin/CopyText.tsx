'use client'

import { useState } from 'react'

// Buton mic „copiază” (Admin → Cercetare): pune textul in clipboard — slug-ul produsului sau
// marcajul gata de lipit in articol ({{oferte:<slug>}}). Fara clipboard (context nesigur, http
// pe alt host decat localhost) textul ramane oricum vizibil si selectabil langa buton.
export function CopyText({ text, label = 'copiază', title }: { text: string; label?: string; title?: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      title={title ?? `Copiază: ${text}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setDone(true)
          setTimeout(() => setDone(false), 1500)
        } catch {
          // clipboard indisponibil — utilizatorul poate selecta textul de mana
        }
      }}
      className="text-xs text-brand hover:underline whitespace-nowrap"
    >
      {done ? 'copiat ✓' : label}
    </button>
  )
}
