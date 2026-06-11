import Link from 'next/link'
import { getMenu } from '@/lib/queries'

export async function Header() {
  const menu = await getMenu()

  return (
    <header className="bg-surface border-b border-line sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="font-black font-archivo text-xl text-brand tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 rounded">
          superieftin<span className="text-[var(--color-text)]">.ro</span>
        </Link>
        <nav className="flex items-center gap-5 text-sm text-muted overflow-x-auto">
          {menu.map((item) => (
            <div key={item.id} className="relative group shrink-0">
              <Link
                href={item.href}
                className="hover:text-[var(--color-text)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 rounded whitespace-nowrap"
              >
                {item.label}{item.children?.length ? ' ▾' : ''}
              </Link>
              {!!item.children?.length && (
                <div className="absolute left-0 top-full pt-2 hidden group-hover:block group-focus-within:block z-50">
                  <div className="bg-white border border-line rounded-xl shadow-lg py-2 min-w-44">
                    {item.children.map((child) => (
                      <Link
                        key={child.id}
                        href={child.href}
                        className="block px-4 py-1.5 hover:bg-surface hover:text-brand whitespace-nowrap"
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </nav>
      </div>
    </header>
  )
}
