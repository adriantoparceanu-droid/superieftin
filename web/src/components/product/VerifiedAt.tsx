'use client'

import { useSyncExternalStore } from 'react'
import { verifiedLabel } from '@/lib/verdict'

// „Verificat azi, 06:40” — din `last_checked` real. Pagina e în cache (ISR, o oră), deci „azi” /
// „ieri” se calculează în browser, la afișare. Pe server (și fără JS) apare data completă
// („Verificat pe 5 oct., 06:40”), care e adevărată oricând.
export function VerifiedAt({ iso, className }: { iso: string; className?: string }) {
  // Server + hidratare: data completă (`now` = 1970 → niciodată „azi”); după hidratare, în browser: relativ
  const label = useSyncExternalStore(noop, () => verifiedLabel(iso), () => verifiedLabel(iso, new Date(0)))
  return <time dateTime={iso} className={className}>{label}</time>
}

const noop = () => () => {}
