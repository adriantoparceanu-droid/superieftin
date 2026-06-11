import Link from 'next/link'
import type { CategoryInfo } from '@/lib/queries'

interface Props {
  activeCategories: CategoryInfo[]
}

// Grila de categorii de pe homepage — categoriile vizibile administrate in /admin/categorii
export function CategoryGrid({ activeCategories }: Props) {
  if (!activeCategories.length) return null

  return (
    <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
      {activeCategories.slice(0, 8).map((cat) => (
        <Link
          key={cat.category}
          href={`/c/${cat.category}`}
          className="flex flex-col items-center gap-1 p-3 rounded-xl bg-surface border border-line hover:border-brand hover:text-brand transition-colors text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        >
          <span className="text-2xl leading-none">{cat.icon || '🛒'}</span>
          <span className="text-xs font-semibold text-[var(--color-text)] leading-tight mt-0.5">{cat.name ?? cat.category}</span>
          <span className="text-[10px] text-muted">{cat.count.toLocaleString('ro-RO')} produse</span>
        </Link>
      ))}
    </div>
  )
}
