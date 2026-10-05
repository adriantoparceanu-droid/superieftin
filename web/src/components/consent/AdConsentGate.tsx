'use client'

import { useEffect, useState } from 'react'
import { hasAdConsent, CONSENT_CHANGE_EVENT } from '@/lib/consent'

// Are voie bannerul HTML de afiliere sa se incarce? DA doar daca vizitatorul a acceptat
// categoria „Publicitate” SI ecranul e cel putin `minWidth` (desktop).
// Intoarce `null` pana dupa montare (pe server si la prima hidratare nu stim inca) —
// apelantul decide ce arata intre timp; scripturile se incarca DOAR la `true`.
//
// De ce: bannerele HTML Profitshare incarca scripturi care seteaza cookie-ul PROFITSHARESESSID
// la simpla vizita (GDPR: nu fara consimtamant). Pe mobil nu le afisam deloc — un iframe
// ascuns doar cu CSS se incarca oricum (~770 KB, homepage LCP 9 s pe mobil).
export function useAdAllowed(minWidth = 1024): boolean | null {
  const [allowed, setAllowed] = useState<boolean | null>(null)

  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${minWidth}px)`)
    const update = () => setAllowed(hasAdConsent() && mq.matches)
    update()
    mq.addEventListener('change', update)
    window.addEventListener(CONSENT_CHANGE_EVENT, update)
    return () => {
      mq.removeEventListener('change', update)
      window.removeEventListener(CONSENT_CHANGE_EVENT, update)
    }
  }, [minWidth])

  return allowed
}

// Randeaza `children` DOAR cand useAdAllowed e `true`. Altfel (inclusiv pe server si la prima
// hidratare) → `fallback`; bannerul apare abia dupa ce stim, in browser, alegerea si latimea.
export function AdConsentGate({ children, fallback = null, minWidth = 1024 }: {
  children: React.ReactNode
  fallback?: React.ReactNode
  minWidth?: number
}) {
  const allowed = useAdAllowed(minWidth)
  return <>{allowed ? children : fallback}</>
}
