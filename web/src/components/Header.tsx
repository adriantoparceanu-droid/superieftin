import Link from 'next/link'
import { Logo } from './Logo'
import { MobileHeader } from './header/MobileHeader'
import { SearchForm } from './header/SearchForm'
import type { NavLink } from './header/types'
import { getMenu } from '@/lib/queries'

// Antetul blogului (reorganizarea din 20.11.2026, varianta A „Revista”): fundal deschis (tokenul
// --surface, închis în modul întunecat), logo text, meniul TEMELOR + paginile fixe, căutarea în
// articole. Temele = părinții din `menu_items` (Admin → Meniu), nimic scris de mână; subcategoriile
// nu apar în meniu (paginile lor au temă proprie doar de la 3 articole — app/c/[categorie]).
//  - sub lg (mobil, tabletă): MobileHeader — buton meniu · logo · căutare + panoul pe tot ecranul;
//  - lg+ (desktop): logo + căutare, dedesubt rândul cu temele. Pe desktop antetul NU e lipicios:
//    are ~120 px și ar acoperi ancorele din articole (#produs-…, cuprinsul — scroll-mt-24).

// Paginile fixe din meniu, după teme
const PAGE_LINKS: NavLink[] = [
  { href: '/ghiduri', label: 'Toate articolele' },
  { href: '/despre', label: 'Despre noi' },
]

const navLink =
  'whitespace-nowrap py-3 text-[15px] font-semibold text-ink-2 hover:text-red-ink transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink'

export async function Header() {
  // fallback gol: la build-ul Docker nu exista DB (pre-randarea /_not-found incarca layout-ul)
  const menu = await getMenu().catch(() => [])
  const themes: NavLink[] = menu.map((m) => ({ href: m.href, label: m.label }))

  return (
    <header className="sticky top-0 z-50 lg:static border-b border-line bg-surface text-ink">
      <MobileHeader themes={themes} pages={PAGE_LINKS} />

      <div className="hidden lg:block">
        <div className="max-w-7xl mx-auto px-4 h-[72px] flex items-center gap-8">
          <Logo wordmark className="shrink-0" />
          <SearchForm className="ml-auto w-full max-w-[380px]" />
        </div>
        <nav aria-label="Teme" className="max-w-7xl mx-auto px-4 flex items-center gap-x-7 border-t border-line">
          {themes.map((t) => (
            <Link key={t.href} href={t.href} className={navLink}>{t.label}</Link>
          ))}
          <span className="ml-auto flex items-center gap-x-7">
            {PAGE_LINKS.map((p) => (
              <Link key={p.href} href={p.href} className={navLink}>{p.label}</Link>
            ))}
          </span>
        </nav>
      </div>
    </header>
  )
}
