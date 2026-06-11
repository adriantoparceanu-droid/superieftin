'use client'

import { useEffect } from 'react'
import { gaEvent } from '@/lib/ga'

// Eveniment GA4 standard 'search' — pe pagina de rezultate
export function TrackSearch({ term }: { term: string }) {
  useEffect(() => {
    if (term.trim()) gaEvent('search', { search_term: term.trim() })
  }, [term])

  return null
}
