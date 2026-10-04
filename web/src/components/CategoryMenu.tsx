import Link from 'next/link'
import { CategoryIcon } from './CategoryIcon'
import type { MenuItem } from '@/lib/queries'

// Cate categorii de nivel 1 aratam in coloana; restul se acceseaza din grila „Categorii".
const MAX_TOP = 10

// Meniul vertical de categorii din stanga homepage-ului (stil Porto): la mouseover pe o
// categorie cu subcategorii, apare un flyout la dreapta cu ele (mega-menu). 100% CSS (group-hover),
// fara JS. Ascuns pe mobil — acolo ramane meniul din header (flyout-urile hover nu merg la touch).
// Redesign (etapa 2): culorile pe tokeni (bandoul de sus cărbune, ca antetul); structura o
// revizuim odată cu homepage-ul (etapa 5) — bara de categorii din antet acoperă deja desktopul.
export function CategoryMenu({ menu }: { menu: MenuItem[] }) {
  if (!menu.length) return null
  const items = menu.slice(0, MAX_TOP)
  const rest = menu.length - items.length

  return (
    <nav className="hidden lg:flex flex-col bg-surface border border-line rounded-2xl" aria-label="Categorii">
      <div className="bg-head text-head-ink font-bold text-sm px-4 py-3 rounded-t-2xl flex items-center gap-2 shrink-0">
        <span className="text-base leading-none">☰</span> Toate categoriile
      </div>

      <ul className="py-1 flex-1">
        {items.map((item) => {
          const kids = item.children ?? []
          return (
            <li key={item.id} className="relative group/cat">
              <Link
                href={item.href}
                className="flex items-center gap-2.5 px-4 py-2 text-sm text-ink hover:bg-surface-2 hover:text-red-ink transition-colors"
              >
                <CategoryIcon name={item.icon} className="w-5 h-5 text-muted group-hover/cat:text-red-ink shrink-0 transition-colors" />
                <span className="flex-1 truncate">{item.label}</span>
                {kids.length > 0 && <span className="text-muted group-hover/cat:text-red-ink">›</span>}
              </Link>

              {/* Flyout la dreapta cu subcategoriile (pl-2 = punte de hover ca sa nu se inchida) */}
              {kids.length > 0 && (
                <div className="absolute left-full top-0 pl-2 hidden group-hover/cat:block group-focus-within/cat:block z-40 w-[440px] max-w-[calc(100vw-280px)]">
                  <div className="bg-surface border border-line rounded-xl shadow-pop p-4">
                    <Link href={item.href} className="flex items-center gap-2 text-sm font-bold text-ink mb-3 hover:text-red-ink">
                      <CategoryIcon name={item.icon} className="w-5 h-5 text-red-ink" />
                      {item.label} — vezi tot →
                    </Link>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-0.5">
                      {kids.map((sub) => (
                        <Link
                          key={sub.id}
                          href={sub.href}
                          className="flex items-center gap-2 py-1.5 text-sm text-muted hover:text-red-ink transition-colors"
                        >
                          <CategoryIcon name={sub.icon} className="w-4 h-4 shrink-0" />
                          <span className="truncate">{sub.label}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {rest > 0 && (
        <a href="#toate-categoriile" className="block px-4 py-2.5 text-sm font-semibold text-red-ink border-t border-line hover:bg-surface-2 rounded-b-2xl shrink-0">
          + încă {rest} categorii →
        </a>
      )}
    </nav>
  )
}
