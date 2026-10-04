'use client'

import { useEffect, useRef, useState } from 'react'
import { SlidersHorizontal, X } from 'lucide-react'
import { BrandFilter } from './BrandFilter'
import type { BrandOption, ListingSort } from '@/lib/listing-filters'

// Butonul „Filtre” + panoul de jos (bottom sheet) de pe mobil/tableta (sub lg, unde coloana de
// filtre e ascunsa). Folosim <dialog> nativ cu showModal(): browserul se ocupa de Esc, de
// blocarea focusului in panou, de aria-modal si de intoarcerea focusului pe buton la inchidere.
// Continutul se randeaza doar cat panoul e deschis (lista de marci nu se dubleaza in HTML).
// Fara JavaScript butonul nu face nimic — atunci coloana de filtre se afiseaza si pe mobil
// (regula <noscript> din pagina categoriei).

interface Props {
  basePath: string
  options: BrandOption[]
  selected: string[]
  sort: ListingSort
  tot: boolean
  total: number
}

export function MobileFilters(props: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [open, setOpen] = useState(false)
  const titleId = 'filtre-mobil-titlu'

  function show() {
    dialogRef.current?.showModal()
    setOpen(true)
  }
  function close() {
    dialogRef.current?.close()
  }

  // Pagina din spate nu se mai deruleaza cat panoul e deschis
  useEffect(() => {
    if (!open) return
    const prev = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
    return () => { document.documentElement.style.overflow = prev }
  }, [open])

  const count = props.selected.length

  return (
    <>
      <button
        type="button"
        onClick={show}
        aria-haspopup="dialog"
        className="lg:hidden inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium text-[var(--color-text)] hover:border-brand hover:text-brand transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1"
      >
        <SlidersHorizontal size={15} aria-hidden="true" />
        Filtre
        {count > 0 && (
          <span className="ml-0.5 inline-flex min-w-5 h-5 items-center justify-center rounded-full bg-brand px-1.5 text-xs font-semibold text-white">
            {count}
            <span className="sr-only">{count === 1 ? ' marcă bifată' : ' mărci bifate'}</span>
          </span>
        )}
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        onClose={() => setOpen(false)}
        // click pe fundalul intunecat (in afara panoului) = inchide
        onClick={e => { if (e.target === e.currentTarget) close() }}
        className="lg:hidden fixed inset-x-0 bottom-0 top-auto m-0 w-full max-w-none max-h-[85dvh] rounded-t-2xl border border-line bg-surface p-0 text-[var(--color-text)] shadow-xl backdrop:bg-black/40"
      >
        <div className="flex max-h-[85dvh] flex-col">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 id={titleId} className="text-base font-semibold">Filtre</h2>
            <button
              type="button"
              onClick={close}
              aria-label="Închide filtrele"
              className="-m-1.5 rounded p-1.5 text-muted hover:text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>
          <div className="overflow-y-auto overscroll-contain px-4 pt-3">
            {open && <BrandFilter {...props} mode="panel" onApplied={close} />}
          </div>
        </div>
      </dialog>
    </>
  )
}
