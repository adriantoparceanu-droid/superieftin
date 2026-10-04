'use client'

import { useId, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import {
  buildListingUrl, countForSelection, filterBrandOptions, orderBrandOptions, MAX_BRANDS,
  type BrandOption, type ListingSort,
} from '@/lib/listing-filters'
import { roCount } from '@/lib/seo/site'

// Sectiunea „Marcă” din coloana de filtre (desktop) si din panoul „Filtre” (mobil).
//
// De ce un <form method="get"> adevarat: fara JavaScript browserul trimite singur casutele
// bifate ca ?brand=A&brand=B (+ sort/tot din campurile ascunse) → filtrul merge oricum.
// Cu JavaScript:
// - in coloana (mode="sidebar") fiecare bifare navigheaza imediat (fara buton „Aplică”);
// - in panoul de pe mobil (mode="panel") bifezi mai multe, apoi „Vezi N produse”.
// Navigarea e client-side (router.push), cu URL construit de buildListingUrl → fara sort=price
// sau page in URL; schimbarea marcilor reseteaza mereu pagina.

const VISIBLE_COUNT = 10   // cate marci se vad inainte de „Arată toate”

interface Props {
  basePath: string
  options: BrandOption[]
  selected: string[]
  sort: ListingSort
  tot: boolean
  total: number               // produsele listei fara filtru de marca (pentru „Vezi N produse”)
  mode: 'sidebar' | 'panel'
  onApplied?: () => void      // panoul de pe mobil se inchide dupa aplicare
}

export function BrandFilter({ basePath, options, selected, sort, tot, total, mode, onApplied }: Props) {
  const router = useRouter()
  const uid = useId()
  const [isPending, startTransition] = useTransition()
  // Starea locala = ce e bifat ACUM pe ecran (se vede imediat, inainte sa vina pagina noua).
  // Pagina da componentei un `key` din marcile din URL, deci dupa navigare starea porneste curata.
  const [checked, setChecked] = useState<string[]>(selected)
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState(false)

  // Ordinea vine din marcile din URL (nu din bifarile locale): altfel, in panou, o marca bifata
  // ar sari sus sub deget la fiecare atingere.
  const ordered = useMemo(() => orderBrandOptions(options, selected), [options, selected])
  const filtered = useMemo(() => filterBrandOptions(ordered, query), [ordered, query])
  const searching = query.trim() !== ''
  // Primele VISIBLE_COUNT + toate bifatele din URL (sunt deja primele in `ordered`)
  // (daca ar ramane ascunse doar 1–3 marci, le aratam direct — un „Arată toate” pentru una e inutil)
  const headCount = ordered.length <= VISIBLE_COUNT + 3 ? ordered.length : Math.max(VISIBLE_COUNT, selected.length)
  const head = searching ? filtered : ordered.slice(0, headCount)
  const tail = searching ? [] : ordered.slice(headCount)

  function go(brands: string[]) {
    const url = buildListingUrl(basePath, { sort, brands, tot })
    startTransition(() => {
      // in coloana nu sarim sus la fiecare bifare; dupa panoul de pe mobil, da (vezi lista noua)
      router.push(url, { scroll: mode === 'panel' })
    })
    onApplied?.()
  }

  function toggle(brand: string, on: boolean) {
    const next = on ? [...checked, brand].slice(0, MAX_BRANDS) : checked.filter(b => b !== brand)
    setChecked(next)
    if (mode === 'sidebar') go(next)
  }

  const resultCount = countForSelection(options, checked, total)

  const checkbox = (o: BrandOption) => {
    const id = `${uid}-${o.brand}`
    const isOn = checked.includes(o.brand)
    return (
      <li key={o.brand}>
        <label
          htmlFor={id}
          className="flex items-center gap-2.5 rounded-md px-1.5 py-1.5 text-sm cursor-pointer hover:bg-[var(--color-page)] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand"
        >
          <input
            id={id}
            type="checkbox"
            name="brand"
            value={o.brand}
            checked={isOn}
            onChange={e => toggle(o.brand, e.target.checked)}
            className="h-4 w-4 shrink-0 accent-[var(--color-brand)] focus-visible:outline-none"
          />
          <span className={`min-w-0 flex-1 truncate ${isOn ? 'font-semibold text-[var(--color-text)]' : 'text-[var(--color-text)]'}`} title={o.brand}>
            {o.brand}
          </span>
          <span className="tabular text-xs text-muted">{o.count.toLocaleString('ro-RO')}</span>
        </label>
      </li>
    )
  }

  return (
    <form
      method="get"
      action={basePath}
      onSubmit={e => { e.preventDefault(); go(checked) }}
      aria-busy={isPending}
      className={isPending ? 'opacity-60 transition-opacity' : 'transition-opacity'}
    >
      {/* Sortarea si „vezi tot” se pastreaza la trimiterea fara JS; pagina se reseteaza */}
      {sort !== 'price' && <input type="hidden" name="sort" value={sort} />}
      {tot && <input type="hidden" name="tot" value="1" />}

      <fieldset>
        <legend className="flex w-full items-center justify-between text-xs font-semibold text-muted uppercase tracking-wide mb-2">
          Marcă
        </legend>

        {options.length > VISIBLE_COUNT && (
          <div className="relative mb-2">
            <Search size={14} aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
            {/* Fara `name`: cautarea filtreaza doar lista de pe ecran, nu intra in URL */}
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Caută marca…"
              aria-label="Caută marca"
              autoComplete="off"
              className="w-full rounded-lg border border-line bg-surface py-1.5 pl-8 pr-2 text-sm text-[var(--color-text)] placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            />
          </div>
        )}

        {searching && filtered.length === 0 && (
          <p className="px-1.5 py-2 text-sm text-muted">Nicio marcă găsită.</p>
        )}

        <ul className={searching ? 'max-h-80 overflow-y-auto overscroll-contain' : ''}>
          {head.map(checkbox)}
        </ul>

        {/* <details> = „Arată toate” care merge si fara JavaScript; restul listei are scroll
            intern, ca o categorie cu 200 de marci sa nu impinga totul in jos */}
        {tail.length > 0 && (
          <details open={expanded} onToggle={e => setExpanded((e.currentTarget as HTMLDetailsElement).open)} className="mt-1">
            <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer select-none px-1.5 py-1.5 text-sm font-medium text-red-ink hover:underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
              {expanded ? 'Arată mai puține' : `Arată toate (${ordered.length.toLocaleString('ro-RO')})`}
            </summary>
            <ul className="max-h-80 overflow-y-auto overscroll-contain border-t border-line pt-1">
              {tail.map(checkbox)}
            </ul>
          </details>
        )}
      </fieldset>

      {mode === 'sidebar' ? (
        <>
          {selected.length > 0 && (
            <Link
              href={buildListingUrl(basePath, { sort, brands: [], tot })}
              scroll={false}
              className="mt-3 inline-block text-sm text-red-ink hover:underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              Șterge filtrele
            </Link>
          )}
          {/* Fara JavaScript bifarea nu trimite nimic singura → buton explicit */}
          <noscript>
            <button type="submit" className="mt-3 w-full rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
              Aplică
            </button>
          </noscript>
        </>
      ) : (
        <div className="sticky bottom-0 -mx-4 mt-4 flex items-center gap-3 border-t border-line bg-surface px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {checked.length > 0 && (
            <button
              type="button"
              onClick={() => setChecked([])}
              className="text-sm text-muted underline underline-offset-2 hover:text-[var(--color-text)] rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              Șterge
            </button>
          )}
          <button
            type="submit"
            className="ml-auto flex-1 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
          >
            Vezi {roCount(resultCount, 'produse', 'produs')}
          </button>
        </div>
      )}
    </form>
  )
}
