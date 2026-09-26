'use client'

import { useEffect, useState } from 'react'
import { hasAdConsent, CONSENT_CHANGE_EVENT } from '@/lib/consent'

// Randeaza `children` (ex. banner HTML de afiliere) DOAR daca vizitatorul a acceptat
// categoria „Publicitate” SI ecranul e cel putin `minWidth` (desktop). Altfel → `fallback`.
//
// De ce: bannerele HTML Profitshare incarca scripturi care seteaza cookie-ul PROFITSHARESESSID
// la simpla vizita (GDPR: nu fara consimtamant). Pe mobil nu le afisam deloc — un iframe
// ascuns doar cu CSS se incarca oricum (~770 KB, homepage LCP 9 s pe mobil).
//
// La randarea pe server si la prima hidratare se afiseaza `fallback`; bannerul apare abia
// dupa ce stim, in browser, alegerea si latimea ecranului.
export function AdConsentGate({ children, fallback = null, minWidth = 1024 }: {
  children: React.ReactNode
  fallback?: React.ReactNode
  minWidth?: number
}) {
  const [allowed, setAllowed] = useState(false)

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

  return <>{allowed ? children : fallback}</>
}
