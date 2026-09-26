'use client'

import { useEffect } from 'react'
import { gaEvent } from '@/lib/ga'
import { maskPII } from '@/lib/pii'

// Eveniment GA4 standard 'search' — pe pagina de rezultate. Emailul/telefonul scrise din
// greseala in cautare se mascheaza (Google interzice date personale in Analytics).
export function TrackSearch({ term }: { term: string }) {
  useEffect(() => {
    if (term.trim()) gaEvent('search', { search_term: maskPII(term.trim()) })
  }, [term])

  return null
}
