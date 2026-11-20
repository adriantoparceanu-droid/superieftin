import Image from 'next/image'
import Link from 'next/link'
import { articleType, readingMinutes, type BlogGuide } from '@/lib/guides/blog'
import { formatGuideDate } from '@/lib/guides/format'

// Piesele comune ale listelor de articole (varianta A „Revista”): homepage, pagina temei (/c/),
// /ghiduri, cautarea. Doar tokeni de culoare (merg si in modul intunecat).

// Eticheta tipului de articol: majuscule rosii (text-red-ink = rosul lizibil ca TEXT)
export function TypeLabel({ title, className = '' }: { title: string; className?: string }) {
  return (
    <span className={`block text-[12px] font-extrabold uppercase tracking-[.08em] text-red-ink ${className}`}>
      {articleType(title)}
    </span>
  )
}

// „De <autor> · actualizat <data> · N min”
export function ArticleByline({ guide, className = '' }: { guide: BlogGuide; className?: string }) {
  const parts = [
    guide.author_name ? `De ${guide.author_name}` : null,
    `actualizat ${formatGuideDate(guide.updated_at)}`,
    `${readingMinutes(guide.words)} min`,
  ].filter(Boolean)
  return (
    <p className={`text-[13px] text-ink-3 ${className}`}>
      {parts.join(' · ')}
    </p>
  )
}

// Poza articolului, cu proportie FIXA (fara salt de pagina la incarcare). Articolele nu au poza
// proprie: folosim poza primului produs legat (guide_products), pe fundal deschis — pozele de la
// magazine au aproape mereu fundal alb; fara ea, imaginea Open Graph generata a articolului.
export function ArticleImage({ guide, sizes, priority = false, className = '' }: {
  guide: BlogGuide
  sizes: string
  priority?: boolean
  className?: string
}) {
  const product = guide.image_url
  return (
    <div className={`relative aspect-[16/9] overflow-hidden ${product ? 'bg-surface-2 dark:bg-white' : 'bg-surface-2'} ${className}`}>
      <Image
        src={product ?? `/ghiduri/${guide.slug}/opengraph-image`}
        alt=""
        fill
        sizes={sizes}
        // unoptimized: poze externe (CDN-urile magazinelor) si imaginea OG (deja PNG la dimensiunea finala)
        unoptimized
        // Imaginea articolului principal (deasupra pliului): incarcata imediat, cu prioritate
        {...(priority ? { loading: 'eager' as const, fetchPriority: 'high' as const } : {})}
        className={product ? 'object-contain p-[8%] mix-blend-multiply' : 'object-cover'}
      />
    </div>
  )
}

// Cardul din grila „Articole noi” / lista temei: poza, eticheta, titlu, dek, semnatura.
// Tot cardul e clicabil (linkul titlului se intinde peste card cu after:absolute).
export function ArticleCard({ guide, headingLevel = 3 }: { guide: BlogGuide; headingLevel?: 2 | 3 }) {
  const H = headingLevel === 2 ? 'h2' : 'h3'
  return (
    <article className="group relative flex flex-col">
      <ArticleImage guide={guide} sizes="(min-width: 1024px) 400px, (min-width: 640px) 50vw, 100vw" />
      <TypeLabel title={guide.title} className="mt-3" />
      <H className="mt-1.5 font-display text-[20px] font-extrabold leading-[1.15] text-ink sm:text-[24px]">
        <Link
          href={`/ghiduri/${guide.slug}`}
          className="after:absolute after:inset-0 group-hover:text-red-ink focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ink"
        >
          {guide.title}
        </Link>
      </H>
      {guide.meta_description && (
        <p className="mt-2 line-clamp-3 text-[15px] leading-relaxed text-ink-2">{guide.meta_description}</p>
      )}
      <ArticleByline guide={guide} className="mt-2" />
    </article>
  )
}

// Grila de carduri: 1 coloana pe telefon, 2 pe tableta, 3 pe desktop
export function ArticleGrid({ guides, headingLevel = 3 }: { guides: BlogGuide[]; headingLevel?: 2 | 3 }) {
  return (
    <ul className="grid gap-x-6 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
      {guides.map((g) => (
        <li key={g.slug}><ArticleCard guide={g} headingLevel={headingLevel} /></li>
      ))}
    </ul>
  )
}

// Titlul unei rubrici: separator negru gros de 3px deasupra (semnatura „Revista”)
export function SectionTitle({ id, children, className = '' }: { id: string; children: React.ReactNode; className?: string }) {
  return (
    <h2 id={id} className={`border-t-[3px] border-ink pt-3 font-display text-[13px] font-extrabold uppercase tracking-[.1em] text-ink ${className}`}>
      {children}
    </h2>
  )
}
