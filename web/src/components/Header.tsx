import Link from 'next/link'
import { Logo } from './Logo'
import { CategoryIcon } from './CategoryIcon'
import { MobileHeader } from './header/MobileHeader'
import { DesktopCategoryBar } from './header/DesktopCategoryBar'
import { SearchForm } from './header/SearchForm'
import type { NavParent } from './header/types'
import { getMenu, getMenuTags } from '@/lib/queries'

// Antetul site-ului (redesign, design §4 „Antet, meniu, subsol”; macheta „.sh” / „.dh”):
// cărbune în ambele teme. Datele vin din arborele `menu_items` (Admin → Meniu) și din `tags` —
// nimic scris de mână aici. Arătăm 2 niveluri (părinte → subcategorii); un al treilea nivel,
// dacă apare în meniu, se vede pe pagina subcategoriei.
//  - sub lg (mobil, tabletă): MobileHeader — buton meniu · logo · căutare + panoul pe tot ecranul;
//  - lg+ (desktop): rândul cu logo, căutare lată și linkuri + bara de categorii cu meniu derulant.

const DESKTOP_LINKS: [string, string][] = [
  ['/ghiduri', 'Ghiduri'],
  ['/ghiduri/metodologie', 'Cum calculăm'],
  ['/alerte/gestionare', 'Alertele mele'],
]

export async function Header() {
  // fallback gol: la build-ul Docker nu exista DB (pre-randarea /_not-found incarca layout-ul)
  const [menu, tags] = await Promise.all([
    getMenu().catch(() => []),
    getMenuTags().catch(() => []),
  ])

  // Iconițele se randează aici, pe server: componentele client primesc doar SVG-ul gata făcut
  const nav: NavParent[] = menu.map((m) => ({
    id: m.id,
    label: m.label,
    href: m.href,
    // fără iconiță aleasă în Admin → Categorii nu punem una generică (toate ar arăta la fel)
    icon: m.icon ? <CategoryIcon name={m.icon} className="w-[21px] h-[21px]" /> : null,
    children: (m.children ?? []).map((c) => ({ id: c.id, label: c.label, href: c.href })),
  }))

  return (
    <header className="sticky top-0 z-50 bg-head text-head-ink">
      <MobileHeader menu={nav} tags={tags} />

      <div className="hidden lg:block">
        <div className="max-w-7xl mx-auto px-4 h-[72px] flex items-center gap-7">
          <Logo onDark className="shrink-0" />
          <SearchForm className="flex-1 max-w-[620px]" />
          <nav aria-label="Linkuri utile" className="ml-auto flex items-center gap-[18px] text-sm font-semibold shrink-0">
            {DESKTOP_LINKS.map(([href, label]) => (
              <Link
                key={href}
                href={href}
                className="text-head-ink-2 hover:text-head-ink transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-on-head"
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
        <DesktopCategoryBar menu={nav} />
      </div>
    </header>
  )
}
