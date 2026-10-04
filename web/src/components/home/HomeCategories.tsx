import Link from 'next/link'
import { CategoryIcon } from '@/components/CategoryIcon'
import type { CategoryInfo, MenuItem } from '@/lib/queries'

// Categoriile de pe homepage (macheta „.cats” / „.cat”). Datele vin din DB, nimic scris de mână:
//  - părinții vizibili, cu numărul de produse și iconița aleasă în Admin → Categorii (getCategories);
//  - subcategoriile din meniul administrabil (getMenu), ca linkuri — doar de la lg: pe mobil
//    meniul din antet le are deja în acordeon, iar cardurile rămân compacte, ca în machetă.
// Fără iconiță aleasă în admin nu punem una generică (ar arăta toate la fel) — ca în antet.

const MAX_SUBS = 6

export function HomeCategories({ categories, menu }: { categories: CategoryInfo[]; menu: MenuItem[] }) {
  if (!categories.length) return null

  // Subcategoriile fiecărui părinte, după linkul lui din meniu (/c/<slug>)
  const subsBySlug = new Map(
    menu
      .filter((m) => m.href.startsWith('/c/'))
      .map((m) => [m.href.slice(3), (m.children ?? []).filter((c) => c.href.startsWith('/c/'))])
  )

  return (
    <ul className="grid grid-cols-2 gap-2 lg:grid-cols-[repeat(auto-fit,minmax(210px,1fr))] lg:gap-3">
      {categories.map((cat) => {
        const subs = subsBySlug.get(cat.category) ?? []
        const name = cat.name ?? cat.category
        return (
          <li key={cat.category} className="rounded-xl bg-surface shadow-card lg:p-1">
            <Link
              href={`/c/${cat.category}`}
              className="flex items-center gap-2.5 rounded-xl p-2.5 text-[13.5px] font-bold leading-[1.2] text-ink hover:text-red-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink lg:text-[15px]"
            >
              {cat.icon && (
                <span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[10px] bg-surface-2 text-ink-2">
                  <CategoryIcon name={cat.icon} className="h-[22px] w-[22px]" />
                </span>
              )}
              <span className="min-w-0">
                {name}
                <small className="mt-0.5 block text-[11.5px] font-medium text-ink-3 tabular">
                  {cat.count.toLocaleString('ro-RO')} {cat.count === 1 ? 'produs' : 'produse'}
                </small>
              </span>
            </Link>
            {subs.length > 0 && (
              <ul className="hidden lg:block px-2.5 pb-2.5 text-sm">
                {subs.slice(0, MAX_SUBS).map((s) => (
                  <li key={s.id}>
                    <Link
                      href={s.href}
                      className="block truncate rounded py-1 text-ink-2 hover:text-red-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
                    >
                      {s.label}
                    </Link>
                  </li>
                ))}
                {subs.length > MAX_SUBS && (
                  <li>
                    <Link
                      href={`/c/${cat.category}`}
                      className="block rounded py-1 font-semibold text-red-ink hover:underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
                    >
                      Tot din {name} ›
                    </Link>
                  </li>
                )}
              </ul>
            )}
          </li>
        )
      })}
    </ul>
  )
}
