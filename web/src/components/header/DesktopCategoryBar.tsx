'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import type { NavParent } from './types'

// Bara de categorii de pe desktop (macheta „.dh-nav”), sub antetul cărbune: „Reduceri reale azi”
// + părinții din meniu, fiecare cu meniu derulant (subcategoriile pe 2 coloane).
// Se deschide la hover (doar mouse), la click/atingere și din tastatură (Enter/Spațiu,
// săgeată jos = intră în listă, Esc = închide și întoarce focusul pe buton).
// Panourile sunt mereu în HTML (ascunse cu `hidden`) → linkurile rămân vizibile pentru Google.

// Câți părinți încap pe un rând la 1024 px; restul intră în „Mai multe”
const MAX_VISIBLE = 5
const MORE = -1 // id-ul „Mai multe” în starea openId

const triggerCls =
  'flex items-center gap-1.5 px-3 py-3 text-sm font-semibold whitespace-nowrap text-head-ink hover:bg-white/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-on-head'
const panelCls =
  'absolute top-full z-50 mt-px w-[min(460px,calc(100vw-2rem))] rounded-b-xl rounded-t-sm bg-surface text-ink border border-line shadow-pop p-4'

function isActive(p: NavParent, pathname: string) {
  return p.href === pathname || p.children.some((c) => c.href === pathname)
}

export function DesktopCategoryBar({ menu }: { menu: NavParent[] }) {
  const pathname = usePathname()
  const [openId, setOpenId] = useState<number | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const navRef = useRef<HTMLElement>(null)
  const lastPointer = useRef<string>('')

  // Pagină nouă → meniul derulant se închide
  const [prevPath, setPrevPath] = useState(pathname)
  if (pathname !== prevPath) {
    setPrevPath(pathname)
    setOpenId(null)
  }

  // Click/atingere în afara barei → închide
  useEffect(() => {
    if (openId == null) return
    const onDown = (e: PointerEvent) => {
      if (!navRef.current?.contains(e.target as Node)) setOpenId(null)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [openId])

  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current) }, [])

  const visible = menu.slice(0, MAX_VISIBLE)
  const overflow = menu.slice(MAX_VISIBLE)

  // Hover doar pentru mouse: pe o tabletă, atingerea ar declanșa întâi „enter” (deschide) și apoi
  // click (închide) — meniul ar clipi. La atingere decide doar click-ul.
  const hoverProps = (id: number) => ({
    onPointerEnter: (e: React.PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      if (closeTimer.current) clearTimeout(closeTimer.current)
      setOpenId(id)
    },
    onPointerLeave: (e: React.PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      // mică întârziere: mouse-ul poate traversa spațiul dintre buton și panou
      closeTimer.current = setTimeout(() => setOpenId((cur) => (cur === id ? null : cur)), 150)
    },
  })

  // Tastatură pe tot grupul (buton + panou)
  const onGroupKey = (id: number) => (e: React.KeyboardEvent<HTMLDivElement>) => {
    const group = e.currentTarget
    const btn = group.querySelector<HTMLButtonElement>('button[aria-expanded]')
    if (e.key === 'Escape' && openId === id) {
      e.preventDefault()
      setOpenId(null)
      btn?.focus()
    } else if (e.key === 'ArrowDown' && e.target === btn) {
      e.preventDefault()
      setOpenId(id)
      // panoul devine vizibil după randare → focusul în cadrul următor
      requestAnimationFrame(() => group.querySelector<HTMLAnchorElement>('[data-panel] a')?.focus())
    }
  }

  // Focusul a plecat din grup (Tab mai departe) → închide
  const onGroupBlur = (id: number) => (e: React.FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      setOpenId((cur) => (cur === id ? null : cur))
    }
  }

  const renderGroup = (
    id: number,
    label: string,
    active: boolean,
    alignRight: boolean,
    panel: React.ReactNode
  ) => {
    const open = openId === id
    const panelId = `meniu-cat-${id === MORE ? 'mai-multe' : id}`
    return (
      <div
        key={id}
        className="relative"
        {...hoverProps(id)}
        onKeyDown={onGroupKey(id)}
        onBlur={onGroupBlur(id)}
      >
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onPointerDown={(e) => { lastPointer.current = e.pointerType }}
          onClick={(e) => {
            // Cu mouse-ul, hover-ul a deschis deja panoul → click-ul nu trebuie să-l închidă.
            // Atingere și tastatură (e.detail === 0) → comută deschis/închis.
            if (lastPointer.current === 'mouse' && e.detail > 0) setOpenId(id)
            else setOpenId(open ? null : id)
          }}
          className={`${triggerCls} ${active ? 'shadow-[inset_0_-3px_0_var(--red)]' : ''}`}
        >
          {label}
          <ChevronDown
            size={14}
            aria-hidden="true"
            className={`opacity-70 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          />
        </button>
        <div id={panelId} data-panel hidden={!open} className={`${panelCls} ${alignRight ? 'right-0' : 'left-0'}`}>
          {panel}
        </div>
      </div>
    )
  }

  const subLinks = (p: NavParent) => (
    <ul className="grid grid-cols-2 gap-x-6">
      {p.children.map((c) => (
        <li key={c.id}>
          <Link
            href={c.href}
            aria-current={c.href === pathname ? 'page' : undefined}
            className="block py-1.5 text-sm text-ink-2 hover:text-red-ink aria-[current=page]:font-semibold aria-[current=page]:text-red-ink rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-ink"
          >
            {c.label}
          </Link>
        </li>
      ))}
    </ul>
  )

  const allLink = (p: NavParent) => (
    <Link
      href={p.href}
      className="inline-block mb-2 text-sm font-bold text-red-ink hover:underline underline-offset-2 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-ink"
    >
      Tot din {p.label} ›
    </Link>
  )

  return (
    <nav ref={navRef} aria-label="Categorii" className="bg-head-2 border-t border-white/[.08]">
      <div className="max-w-7xl mx-auto px-2 flex flex-wrap items-stretch gap-1">
        <Link
          href="/reduceri-reale"
          aria-current={pathname === '/reduceri-reale' ? 'page' : undefined}
          className={`${triggerCls} !text-red-on-head ${pathname.startsWith('/reduceri-reale') ? 'shadow-[inset_0_-3px_0_var(--red)]' : ''}`}
        >
          Reduceri reale azi
        </Link>

        {visible.map((p, i) =>
          p.children.length ? (
            renderGroup(
              p.id,
              p.label,
              isActive(p, pathname),
              // ultimii părinți (spre dreapta) își deschid panoul spre stânga, să nu iasă din ecran
              i >= Math.ceil(visible.length / 2),
              <>
                {allLink(p)}
                {subLinks(p)}
              </>
            )
          ) : (
            <Link
              key={p.id}
              href={p.href}
              aria-current={p.href === pathname ? 'page' : undefined}
              className={`${triggerCls} ${p.href === pathname ? 'shadow-[inset_0_-3px_0_var(--red)]' : ''}`}
            >
              {p.label}
            </Link>
          )
        )}

        {overflow.length > 0 &&
          renderGroup(
            MORE,
            'Mai multe',
            overflow.some((p) => isActive(p, pathname)),
            true,
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              {overflow.map((p) => (
                <div key={p.id}>
                  {p.children.length > 0 ? (
                    <>
                      {allLink(p)}
                      {subLinks(p)}
                    </>
                  ) : (
                    <Link href={p.href} className="text-sm font-bold text-ink hover:text-red-ink">
                      {p.label}
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}
      </div>
    </nav>
  )
}
