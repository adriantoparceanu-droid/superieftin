'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight, Menu, Search, X } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { SearchForm } from './SearchForm'
import type { NavLink } from './types'

// Antetul de pe mobil (sub lg), varianta A „Revista”: rând alb de 56 px — meniu · logo · căutare.
// Meniul = panou pe tot ecranul sub antet: căutarea în articole, temele, paginile fixe.
//
// De ce panoul e mereu în HTML (doar ascuns cu `hidden`): linkurile spre teme rămân vizibile
// pentru Google și funcționează și înainte să se încarce JavaScript-ul.
export function MobileHeader({ themes, pages }: { themes: NavLink[]; pages: NavLink[] }) {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  // La schimbarea paginii: meniul și căutarea se închid.
  // (Ajustare de stare în timpul randării, nu în useEffect — evită o randare cu starea veche.)
  const [prevPath, setPrevPath] = useState(pathname)
  if (pathname !== prevPath) {
    setPrevPath(pathname)
    setMenuOpen(false)
    setSearchOpen(false)
  }

  const menuBtnRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const searchRowRef = useRef<HTMLDivElement>(null)

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

  // Căutarea deschisă din iconiță → focus direct în câmp
  useEffect(() => {
    if (searchOpen) searchRowRef.current?.querySelector('input')?.focus()
  }, [searchOpen])

  // Click pe un link din panou: închidem meniul (și când linkul duce la pagina curentă)
  const closeOnLink = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('a')) setMenuOpen(false)
  }

  const iconBtn =
    'w-11 h-11 grid place-items-center rounded-[10px] shrink-0 text-ink hover:bg-surface-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink'
  const rowLink = 'flex items-center justify-between gap-3 min-h-14 font-display text-[19px] font-extrabold text-ink hover:text-red-ink aria-[current=page]:text-red-ink'

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
          <Logo wordmark />
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
            aria-label={searchOpen ? 'Ascunde căutarea' : 'Caută în articole'}
            onClick={() => setSearchOpen((o) => !o)}
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
        className="fixed inset-x-0 top-14 bottom-0 z-50 overflow-y-auto overscroll-contain bg-page text-ink focus:outline-none px-4 pb-[env(safe-area-inset-bottom)]"
      >
        <div className="py-3">
          <SearchForm compact />
        </div>

        {themes.length > 0 && (
          <>
            <p className="border-t-[3px] border-ink pt-3 text-[12px] font-extrabold uppercase tracking-[.1em] text-ink-3">Teme</p>
            <ul>
              {themes.map((t) => (
                <li key={t.href} className="border-b border-line">
                  <Link href={t.href} aria-current={t.href === pathname ? 'page' : undefined} className={rowLink}>
                    {t.label}
                    <ChevronRight size={20} aria-hidden="true" className="shrink-0 text-ink-3" />
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}

        <ul className="mt-6 border-t-[3px] border-ink pb-8">
          {pages.map((p) => (
            <li key={p.href} className="border-b border-line">
              <Link href={p.href} aria-current={p.href === pathname ? 'page' : undefined} className="block py-3.5 font-semibold text-ink hover:text-red-ink aria-[current=page]:text-red-ink">
                {p.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
