import Link from 'next/link'

export function Header() {
  return (
    <header className="bg-surface border-b border-line sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="font-black font-archivo text-xl text-brand tracking-tight">
          superieftin<span className="text-[var(--color-text)]">.ro</span>
        </Link>
        <nav className="flex items-center gap-6 text-sm text-muted">
          <Link href="/c/telefoane-mobile" className="hover:text-[var(--color-text)] transition-colors">
            Telefoane
          </Link>
          <Link href="/" className="hover:text-[var(--color-text)] transition-colors">
            Reduceri azi
          </Link>
        </nav>
      </div>
    </header>
  )
}
