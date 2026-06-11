import Image from 'next/image'
import Link from 'next/link'
import { CategoryIcon } from './CategoryIcon'
import type { CategoryInfo } from '@/lib/queries'

interface Props {
  activeCategories: CategoryInfo[]
  thumbs?: Record<string, string>   // slug categorie -> imagine produs reprezentativ
}

// Grila de categorii in stil Porto: imaginea unui produs real per categorie,
// cu fallback pe iconita setata in /admin/categorii
export function CategoryGrid({ activeCategories, thumbs = {} }: Props) {
  if (!activeCategories.length) return null

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {activeCategories.slice(0, 8).map((cat) => {
        const thumb = thumbs[cat.category]
        return (
          <Link
            key={cat.category}
            href={`/c/${cat.category}`}
            className="group bg-surface border border-line rounded-xl overflow-hidden hover:border-brand transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
          >
            <div className="relative h-28 bg-white">
              {thumb ? (
                <Image
                  src={thumb} alt={cat.name ?? cat.category} fill sizes="(max-width: 640px) 50vw, 25vw"
                  className="object-contain p-3 group-hover:scale-105 transition-transform" unoptimized
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <CategoryIcon name={cat.icon} className="w-10 h-10 text-muted group-hover:text-brand transition-colors" />
                </div>
              )}
            </div>
            <div className="px-3 py-2.5 text-center">
              <p className="text-sm font-semibold text-[var(--color-text)] leading-tight group-hover:text-brand transition-colors flex items-center justify-center gap-1.5">
                <CategoryIcon name={cat.icon} className="w-4 h-4 text-brand shrink-0" />
                {cat.name ?? cat.category}
              </p>
              <p className="text-[11px] text-muted mt-0.5">{cat.count.toLocaleString('ro-RO')} produse</p>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
