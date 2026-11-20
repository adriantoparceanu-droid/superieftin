import Link from 'next/link'
import { SectionTitle } from '@/components/blog/ArticleCard'

// Rândul „Teme” de pe homepage: linkuri spre paginile temelor (/c/<părinte>), aceleași ca în meniu.
export function ThemeLinks({ themes }: { themes: { href: string; label: string }[] }) {
  if (!themes.length) return null
  return (
    <section aria-labelledby="teme">
      <SectionTitle id="teme">Teme</SectionTitle>
      <ul className="mt-4 flex flex-wrap gap-2">
        {themes.map((t) => (
          <li key={t.href}>
            <Link
              href={t.href}
              className="inline-flex h-10 items-center rounded-full bg-surface px-4 text-[14.5px] font-semibold text-ink ring-1 ring-inset ring-line-2 transition-shadow hover:ring-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
            >
              {t.label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
