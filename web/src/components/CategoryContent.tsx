// Textul unei teme (/c/[categorie]): introducerea + intrebarile frecvente, scrise in Admin →
// Categorii → „text” (coloanele intro_md / faq, migratia 030). Cifrele din text sunt marcaje
// {{cat:…}} randate live (lib/category-markers.ts).
//
// Pe pagina temei (blogul, 20.11.2026) textul e impartit: introducerea SUS (part="intro"), sub
// titlu, iar intrebarile frecvente JOS (part="faq"), dupa lista de articole. Previzualizarea din
// admin arata tot (part="all", implicit).
import { ldScript } from '@/lib/guides/jsonld'
import { getCategoryContent, getCategoryStats } from '@/lib/category-content'
import { renderCategoryMarkers, renderCategoryMarkdown, categoryFaqLd, formatDateTime, type CategoryFaqItem, type CategoryStats } from '@/lib/category-markers'

export type CategoryContentPart = 'intro' | 'faq' | 'all'

const PROSE = `text-[15px] leading-relaxed text-ink-2 space-y-3
  [&_a]:text-red-ink [&_strong]:text-ink [&_a]:underline [&_a]:underline-offset-2
  [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_strong]:font-semibold`

export async function CategoryContent({ slug, name, part = 'all' }: { slug: string; name: string; part?: CategoryContentPart }) {
  const content = await getCategoryContent(slug)
  if (!content || (!content.intro_md?.trim() && content.faq.length === 0)) return null

  const stats = await getCategoryStats(slug)
  // Categorie fara produse disponibile (ex. magazin pus pe pauza): textul ar vorbi despre
  // „0 produse” — mai bine nu aratam nimic pana revin produsele.
  if (stats.produse === 0) return null

  return <CategoryContentView name={name} intro={content.intro_md} faq={content.faq} stats={stats} part={part} />
}

// Partea de afisare, refolosita si de previzualizarea din admin
export function CategoryContentView({ name, intro, faq, stats, part = 'all' }: {
  name: string
  intro: string | null
  faq: CategoryFaqItem[]
  stats: CategoryStats
  part?: CategoryContentPart
}) {
  const hasIntro = !!intro?.trim() && part !== 'faq'
  const hasFaq = faq.length > 0 && part !== 'intro'
  if (!hasIntro && !hasFaq) return null
  // FAQPage JSON-LD doar acolo unde se vad intrebarile (o singura data pe pagina)
  const faqLd = hasFaq ? categoryFaqLd(faq, stats) : null
  // Nota despre cifre: o singura data — sub introducere daca exista, altfel sub intrebari
  const showNote = part === 'intro' ? hasIntro : part === 'faq' ? !intro?.trim() : true

  const note = showNote && (
    <p className="mt-6 text-xs text-ink-3">
      Cifrele din acest text sunt calculate automat din ofertele disponibile, la momentul actualizării: {formatDateTime(stats.actualizat)}.
    </p>
  )

  if (part === 'intro') {
    return (
      <div className="max-w-3xl text-ink">
        <div className={`${PROSE} text-[16px] sm:text-[17px]`} dangerouslySetInnerHTML={{ __html: renderCategoryMarkdown(intro ?? '', stats) }} />
        {note}
      </div>
    )
  }

  return (
    <section aria-labelledby={hasIntro ? 'despre-categorie' : 'intrebari-frecvente'} className={part === 'faq' ? 'max-w-3xl text-ink' : 'mt-12 border-t border-line pt-8 max-w-3xl text-ink'}>
      {faqLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldScript(faqLd) }} />}

      {hasIntro && (
        <>
          <h2 id="despre-categorie" className="text-xl font-extrabold text-ink mb-3">Despre {name}</h2>
          <div className={PROSE} dangerouslySetInnerHTML={{ __html: renderCategoryMarkdown(intro ?? '', stats) }} />
        </>
      )}

      {hasFaq && (
        <div className={hasIntro ? 'mt-8' : ''}>
          <h2 id="intrebari-frecvente" className="text-xl font-extrabold text-ink mb-3">
            Întrebări frecvente despre {name}
          </h2>
          <div className="space-y-5">
            {faq.map((f, i) => (
              <div key={i}>
                <h3 className="text-base font-bold text-ink">{renderCategoryMarkers(f.q, stats, 'plain')}</h3>
                <div className={`mt-1 ${PROSE}`} dangerouslySetInnerHTML={{ __html: renderCategoryMarkdown(f.a, stats) }} />
              </div>
            ))}
          </div>
        </div>
      )}

      {note}
    </section>
  )
}
