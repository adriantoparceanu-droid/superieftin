// Zona de continut a paginii de categorie (/c/[categorie]): textul introductiv + intrebari
// frecvente, scrise in Admin → Categorii → „text” (coloanele intro_md / faq, migratia 030).
// Cifrele din text sunt marcaje {{cat:…}} randate live (lib/category-markers.ts).
//
// Se afiseaza sub lista de produse, ca vizitatorul sa vada intai produsele. Pagina decide
// CAND (doar pagina 1, fara filtre); componenta decide DACA (exista text si produse).
import { ldScript } from '@/lib/guides/jsonld'
import { getCategoryContent, getCategoryStats } from '@/lib/category-content'
import { renderCategoryMarkers, renderCategoryMarkdown, categoryFaqLd, formatDateTime, type CategoryFaqItem, type CategoryStats } from '@/lib/category-markers'

const PROSE = `text-[15px] leading-relaxed text-[var(--color-text)] space-y-3
  [&_a]:text-red-ink [&_a]:underline [&_a]:underline-offset-2
  [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_strong]:font-semibold`

export async function CategoryContent({ slug, name }: { slug: string; name: string }) {
  const content = await getCategoryContent(slug)
  if (!content || (!content.intro_md?.trim() && content.faq.length === 0)) return null

  const stats = await getCategoryStats(slug)
  // Categorie fara produse disponibile (ex. magazin pus pe pauza): textul ar vorbi despre
  // „0 produse” — mai bine nu aratam nimic pana revin produsele.
  if (stats.produse === 0) return null

  return <CategoryContentView name={name} intro={content.intro_md} faq={content.faq} stats={stats} />
}

// Partea de afisare, refolosita si de previzualizarea din admin
export function CategoryContentView({ name, intro, faq, stats }: {
  name: string
  intro: string | null
  faq: CategoryFaqItem[]
  stats: CategoryStats
}) {
  const faqLd = categoryFaqLd(faq, stats)
  return (
    <section aria-labelledby="despre-categorie" className="mt-12 border-t border-line pt-8 max-w-3xl">
      {faqLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldScript(faqLd) }} />}

      {intro?.trim() && (
        <>
          <h2 id="despre-categorie" className="font-archivo text-xl font-bold mb-3">Despre {name}</h2>
          <div className={PROSE} dangerouslySetInnerHTML={{ __html: renderCategoryMarkdown(intro, stats) }} />
        </>
      )}

      {faq.length > 0 && (
        <div className={intro?.trim() ? 'mt-8' : ''}>
          <h2 id={intro?.trim() ? 'intrebari-frecvente' : 'despre-categorie'} className="font-archivo text-xl font-bold mb-3">
            Întrebări frecvente despre {name}
          </h2>
          <div className="space-y-5">
            {faq.map((f, i) => (
              <div key={i}>
                <h3 className="font-semibold">{renderCategoryMarkers(f.q, stats, 'plain')}</h3>
                <div className={`mt-1 ${PROSE}`} dangerouslySetInnerHTML={{ __html: renderCategoryMarkdown(f.a, stats) }} />
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="mt-6 text-xs text-muted">
        Cifrele din acest text sunt calculate automat din ofertele disponibile, la momentul actualizării: {formatDateTime(stats.actualizat)}.
      </p>
    </section>
  )
}
