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
        // „.tb-btn” din machetă: contur, 40 px, numărul de filtre active pe pastila roșie
        className="lg:hidden inline-flex h-10 shrink-0 items-center gap-[7px] rounded-[10px] bg-surface px-3 text-sm font-bold text-ink ring-[1.5px] ring-inset ring-line-2 transition-shadow hover:ring-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
      >
        <SlidersHorizontal size={17} aria-hidden="true" />
        Filtre
        {count > 0 && (
          <span className="inline-grid min-w-[19px] h-[19px] place-items-center rounded-full bg-red px-[5px] text-[11px] font-bold tabular-nums text-white">
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
        // Foaia de jos din machetă („.sheet”): colțuri de 20 px sus, mâner, fundal întunecat 55%
        className="lg:hidden fixed inset-x-0 bottom-0 top-auto m-0 w-full max-w-none max-h-[86dvh] rounded-t-[20px] bg-surface p-0 text-ink shadow-pop backdrop:bg-[rgba(8,9,11,.55)]"
      >
        <div className="flex max-h-[86dvh] flex-col">
          <div aria-hidden="true" className="mx-auto mt-2 h-[5px] w-10 shrink-0 rounded-full bg-line-2" />
          <div className="flex shrink-0 items-center justify-between border-b border-line py-1.5 pl-4 pr-2">
            <h2 id={titleId} className="text-xl font-extrabold">Filtre</h2>
            <button
              type="button"
              onClick={close}
              aria-label="Închide filtrele"
              className="grid h-11 w-11 place-items-center rounded-[10px] text-ink hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
            >
              <X size={22} aria-hidden="true" />
            </button>
          </div>
          <div className="overflow-y-auto overscroll-contain px-4 pt-3.5">
            {open && <BrandFilter {...props} mode="panel" onApplied={close} />}
          </div>
        </div>
      </dialog>
    </>
  )
}
