'use client'

import { useState, useTransition } from 'react'
import { revealSubscriberEmailAction } from '@/lib/admin/actions'

// Adresa abonatului: mascat implicit; „arată” o cere de la server (sesiune admin) doar la click,
// deci adresa intreaga nu e in HTML-ul paginii. „ascunde” o scoate din nou din ecran.
export function RevealEmail({ id, masked }: { id: number; masked: string }) {
  const [email, setEmail] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <span className="inline-flex items-center gap-2">
      <span className="font-medium font-mono text-xs break-all">{email ?? masked}</span>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (email) return setEmail(null)
          startTransition(async () => setEmail((await revealSubscriberEmailAction(id)) ?? masked))
        }}
        className="text-xs text-brand hover:underline disabled:opacity-50"
      >
        {pending ? '…' : email ? 'ascunde' : 'arată'}
      </button>
    </span>
  )
}
