import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/session'
import { logoutAction } from '@/lib/admin/actions'

type NavItem = { href: string; label: string }
type NavEntry = NavItem | { group: string; children: NavItem[] }

const NAV: NavEntry[] = [
  { href: '/admin', label: 'Dashboard' },
  {
    group: 'Feeduri',
    children: [
      { href: '/admin/surse-feed', label: 'Surse feed' },
      { href: '/admin/import', label: 'Import manual' },
      { href: '/admin/advertiseri', label: 'Advertiseri' },
      { href: '/admin/mapare', label: 'Mapare categorii' },
    ],
  },
  { href: '/admin/categorii', label: 'Categorii' },
  { href: '/admin/taguri', label: 'Taguri' },
  { href: '/admin/meniu', label: 'Meniu' },
  { href: '/admin/bannere', label: 'Bannere' },
  { href: '/admin/utilizatori', label: 'Utilizatori' },
]

const linkClass = 'block px-3 py-2 rounded-lg text-sm hover:bg-surface hover:text-brand'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin()

  return (
    <div className="min-h-screen flex bg-surface">
      <aside className="w-56 shrink-0 border-r border-line bg-white flex flex-col">
        <div className="p-4 border-b border-line">
          <Link href="/admin" className="font-bold text-brand">superieftin admin</Link>
          <p className="text-xs text-muted mt-1 truncate">{user.email}</p>
        </div>
        <nav className="flex-1 p-2">
          {NAV.map((entry) =>
            'group' in entry ? (
              <div key={entry.group} className="mt-3 mb-1">
                <p className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted">{entry.group}</p>
                {entry.children.map((item) => (
                  <Link key={item.href} href={item.href} className={`${linkClass} pl-6`}>
                    {item.label}
                  </Link>
                ))}
              </div>
            ) : (
              <Link key={entry.href} href={entry.href} className={linkClass}>
                {entry.label}
              </Link>
            )
          )}
        </nav>
        <div className="p-2 border-t border-line">
          <Link href="/" className="block px-3 py-2 text-sm text-muted hover:text-brand">← Vezi site-ul</Link>
          <form action={logoutAction}>
            <button type="submit" className="w-full text-left px-3 py-2 rounded-lg text-sm text-muted hover:bg-surface">
              Deconectare
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 p-6 overflow-x-auto">{children}</main>
    </div>
  )
}
