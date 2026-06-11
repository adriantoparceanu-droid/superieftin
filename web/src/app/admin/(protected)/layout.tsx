import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/session'
import { logoutAction } from '@/lib/admin/actions'

const NAV = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/mapare', label: 'Mapare categorii' },
  { href: '/admin/categorii', label: 'Categorii' },
  { href: '/admin/taguri', label: 'Taguri' },
  { href: '/admin/meniu', label: 'Meniu' },
  { href: '/admin/import', label: 'Import feed' },
  { href: '/admin/utilizatori', label: 'Utilizatori' },
]

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
          {NAV.map((item) => (
            <Link
              key={item.href} href={item.href}
              className="block px-3 py-2 rounded-lg text-sm hover:bg-surface hover:text-brand"
            >
              {item.label}
            </Link>
          ))}
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
