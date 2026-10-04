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
import { btn } from '@/components/product/buttons'

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
          className={`flex items-center gap-2.5 rounded-lg px-1 cursor-pointer hover:bg-surface-2 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ink ${mode === 'panel' ? 'min-h-[42px] text-[14.5px]' : 'min-h-9 text-sm'}`}
        >
          {/* Căsuța desenată pe tokeni (macheta „.cb”): input-ul nativ rămâne (tastatură, formular
              fără JS), doar fără aspectul implicit; bifa e un SVG arătat când e bifat */}
          <span className="relative grid h-[22px] w-[22px] shrink-0 place-items-center">
            <input
              id={id}
              type="checkbox"
              name="brand"
              value={o.brand}
              checked={isOn}
              onChange={e => toggle(o.brand, e.target.checked)}
              className="peer absolute inset-0 m-0 cursor-pointer appearance-none rounded-md bg-surface ring-[1.5px] ring-inset ring-line-2 checked:bg-ink checked:ring-ink focus-visible:outline-none"
            />
            <svg viewBox="0 0 24 24" aria-hidden="true" className="pointer-events-none relative hidden h-3.5 w-3.5 text-page peer-checked:block" fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round">
              <path d="m5 12.5 4.5 4.5L19 7.5" />
            </svg>
          </span>
          <span className={`min-w-0 flex-1 truncate text-ink ${isOn ? 'font-semibold' : ''}`} title={o.brand}>
            {o.brand}
          </span>
          <span className="tabular-nums text-[13px] text-ink-3">{o.count.toLocaleString('ro-RO')}</span>
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
        <legend className="mb-2 flex w-full items-baseline justify-between font-display text-[15px] font-extrabold text-ink">
          Marcă
          {checked.length > 0 && (
            <small className="font-sans text-[12.5px] font-medium text-ink-3">
              {checked.length === 1 ? '1 selectată' : `${checked.length} selectate`}
            </small>
          )}
        </legend>

        {options.length > VISIBLE_COUNT && (
          <div className="relative mb-2">
            <Search size={15} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
            {/* Fara `name`: cautarea filtreaza doar lista de pe ecran, nu intra in URL */}
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Caută marca…"
              aria-label="Caută marca"
              autoComplete="off"
              className="h-10 w-full rounded-[10px] bg-surface pl-9 pr-2 text-sm text-ink ring-[1.5px] ring-inset ring-line-2 placeholder:text-ink-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
            />
          </div>
        )}

        {searching && filtered.length === 0 && (
          <p className="px-1 py-2 text-sm text-ink-3">Nicio marcă găsită.</p>
        )}

        <ul className={searching ? 'max-h-80 overflow-y-auto overscroll-contain' : ''}>
          {head.map(checkbox)}
        </ul>

        {/* <details> = „Arată toate” care merge si fara JavaScript; restul listei are scroll
            intern, ca o categorie cu 200 de marci sa nu impinga totul in jos */}
        {tail.length > 0 && (
          <details open={expanded} onToggle={e => setExpanded((e.currentTarget as HTMLDetailsElement).open)} className="mt-1">
            <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer select-none px-1 py-1.5 text-[13.5px] font-bold text-ink underline underline-offset-[3px] hover:text-red-ink rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink">
              {expanded ? 'Arată mai puține' : `Arată toate (${ordered.length.toLocaleString('ro-RO')})`}
            </summary>
            <ul className="max-h-80 overflow-y-auto overscroll-contain border-t border-line pt-1 mt-1">
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
              className="mt-3 inline-block text-sm font-semibold text-ink underline underline-offset-[3px] hover:text-red-ink rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
            >
              Șterge filtrele
            </Link>
          )}
          {/* Fara JavaScript bifarea nu trimite nimic singura → buton explicit */}
          <noscript>
            <button type="submit" className={`mt-3 w-full ${btn('secondary', 'sm')}`}>
              Aplică
            </button>
          </noscript>
        </>
      ) : (
        // Subsolul foii („.sheet-foot”): rămâne jos, deasupra zonei sigure de pe iPhone. Butonul
        // roșu e singurul de pe ecran cât foaia e deschisă (design §3).
        <div className="sticky bottom-0 -mx-4 mt-4 flex items-center gap-2.5 border-t border-line bg-surface px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {checked.length > 0 && (
            <button type="button" onClick={() => setChecked([])} className={btn('secondary', 'sm')}>
              Resetează
            </button>
          )}
          <button type="submit" className={`flex-1 ${btn('primary')}`}>
            Arată {roCount(resultCount, 'produse', 'produs')}
          </button>
        </div>
      )}
    </form>
  )
}
