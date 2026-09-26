'use client'

import { openCookieSettings } from '@/lib/consent'

// Link din footer care redeschide bannerul, ca vizitatorul sa-si poata schimba alegerea
export function CookieSettingsButton({ className }: { className?: string }) {
  return (
    <button type="button" onClick={openCookieSettings} className={className}>
      Setări cookies
    </button>
  )
}
