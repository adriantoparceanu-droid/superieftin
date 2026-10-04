import Link from 'next/link'

// Titlu de secțiune pe homepage (macheta „.sec-h” + „.sec-sub”): titlul la stânga, linkul
// „Toate ›” la dreapta, opțional o frază scurtă dedesubt.
export function SectionHeading({ id, title, href, linkLabel = 'Toate ›', sub }: {
  id: string
  title: string
  href?: string
  linkLabel?: string
  sub?: string
}) {
  return (
    <div className="pt-[18px] pb-2 lg:pt-9 lg:pb-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={id} className="text-[21px] [font-weight:850] text-ink lg:text-[26px]">{title}</h2>
        {href && (
          <Link
            href={href}
            className="shrink-0 text-[13.5px] font-bold text-red-ink hover:underline underline-offset-2 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink lg:text-sm"
          >
            {linkLabel}
          </Link>
        )}
      </div>
      {sub && <p className="mt-0.5 text-[12.5px] text-ink-3 lg:text-sm">{sub}</p>}
    </div>
  )
}
