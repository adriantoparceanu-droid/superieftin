import Link from 'next/link'
import { getMenu, type MenuItem } from '@/lib/queries'

// Cate intrari incap confortabil in bara de navigatie; restul intra in „Mai multe"
const MAX_VISIBLE_ITEMS = 5

function Dropdown({ items }: { items: MenuItem[] }) {
  return (
    <div className="absolute right-0 sm:right-auto sm:left-0 top-full pt-2 hidden group-hover:block group-focus-within:block z-50">
      <div className="bg-white border border-line rounded-xl shadow-lg py-2 min-w-48 max-h-96 overflow-y-auto">
        {items.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className="block px-4 py-1.5 hover:bg-surface hover:text-brand whitespace-nowrap"
          >
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  )
}

export async function Header() {
  // fallback gol: la build-ul Docker nu exista DB (pre-randarea /_not-found incarca layout-ul)
  const menu = await getMenu().catch(() => [])
  const visible = menu.slice(0, MAX_VISIBLE_ITEMS)
  const overflow = menu.slice(MAX_VISIBLE_ITEMS)

  return (
    <header className="bg-surface border-b border-line sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
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
          {/* Mobil: tot meniul intr-un singur dropdown */}
          {menu.length > 0 && (
            <div className="relative group sm:hidden">
              <button
                type="button"
                className="hover:text-[var(--color-text)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 rounded whitespace-nowrap"
              >
                Categorii ▾
              </button>
              <Dropdown items={menu} />
            </div>
          )}
        </nav>
      </div>
    </header>
  )
}
