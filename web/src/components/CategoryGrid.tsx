import Link from 'next/link'
import { CategoryIcon } from './CategoryIcon'
import type { CategoryInfo } from '@/lib/queries'

interface Props {
  activeCategories: CategoryInfo[]
}

// Grila de categorii de pe homepage: iconita lucide a categoriei (setata in
// /admin/categorii), mare si centrata, pe un disc in culoarea brandului
export function CategoryGrid({ activeCategories }: Props) {
  if (!activeCategories.length) return null

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {activeCategories.slice(0, 8).map((cat) => (
        <Link
          key={cat.category}
          href={`/c/${cat.category}`}
          className="group bg-surface border border-line rounded-xl overflow-hidden hover:border-brand transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        >
          <div className="flex items-center justify-center h-24">
            <span className="flex items-center justify-center w-14 h-14 rounded-full bg-brand/10 group-hover:bg-brand/20 transition-colors">
              <CategoryIcon name={cat.icon} className="w-7 h-7 text-brand group-hover:scale-110 transition-transform" />
            </span>
          </div>
          <div className="px-3 pb-3 text-center">
            <p className="text-sm font-semibold text-[var(--color-text)] leading-tight group-hover:text-brand transition-colors">
              {cat.name ?? cat.category}
            </p>
            <p className="text-[11px] text-muted mt-0.5">{cat.count.toLocaleString('ro-RO')} produse</p>
          </div>
        </Link>
      ))}
    </div>
  )
}
