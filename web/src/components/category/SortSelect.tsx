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

  return (
    <form method="get" action={basePath} className="flex items-center gap-1.5" aria-busy={isPending}>
      {brands.map(b => <input key={b} type="hidden" name="brand" value={b} />)}
      {tot && <input type="hidden" name="tot" value="1" />}
      <label htmlFor="sortare-lista" className="text-sm text-muted">Sortare:</label>
      <div className="relative">
        <select
          id="sortare-lista"
          name="sort"
          defaultValue={sort}
          onChange={e => {
            const url = buildListingUrl(basePath, { sort: e.target.value as ListingSort, brands, tot })
            startTransition(() => router.push(url, { scroll: false }))
          }}
          className={`appearance-none rounded-lg border border-line bg-surface py-1.5 pl-3 pr-8 text-sm font-medium text-[var(--color-text)] cursor-pointer hover:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${isPending ? 'opacity-60' : ''}`}
        >
          {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {/* sageata ▾ (select-ul are appearance-none ca sa arate la fel in toate browserele) */}
        <ChevronDown size={16} aria-hidden="true" className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted" />
      </div>
      <noscript>
        <button type="submit" className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm">OK</button>
      </noscript>
    </form>
  )
}
