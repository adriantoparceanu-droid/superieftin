import Link from 'next/link'
import { ArticleByline, ArticleImage, TypeLabel } from '@/components/blog/ArticleCard'
import type { BlogGuide } from '@/lib/guides/blog'

// Articolul principal al homepage-ului (varianta A „Revista”): poza mare, eticheta tipului,
// titlu mare (Archivo 800, ~52px pe desktop), dek si semnatura.
export function FeaturedArticle({ guide }: { guide: BlogGuide }) {
  return (
    <article className="group relative">
      <ArticleImage guide={guide} sizes="(min-width: 1280px) 860px, (min-width: 1024px) 66vw, 100vw" priority />
      <TypeLabel title={guide.title} className="mt-4" />
      <h2 className="mt-2 font-display text-[32px] font-extrabold leading-[1.04] tracking-[-0.02em] text-ink sm:text-[42px] lg:text-[52px]">
        <Link
          href={`/ghiduri/${guide.slug}`}
          className="after:absolute after:inset-0 group-hover:text-red-ink focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ink"
        >
          {guide.title}
        </Link>
      </h2>
      {guide.meta_description && (
        <p className="mt-3 max-w-[44rem] text-[17px] leading-relaxed text-ink-2 sm:text-[19px]">{guide.meta_description}</p>
      )}
      <ArticleByline guide={guide} className="mt-3" />
    </article>
  )
}
