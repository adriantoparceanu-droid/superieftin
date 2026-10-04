'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronDown, ChevronRight, Menu, Search, X } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { SearchForm } from './SearchForm'
import type { NavParent, NavTag } from './types'

// Antetul de pe mobil (sub lg): rând de 56 px pe cărbune — meniu · logo · căutare
// (macheta „.sh”). Meniul = panou pe tot ecranul sub antet (macheta „.menu”): căutare,
// scurtătura „Reduceri reale azi”, acordeon pe 2 niveluri, linkuri utile, tag-uri.
//
// De ce panoul e mereu în HTML (doar ascuns cu `hidden`): linkurile spre categorii rămân
// vizibile pentru Google și funcționează și înainte să se încarce JavaScript-ul.

const PAGE_LINKS: [string, string][] = [
  ['/ghiduri', 'Ghiduri de cumpărare'],
  ['/ghiduri/metodologie', 'Cum calculăm reducerea reală'],
  ['/alerte/gestionare', 'Alertele mele'],
  ['/despre', 'Despre noi'],
]

// Părintele care conține pagina curentă (îl deschidem din start în acordeon)
function activeParentId(menu: NavParent[], pathname: string): number | null {
  const hit = menu.find(
    (p) => p.href === pathname || p.children.some((c) => c.href === pathname)
  )
  return hit && hit.children.length ? hit.id : null
}

export function MobileHeader({ menu, tags }: { menu: NavParent[]; tags: NavTag[] }) {
  const pathname = usePathname()
  const isHome = pathname === '/'

  const [menuOpen, setMenuOpen] = useState(false)
  // Pe prima pagină căutarea stă deschisă sub antet; în rest se deschide din iconiță
  const [searchOpen, setSearchOpen] = useState(isHome)
  // Acordeon: un singur părinte deschis odată
  const [openParent, setOpenParent] = useState<number | null>(() => activeParentId(menu, pathname))

  // La schimbarea paginii: meniul se închide, căutarea revine la starea implicită.
  // (Ajustare de stare în timpul randării, nu în useEffect — evită o randare cu starea veche.)
  const [prevPath, setPrevPath] = useState(pathname)
  if (pathname !== prevPath) {
    setPrevPath(pathname)
    setMenuOpen(false)
    setSearchOpen(pathname === '/')
    setOpenParent(activeParentId(menu, pathname))
  }

  const hasIcons = menu.some((p) => p.icon != null)

  const menuBtnRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const searchRowRef = useRef<HTMLDivElement>(null)
  // true doar când vizitatorul a apăsat iconița (nu și pe prima pagină, unde câmpul e deschis
  // din start — acolo nu vrem să sară tastatura telefonului singură)
  const focusSearch = useRef(false)

  // Cât meniul e deschis: pagina de dedesubt nu se derulează, Esc îl închide (focus înapoi pe
  // buton), iar la trecerea pe lățime de desktop se închide singur (altfel rămânea scroll-ul blocat).
  useEffect(() => {
    if (!menuOpen) return
    const root = document.documentElement
    const prevOverflow = root.style.overflow
    root.style.overflow = 'hidden'
    panelRef.current?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false)
        menuBtnRef.current?.focus()
      }
    }
    const mq = window.matchMedia('(min-width: 1024px)')
    const onMq = () => { if (mq.matches) setMenuOpen(false) }
    document.addEventListener('keydown', onKey)
    mq.addEventListener('change', onMq)
    return () => {
      root.style.overflow = prevOverflow
      document.removeEventListener('keydown', onKey)
      mq.removeEventListener('change', onMq)
    }
  }, [menuOpen])

  useEffect(() => {
    if (searchOpen && focusSearch.current) {
      focusSearch.current = false
      searchRowRef.current?.querySelector('input')?.focus()
    }
  }, [searchOpen])

  // Click pe un link din panou: închidem meniul (și când linkul duce la pagina curentă,
  // caz în care pathname-ul nu se schimbă)
  const closeOnLink = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('a')) setMenuOpen(false)
  }

  const iconBtn =
    'w-11 h-11 grid place-items-center rounded-[10px] shrink-0 text-head-ink hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-on-head'

  return (
    <div className="lg:hidden">
      <div className="h-14 px-2 flex items-center gap-1.5">
        <button
          ref={menuBtnRef}
          type="button"
          className={iconBtn}
          aria-expanded={menuOpen}
          aria-controls="meniu-mobil"
          aria-label={menuOpen ? 'Închide meniul' : 'Deschide meniul'}
          onClick={() => setMenuOpen((o) => !o)}
        >
          {menuOpen ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
        </button>

        <div className="flex-1 flex justify-center min-w-0">
          <Logo onDark />
        </div>

        {menuOpen ? (
          // Căutarea e deja în capul meniului; păstrăm locul ca logo-ul să rămână centrat
          <span className="w-11 h-11 shrink-0" aria-hidden="true" />
        ) : (
          <button
            type="button"
            className={iconBtn}
            aria-expanded={searchOpen}
            aria-controls="cautare-antet"
            aria-label={searchOpen ? 'Ascunde căutarea' : 'Caută'}
            onClick={() => {
              focusSearch.current = !searchOpen
              setSearchOpen((o) => !o)
            }}
          >
            <Search size={22} aria-hidden="true" />
          </button>
        )}
      </div>

      <div id="cautare-antet" ref={searchRowRef} hidden={!searchOpen || menuOpen} className="px-3 pb-3">
        <SearchForm />
      </div>

      <nav
        id="meniu-mobil"
        ref={panelRef}
        tabIndex={-1}
        aria-label="Meniu principal"
        hidden={!menuOpen}
        onClick={closeOnLink}
        className="fixed inset-x-0 top-14 bottom-0 z-50 overflow-y-auto overscroll-contain bg-surface text-ink focus:outline-none pb-[env(safe-area-inset-bottom)]"
      >
        <div className="bg-head px-3.5 py-3">
          <SearchForm compact />
        </div>

        <Link
          href="/reduceri-reale"
          className="flex items-center justify-between gap-3 mx-3.5 mt-3 mb-1.5 p-3.5 rounded-xl bg-red text-white no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-ink focus-visible:ring-offset-2"
        >
          <span>
            <span className="block font-display font-[850] text-[17px] leading-tight">Reduceri reale azi</span>
            <span className="block text-[12.5px] font-medium opacity-90 mt-0.5">
              Minimum 5% sub mediana pe 30 de zile
            </span>
          </span>
          <ChevronRight size={20} aria-hidden="true" className="shrink-0" />
        </Link>

        <ul>
          {menu.map((p) => {
            // Coloana de iconițe apare doar dacă măcar un părinte are iconiță (Admin → Categorii);
            // altfel rândurile încep direct cu textul, iar subcategoriile au o indentare mai mică.
            const iconBox = hasIcons ? (
              <span className="w-9 h-9 rounded-[10px] bg-surface-2 grid place-items-center shrink-0 text-ink-2">
                {p.icon}
              </span>
            ) : null
            const rowCls =
              'w-full flex items-center gap-3 p-3.5 min-h-14 text-left font-bold text-base text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-ink'

            // Părinte fără subcategorii (ex. o categorie simplă): link direct
            if (!p.children.length) {
              return (
                <li key={p.id} className="border-b border-line">
                  <Link href={p.href} className={rowCls}>
                    {iconBox}
                    <span className="flex-1">{p.label}</span>
                    <ChevronRight size={20} aria-hidden="true" className="text-ink-3" />
                  </Link>
                </li>
              )
            }

            const open = openParent === p.id
            const subId = `meniu-sub-${p.id}`
            return (
              <li key={p.id} className="border-b border-line">
                <button
                  type="button"
                  className={rowCls}
                  aria-expanded={open}
                  aria-controls={subId}
                  onClick={() => setOpenParent(open ? null : p.id)}
                >
                  {iconBox}
                  <span className="flex-1">{p.label}</span>
                  <ChevronDown
                    size={20}
                    aria-hidden="true"
                    className={`text-ink-3 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                  />
                </button>
                <ul id={subId} hidden={!open} className={`${hasIcons ? 'pl-[62px]' : 'pl-7'} pr-3.5 pb-2.5`}>
                  {p.children.map((c) => (
                    <li key={c.id} className="border-t border-line first:border-t-0">
                      <Link
                        href={c.href}
                        aria-current={c.href === pathname ? 'page' : undefined}
                        className="flex items-center min-h-11 text-[15px] text-ink hover:text-red-ink aria-[current=page]:font-semibold aria-[current=page]:text-red-ink"
                      >
                        {c.label}
                      </Link>
                    </li>
                  ))}
                  <li className="border-t border-line">
                    <Link
                      href={p.href}
                      className="flex items-center justify-between min-h-11 text-[15px] font-bold text-red-ink"
                    >
                      Tot din {p.label}
                      <ChevronRight size={18} aria-hidden="true" />
                    </Link>
                  </li>
                </ul>
              </li>
            )
          })}
        </ul>

        <ul className="px-3.5 py-2.5">
          {PAGE_LINKS.map(([href, label]) => (
            <li key={href} className="border-b border-line">
              <Link href={href} className="block py-3 font-semibold text-ink hover:text-red-ink">
                {label}
              </Link>
            </li>
          ))}
        </ul>

        {tags.length > 0 && (
          <div className="px-3.5 pt-1 pb-6">
            <p className="text-[13px] text-ink-3">După starea produsului:</p>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {tags.map((t) => (
                <Link
                  key={t.slug}
                  href={`/t/${t.slug}`}
                  className="inline-flex items-center h-8 px-3 rounded-full bg-surface text-[13px] font-semibold text-ink shadow-[inset_0_0_0_1px_var(--line-2)] hover:text-red-ink"
                >
                  {t.name}
                </Link>
              ))}
            </div>
          </div>
        )}
      </nav>
    </div>
  )
}
