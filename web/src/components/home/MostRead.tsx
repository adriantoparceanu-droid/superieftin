import Link from 'next/link'
import { SectionTitle } from '@/components/blog/ArticleCard'
import { articleType, type BlogGuide } from '@/lib/guides/blog'

// „Cele mai citite” (coloana din dreapta pe desktop, sub articolul principal pe telefon):
// numerotate 1–4 cu cifre mari rosii. Ordinea vine din mostReadGuides (GA4, 30 de zile).
export function MostRead({ guides }: { guides: BlogGuide[] }) {
  if (!guides.length) return null
  return (
    <section aria-labelledby="cele-mai-citite">
      <SectionTitle id="cele-mai-citite">Cele mai citite</SectionTitle>
      <ol className="mt-1">
        {guides.map((g, i) => (
          <li key={g.slug} className="group relative flex gap-4 border-b border-line py-4 last:border-b-0">
            <span aria-hidden="true" className="w-7 shrink-0 font-display text-[34px] font-extrabold leading-none tabular-nums text-red-ink">
              {i + 1}
            </span>
            <div className="min-w-0">
              <span className="block text-[11.5px] font-extrabold uppercase tracking-[.08em] text-ink-3">{articleType(g.title)}</span>
              <h3 className="mt-1 font-display text-[18px] font-extrabold leading-snug text-ink">
                <Link
                  href={`/ghiduri/${g.slug}`}
                  className="after:absolute after:inset-0 group-hover:text-red-ink focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ink"
                >
                  {g.title}
                </Link>
              </h3>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
