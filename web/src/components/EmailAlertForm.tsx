'use client'

import { useId, useState } from 'react'
import Link from 'next/link'
import { gaEvent } from '@/lib/ga'

// Formularul de alerta pe email de pe /p/ (double opt-in: POST /api/alerte-email → email de
// confirmare). Apare doar daca emailul e configurat pe server (lib/email-alerts.ts).
//
// Anti-abuz fara captcha: limita per IP pe server + campul-capcana „website”, ascuns oamenilor
// (in afara ecranului, fara tab, ignorat de cititoarele de ecran), pe care robotii il completeaza.

interface Props {
  productId: string
  offerId: string | null
  defaultTarget: number | null   // pragul propus (lib/price-alert.ts); null = produs indisponibil
  category: string | null
  price: number | null
}

const input = 'w-full border border-line rounded-lg px-3 py-2 text-sm bg-surface text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand'
const submitBtn = 'bg-brand hover:bg-brand-dark disabled:opacity-60 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2'

// Pragul afisat in romana: 1610 → „1610”, 1299.9 → „1299,9” (fara separator de mii, usor de editat)
const fmtTarget = (n: number | null) => (n == null ? '' : String(n).replace('.', ','))

export function EmailAlertForm({ productId, offerId, defaultTarget, category, price }: Props) {
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const id = useId()

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm text-brand underline underline-offset-2 hover:text-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded"
        aria-expanded="false"
        aria-controls={`${id}-form`}
      >
        Prefer alerta pe email
      </button>
    )
  }

  if (state === 'done') {
    return <p role="status" id={`${id}-form`} className="rounded-lg bg-green-50 border border-green-200 text-green-900 px-3 py-2 text-sm">{message}</p>
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setState('sending')
    try {
      const res = await fetch('/api/alerte-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: Number(productId),
          offerId: offerId ? Number(offerId) : null,
          email: fd.get('email'),
          target: fd.get('target'),
          consent: fd.get('consent') === 'on',
          website: fd.get('website'),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.ok) {
        setState('done')
        setMessage(data.message)
        // Fara date personale: doar produsul si canalul (adresa NU pleaca spre Google)
        gaEvent('price_alert_click', {
          product_id: productId, category: category ?? undefined, price: price ?? undefined,
          channel: 'email', placement: 'formular',
        })
      } else {
        setState('error')
        setMessage(data.error || 'Nu am putut trimite cererea. Încearcă din nou.')
      }
    } catch {
      setState('error')
      setMessage('Nu am putut trimite cererea. Verifică conexiunea și încearcă din nou.')
    }
  }

  return (
    <form id={`${id}-form`} onSubmit={onSubmit} className="space-y-2 rounded-lg border border-line p-3" noValidate={false}>
      <div className="grid grid-cols-[1fr_7rem] gap-2">
        <label className="text-xs text-muted">
          Adresa de email
          <input name="email" type="email" required autoComplete="email" inputMode="email" maxLength={254} className={`mt-0.5 ${input}`} />
        </label>
        <label className="text-xs text-muted">
          Prag (lei)
          <input name="target" required inputMode="decimal" defaultValue={fmtTarget(defaultTarget)} maxLength={12} className={`mt-0.5 tabular-nums ${input}`} />
        </label>
      </div>
      {/* Capcana pentru roboti — nu o completa */}
      <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}>
        <label>Website<input name="website" type="text" tabIndex={-1} autoComplete="off" /></label>
      </div>
      <label className="flex items-start gap-2 text-xs text-muted">
        <input name="consent" type="checkbox" required className="mt-0.5" />
        <span>
          Sunt de acord să primesc pe email alerte de preț pentru acest produs (cel mult un email pe
          zi, dezabonare oricând). Detalii în <Link href="/confidentialitate" className="underline">Confidențialitate</Link>.
        </span>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={state === 'sending'} className={submitBtn}>
          {state === 'sending' ? 'Se trimite…' : 'Trimite-mi alerta pe email'}
        </button>
        <span className="text-xs text-muted">Primești întâi un email de confirmare.</span>
      </div>
      {state === 'error' && <p role="alert" className="text-sm text-red-700">{message}</p>}
    </form>
  )
}

// „Trimite-mi din nou linkul către Alertele mele” (pagina /alerte/gestionare cu link expirat)
export function RequestManageLinkForm() {
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setState('sending')
    try {
      const res = await fetch('/api/alerte-email/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: fd.get('email'), website: fd.get('website') }),
      })
      const data = await res.json().catch(() => ({}))
      setState(res.ok ? 'done' : 'error')
      setMessage(data.message || data.error || 'Nu am putut trimite cererea.')
    } catch {
      setState('error')
      setMessage('Nu am putut trimite cererea. Încearcă din nou.')
    }
  }

  if (state === 'done') return <p role="status" className="rounded-lg bg-green-50 border border-green-200 text-green-900 px-3 py-2 text-sm">{message}</p>

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-2">
      <label className="text-xs text-muted flex-1 min-w-[14rem]">
        Adresa de email
        <input name="email" type="email" required autoComplete="email" className={`mt-0.5 ${input}`} />
      </label>
      <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}>
        <label>Website<input name="website" type="text" tabIndex={-1} autoComplete="off" /></label>
      </div>
      <button type="submit" disabled={state === 'sending'} className={submitBtn}>Trimite-mi linkul</button>
      {state === 'error' && <p role="alert" className="w-full text-sm text-red-700">{message}</p>}
    </form>
  )
}
