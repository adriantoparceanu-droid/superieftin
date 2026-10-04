'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import { buildListingUrl, SORT_OPTIONS, type ListingSort } from '@/lib/listing-filters'

// Meniul compact „Sortare: Preț mic ▾” de deasupra grilei. Un <select> nativ: pe mobil deschide
// selectorul sistemului, e accesibil din tastatura fara cod in plus. Cu JavaScript navigheaza
// la schimbare; fara JavaScript, formularul GET are butonul „OK” (in <noscript>).
// Marcile bifate si „vezi tot” se pastreaza; pagina se reseteaza.

interface Props {
  basePath: string
  sort: ListingSort
  brands: string[]
  tot: boolean
}

export function SortSelect({ basePath, sort, brands, tot }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // „.tb-btn.grow” din machetă: pe mobil ocupă restul barei lipicioase, lângă „Filtre”.
  // Eticheta „Sortare:” stă în chenar, înaintea valorii; tot chenarul e <select>-ul (atingerea
  // oriunde deschide selectorul sistemului).
  return (
    <form method="get" action={basePath} className="flex min-w-0 flex-1 items-center gap-1.5 lg:flex-none" aria-busy={isPending}>
      {brands.map(b => <input key={b} type="hidden" name="brand" value={b} />)}
      {tot && <input type="hidden" name="tot" value="1" />}
      <div className={`relative flex h-10 min-w-0 flex-1 items-center rounded-[10px] bg-surface ring-[1.5px] ring-inset ring-line-2 transition-shadow hover:ring-ink has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ink ${isPending ? 'opacity-60' : ''}`}>
        <label htmlFor="sortare-lista" className="pointer-events-none shrink-0 pl-3 text-sm font-semibold text-ink-3">Sortare:</label>
        <select
          id="sortare-lista"
          name="sort"
          defaultValue={sort}
          onChange={e => {
            const url = buildListingUrl(basePath, { sort: e.target.value as ListingSort, brands, tot })
            startTransition(() => router.push(url, { scroll: false }))
          }}
          className="h-full min-w-0 flex-1 cursor-pointer appearance-none truncate bg-transparent pl-1.5 pr-9 text-sm font-semibold text-ink focus-visible:outline-none"
        >
          {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {/* săgeata ▾ (select-ul are appearance-none ca să arate la fel în toate browserele) */}
        <ChevronDown size={17} aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-2" />
      </div>
      <noscript>
        <button type="submit" className="h-10 rounded-[10px] bg-surface px-3 text-sm font-bold text-ink ring-[1.5px] ring-inset ring-line-2">OK</button>
      </noscript>
    </form>
  )
}
