'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { readConsent, saveConsent, OPEN_SETTINGS_EVENT } from '@/lib/consent'

// Banner de cookies propriu. Reguli (GDPR + politica Google):
// - apare pana cand vizitatorul alege; nimic neesential nu porneste inainte (Consent Mode = denied)
// - „Refuz” e la fel de vizibil ca „Accept” (acelasi stil, aceeasi dimensiune)
// - alegerea se poate schimba oricand din footer („Setări cookies”)
// - „Publicitate” include si reclamele personalizate (remarketing) — decizia proprietarului,
//   2026-10-03: fara bifa separata; detaliile stau in /cookies si /confidentialitate (lib/consent.ts)
export function CookieBanner() {
  const [open, setOpen] = useState(false)
  const [details, setDetails] = useState(false)
  const [analytics, setAnalytics] = useState(false)
  const [ads, setAds] = useState(false)

  useEffect(() => {
    // Cookie-ul se citeste doar in browser → decidem dupa hidratare (evita mismatch SSR)
    const saved = readConsent()
    if (!saved) setOpen(true)

    const reopen = () => {
      const c = readConsent()
      setAnalytics(c?.analytics ?? false)
      setAds(c?.ads ?? false)
      setDetails(true)
      setOpen(true)
    }
    window.addEventListener(OPEN_SETTINGS_EVENT, reopen)
    return () => window.removeEventListener(OPEN_SETTINGS_EVENT, reopen)
  }, [])

  if (!open) return null

  const choose = (choice: { analytics: boolean; ads: boolean }) => {
    saveConsent(choice)
    setOpen(false)
    setDetails(false)
  }

  // Butoanele Accept / Refuz au intentionat acelasi stil (cerinta: refuzul la fel de usor)
  const primaryBtn = 'px-4 py-2 rounded-lg text-sm font-semibold bg-brand hover:bg-brand-dark text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2'
  const linkBtn = 'text-sm text-muted underline underline-offset-2 hover:text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded'

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Setări cookies"
      className="fixed inset-x-0 bottom-0 z-50 p-3 sm:p-4"
    >
      <div className="max-w-3xl mx-auto bg-white border border-line rounded-xl shadow-lg p-4 sm:p-5">
        <p className="text-sm text-[var(--color-text)]">
          Folosim cookie-uri necesare pentru funcționarea site-ului. Cu acordul tău, folosim și
          cookie-uri de <strong>analiză</strong> (Google Analytics) și de{' '}
          <strong>publicitate</strong> (Google Ads și bannerele partenerului Profitshare), ca să știm ce pagini sunt utile și ce
          reclame funcționează; publicitatea include și reclame personalizate (remarketing). Detalii în{' '}
          <Link href="/cookies" className="underline underline-offset-2">Politica de cookies</Link>.
        </p>

        {details && (
          <fieldset className="mt-4 space-y-3 border-t border-line pt-4">
            <legend className="sr-only">Categorii de cookie-uri</legend>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" checked disabled className="mt-0.5" />
              <span><strong>Necesare</strong> — țin minte alegerea ta și fac site-ul să funcționeze. Mereu active.</span>
            </label>
            <label className="flex items-start gap-3 text-sm cursor-pointer">
              <input type="checkbox" checked={analytics} onChange={(e) => setAnalytics(e.target.checked)} className="mt-0.5 accent-[var(--color-brand)]" />
              <span><strong>Analiză</strong> — Google Analytics: ce pagini sunt vizitate, prin statistici agregate (cu un identificator de vizitator în cookie).</span>
            </label>
            <label className="flex items-start gap-3 text-sm cursor-pointer">
              <input type="checkbox" checked={ads} onChange={(e) => setAds(e.target.checked)} className="mt-0.5 accent-[var(--color-brand)]" />
              <span><strong>Publicitate</strong> — Google Ads: măsurăm dacă o reclamă a adus o vizită care a dus la o cumpărare și îți putem arăta din nou reclamele noastre în Google (reclame personalizate). Tot aici: bannerele partenerului Profitshare de pe prima pagină, care își setează propriile cookie-uri.</span>
            </label>
          </fieldset>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button type="button" className={primaryBtn} onClick={() => choose({ analytics: true, ads: true })}>
            Accept toate
          </button>
          <button type="button" className={primaryBtn} onClick={() => choose({ analytics: false, ads: false })}>
            Refuz toate
          </button>
          {details ? (
            <button type="button" className={linkBtn + ' ml-auto'} onClick={() => choose({ analytics, ads })}>
              Salvez alegerea
            </button>
          ) : (
            <button type="button" className={linkBtn + ' ml-auto'} onClick={() => setDetails(true)}>
              Personalizez
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
