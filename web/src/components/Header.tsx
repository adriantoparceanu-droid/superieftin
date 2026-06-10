import Link from 'next/link'

export function Header() {
  return (
    <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="font-bold text-xl text-red-600 tracking-tight">
          superieftin<span className="text-gray-900">.ro</span>
        </Link>
        <nav className="flex items-center gap-6 text-sm text-gray-600">
          <Link href="/c/telefoane-mobile" className="hover:text-gray-900 transition-colors">
            Telefoane
          </Link>
          <Link href="/" className="hover:text-gray-900 transition-colors">
            Reduceri azi
          </Link>
        </nav>
      </div>
    </header>
  )
}
