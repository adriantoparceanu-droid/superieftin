'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

// Tine comutatorul GA window['ga-disable-<ID>'] sincronizat cu pagina curenta la navigarea
// FARA reincarcare (ex. „← Vezi site-ul” din admin): pe /admin/* GA4 nu trimite nimic, pe
// restul site-ului masoara normal. Prima incarcare e acoperita de scriptul ga4-init.
export function isAdminPath(pathname: string): boolean {
  return /^\/admin(\/|$)/.test(pathname)
}

export function GaAdminOptOut({ gaId }: { gaId: string }) {
  const pathname = usePathname()
  useEffect(() => {
    ;(window as unknown as Record<string, unknown>)[`ga-disable-${gaId}`] = isAdminPath(pathname)
  }, [gaId, pathname])
  return null
}
