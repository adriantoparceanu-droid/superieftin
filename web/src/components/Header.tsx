import Link from 'next/link'
import { getMenu, type MenuItem } from '@/lib/queries'

// Cate intrari incap confortabil in bara de navigatie; restul intra in „Mai multe"
const MAX_VISIBLE_ITEMS = 5

// Un item de dropdown; daca are copii, deschide un flyout lateral la hover/focus.
// Numele de grup „sub" se rezolva la cel mai apropiat parinte cu group/sub, deci
// imbricarea pe mai multe niveluri (max 3) functioneaza fara nume distincte per nivel.
function MenuLink({ item }: { item: MenuItem }) {
  const hasChildren = !!item.children?.length
  if (!hasChildren) {
    return (
      <Link href={item.href} className="block px-4 py-1.5 hover:bg-surface hover:text-brand whitespace-nowrap">
        {item.label}
      </Link>
    )
  }
  return (
    <div className="relative group/sub">
      <Link
        href={item.href}
        className="flex items-center justify-between gap-4 px-4 py-1.5 hover:bg-surface hover:text-brand whitespace-nowrap"
      >
        <span>{item.label}</span>
        <span className="text-muted">›</span>
      </Link>
      <div className="absolute left-full top-0 pl-1 hidden group-hover/sub:block group-focus-within/sub:block z-50">
        <div className="bg-white border border-line rounded-xl shadow-lg py-2 min-w-48 max-h-96 overflow-y-auto">
          {item.children!.map((c) => <MenuLink key={c.id} item={c} />)}
        </div>
      </div>
    </div>
  )
}

function Dropdown({ items }: { items: MenuItem[] }) {
  return (
    <div className="absolute right-0 sm:right-auto sm:left-0 top-full pt-2 hidden group-hover:block group-focus-within:block z-50">
      <div className="bg-white border border-line rounded-xl shadow-lg py-2 min-w-48 max-h-96 overflow-y-auto">
        {items.map((item) => <MenuLink key={item.id} item={item} />)}
      </div>
    </div>
  )
}

// Mobil: tot arborele intr-o lista indentata (fara flyout lateral, mai usor pe touch).
function MobileItems({ items, depth = 0 }: { items: MenuItem[]; depth?: number }) {
  return (
    <>
      {items.map((item) => (
        <div key={item.id}>
          <Link
            href={item.href}
            className="block py-1.5 pr-4 hover:bg-surface hover:text-brand whitespace-nowrap"
            style={{ paddingLeft: 16 + depth * 16 }}
          >
            {depth > 0 ? '• ' : ''}{item.label}
          </Link>
          {!!item.children?.length && <MobileItems items={item.children} depth={depth + 1} />}
        </div>
      ))}
    </>
  )
}

export async function Header() {
  // fallback gol: la build-ul Docker nu exista DB (pre-randarea /_not-found incarca layout-ul)
  const menu = await getMenu().catch(() => [])
  const visible = menu.slice(0, MAX_VISIBLE_ITEMS)
  const overflow = menu.slice(MAX_VISIBLE_ITEMS)

  return (
    <header className="bg-surface border-b border-line sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        <Link href="/" className="font-black font-archivo text-xl text-brand tracking-tight shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 rounded">
          superieftin<span className="text-[var(--color-text)]">.ro</span>
        </Link>
        <nav className="flex items-center gap-5 text-sm text-muted">
          {visible.map((item) => (
            <div key={item.id} className="relative group hidden sm:block">
              <Link
                href={item.href}
                className="hover:text-[var(--color-text)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 rounded whitespace-nowrap"
              >
                {item.label}{item.children?.length ? ' ▾' : ''}
              </Link>
              {!!item.children?.length && <Dropdown items={item.children} />}
            </div>
          ))}
          {/* Desktop: doar intrarile care nu incap */}
          {overflow.length > 0 && (
            <div className="relative group hidden sm:block">
              <button
                type="button"
                className="hover:text-[var(--color-text)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 rounded whitespace-nowrap"
              >
                Mai multe ▾
              </button>
              <Dropdown items={overflow} />
            </div>
          )}
          {/* Mobil: tot meniul intr-un singur dropdown, indentat pe niveluri */}
          {menu.length > 0 && (
            <div className="relative group sm:hidden">
              <button
                type="button"
                className="hover:text-[var(--color-text)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 rounded whitespace-nowrap"
              >
                Categorii ▾
              </button>
              <div className="absolute right-0 top-full pt-2 hidden group-hover:block group-focus-within:block z-50">
                <div className="bg-white border border-line rounded-xl shadow-lg py-2 min-w-56 max-h-96 overflow-y-auto">
                  <MobileItems items={menu} />
                </div>
              </div>
            </div>
          )}
        </nav>
      </div>
    </header>
  )
}
