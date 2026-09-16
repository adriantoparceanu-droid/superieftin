import Link from 'next/link'
import { Search } from 'lucide-react'
import { getMenu, type MenuItem } from '@/lib/queries'

// Cate intrari incap confortabil in bara de navigatie; restul intra in „Mai multe"
const MAX_VISIBLE_ITEMS = 5

// Un item de dropdown; daca are copii, deschide un flyout lateral la hover/focus.
// Numele de grup „sub" se rezolva la cel mai apropiat parinte cu group/sub, deci
// imbricarea pe mai multe niveluri (max 3) functioneaza fara nume distincte per nivel.
// flyoutAlign: spre ce parte se deschide flyout-ul — „right" (spre stanga itemului, right-full)
// pentru dropdown-uri ancorate la marginea dreapta (ex. „Mai multe"), altfel ar iesi din pagina.
function MenuLink({ item, flyoutAlign = 'left' }: { item: MenuItem; flyoutAlign?: 'left' | 'right' }) {
  const hasChildren = !!item.children?.length
  if (!hasChildren) {
    return (
      <Link href={item.href} className="block px-4 py-1.5 hover:bg-surface hover:text-brand whitespace-nowrap">
        {item.label}
      </Link>
    )
  }
  const flyoutSide = flyoutAlign === 'right' ? 'right-full pr-1' : 'left-full pl-1'
  return (
    <div className="relative group/sub">
      <Link
        href={item.href}
        className="flex items-center justify-between gap-4 px-4 py-1.5 hover:bg-surface hover:text-brand whitespace-nowrap"
      >
        <span>{item.label}</span>
        <span className="text-muted">›</span>
      </Link>
      <div className={`absolute ${flyoutSide} top-0 hidden group-hover/sub:block group-focus-within/sub:block z-50`}>
        <div className="bg-white border border-line rounded-xl shadow-lg py-2 min-w-48 max-h-96 overflow-y-auto">
          {item.children!.map((c) => <MenuLink key={c.id} item={c} flyoutAlign={flyoutAlign} />)}
        </div>
      </div>
    </div>
  )
}

// align: „left" ancoreaza panoul la marginea stanga a trigger-ului (itemi normali, cu loc la dreapta);
// „right" il ancoreaza la marginea dreapta (ex. „Mai multe", ultimul item din navbar, lipit de marginea
// paginii) — altfel panoul creste spre dreapta si iese din viewport.
function Dropdown({ items, align = 'left' }: { items: MenuItem[]; align?: 'left' | 'right' }) {
  return (
    <div
      className={`absolute top-full pt-2 hidden group-hover:block group-focus-within:block z-50 ${
        align === 'right' ? 'right-0' : 'right-0 sm:right-auto sm:left-0'
      }`}
    >
      <div className="bg-white border border-line rounded-xl shadow-lg py-2 min-w-48 max-h-96 overflow-y-auto">
        {items.map((item) => <MenuLink key={item.id} item={item} flyoutAlign={align} />)}
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

// Search global, prezent pe orice pagina (nu doar pe homepage, unde traia inainte
// exclusiv in hero si disparea cand era activ un banner). Pe desktop e vizibil
// permanent; pe mobil e o iconita care deschide inputul intr-un <details> (acelasi
// pattern nativ, fara JS, ca la meniul „Categorii" — functioneaza si pe Safari iOS).
function SearchForm({ autoFocus, className = '' }: { autoFocus?: boolean; className?: string }) {
  return (
    <form action="/cautare" method="get" className={`flex gap-2 ${className}`}>
      <input
        name="q" type="search" placeholder="Caută produs sau brand..." autoComplete="off" autoFocus={autoFocus}
        className="flex-1 min-w-0 px-3 py-1.5 rounded-lg border border-line bg-white text-sm text-[var(--color-text)] placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand"
      />
      <button type="submit" className="px-3 py-1.5 bg-brand hover:bg-brand-dark text-white text-sm font-semibold rounded-lg transition-colors shrink-0">
        Caută
      </button>
    </form>
  )
}

export async function Header() {
  // fallback gol: la build-ul Docker nu exista DB (pre-randarea /_not-found incarca layout-ul)
  const menu = await getMenu().catch(() => [])
  const visible = menu.slice(0, MAX_VISIBLE_ITEMS)
  const overflow = menu.slice(MAX_VISIBLE_ITEMS)

  return (
    <header className="bg-surface border-b border-line sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-4">
        <Link href="/" className="font-black font-archivo text-xl text-brand tracking-tight shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 rounded">
          superieftin<span className="text-[var(--color-text)]">.ro</span>
        </Link>

        <SearchForm className="hidden sm:flex flex-1 max-w-md" />

        {/* ml-auto: pe mobil nu exista niciun element flex-1 inainte (SearchForm desktop e hidden),
            deci fara el iconita + nav-ul ar ramane lipite de logo in loc sa stea la marginea dreapta. */}
        <details className="relative sm:hidden ml-auto">
          <summary
            aria-label="Caută"
            className="list-none [&::-webkit-details-marker]:hidden cursor-pointer flex items-center p-1.5 -m-1.5 rounded hover:text-[var(--color-text)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 text-muted"
          >
            <Search size={20} />
          </summary>
          <div className="absolute right-0 top-full pt-2 z-50 w-72 max-w-[calc(100vw-2rem)]">
            <div className="bg-white border border-line rounded-xl shadow-lg p-3">
              <SearchForm autoFocus />
            </div>
          </div>
        </details>

        <nav className="flex items-center gap-5 text-sm text-muted shrink-0">
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
              <Dropdown items={overflow} align="right" />
            </div>
          )}
          {/* Mobil: tot meniul intr-un singur dropdown, indentat pe niveluri.
              <details>/<summary> nativ (nu group-focus-within): pe Safari iOS un <button>
              fara onClick nu primeste focus la tap, deci CSS-only :focus-within nu se declansa
              niciodata si meniul nu se putea deschide pe mobil. */}
          {menu.length > 0 && (
            <details className="relative sm:hidden">
              <summary
                className="list-none [&::-webkit-details-marker]:hidden cursor-pointer hover:text-[var(--color-text)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 rounded whitespace-nowrap"
              >
                Categorii ▾
              </summary>
              <div className="absolute right-0 top-full pt-2 z-50">
                <div className="bg-white border border-line rounded-xl shadow-lg py-2 min-w-56 max-h-96 overflow-y-auto">
                  <MobileItems items={menu} />
                </div>
              </div>
            </details>
          )}
        </nav>
      </div>
    </header>
  )
}
