import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  getPublishedGuide, getGuideProductIds, loadLiveProducts, refsKey, getGuideTheme, getRelatedGuides,
  type Guide, type GuideAuthor,
} from '@/lib/guides/queries'
import { articleLd, articleProducts, articleCrumbs, ldScript } from '@/lib/guides/jsonld'
import { collectRefs, splitGuideBody } from '@/lib/guides/markers'
import { guideToc } from '@/lib/guides/toc'
import { RSS_PATH, RSS_TITLE } from '@/lib/guides/rss'
import { formatGuideDate } from '@/lib/guides/format'
import { renderMarkdown } from '@/lib/guides/markdown'
import { GuideBody, PROSE_CLASS } from '@/components/guides/GuideBody'
import { ARTICLE_CARD, ARTICLE_H1 } from '@/components/article'
import { Crumbs, InfoIcon } from '@/components/listing/ListingParts'

// ISR: pagina se regenereaza cel mult la 15 minute (preturile din blocurile live raman proaspete),
// iar la salvare / publicare din admin se invalideaza imediat (revalidatePath).
export const revalidate = 900
export const dynamicParams = true

// Nimic la build (DB-ul nu e accesibil la build); fiecare ghid se randeaza la prima vizita si se
// pastreaza in cache. Lista goala = ISR pe cai necunoscute (vezi docs generateStaticParams).
export async function generateStaticParams() {
  return []
}

type Props = { params: Promise<{ slug: string }> }

// Referintele de produs din corp + cele legate in admin — aceeasi cheie pentru toate query-urile
// (React cache() refoloseste rezultatul intre metadata, pagina si GuideBody).
async function guideRefs(guide: Guide) {
  const bodyRefs = collectRefs(splitGuideBody(guide.body_md))
  const linkedIds = await getGuideProductIds(guide.id)
  return { bodyRefs, linkedIds, key: refsKey(bodyRefs) }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const guide = await getPublishedGuide(slug)
  if (!guide) return { title: 'Ghid negăsit' }
  const description = guide.meta_description ?? undefined
  return {
    title: guide.title,
    description,
    alternates: {
      canonical: `/ghiduri/${guide.slug}`,
      types: { 'application/rss+xml': [{ url: RSS_PATH, title: RSS_TITLE }] },
    },
    // Imaginea (og:image) vine din opengraph-image.tsx de langa pagina — Next o adauga singur.
    openGraph: {
      type: 'article',
      // openGraph din pagina inlocuieste complet pe cel din layout → repetam siteName / locale
      siteName: 'superieftin.ro',
      locale: 'ro_RO',
      title: guide.title,
      description,
      url: `/ghiduri/${guide.slug}`,
      publishedTime: guide.published_at ?? undefined,
      modifiedTime: guide.updated_at,
      ...(guide.author ? { authors: [`/autori/${guide.author.slug}`] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: guide.title,
      description,
      images: [`/ghiduri/${guide.slug}/opengraph-image`],
    },
  }
}

// Numele autorului / verificatorului → pagina lui (/autori/<slug>)
function AuthorLink({ a }: { a: GuideAuthor }) {
  return (
    <Link href={`/autori/${a.slug}`} className="font-semibold text-ink underline-offset-2 hover:text-red-ink hover:underline">
      {a.name}
    </Link>
  )
}

export default async function GuidePage({ params }: Props) {
  const { slug } = await params
  const guide = await getPublishedGuide(slug)
  // Ciornele si ghidurile retrase nu sunt publice → 404
  if (!guide) notFound()

  const { bodyRefs, linkedIds, key } = await guideRefs(guide)
  const [live, theme] = await Promise.all([
    loadLiveProducts(key),
    getGuideTheme(guide.id, guide.category_slug, refsKey([...bodyRefs, ...linkedIds])),
  ])
  const related = await getRelatedGuides(guide.id, key).catch(() => [])

  // JSON-LD: articol + pagina (verificator) + firimituri + lista produselor + recenziile editoriale
  // (doar produsele cu pro/contra) + FAQ. Fara preturi si fara linkuri spre /p/ (lib/guides/jsonld.ts).
  const ldInput = {
    slug: guide.slug,
    title: guide.title,
    description: guide.meta_description,
    publishedAt: guide.published_at,
    updatedAt: guide.updated_at,
    section: theme,
    author: guide.author,
    reviewer: guide.reviewer,
    products: articleProducts(guide.body_md, live),
    faq: guide.faq,
  }
  const ld = articleLd(ldInput)
  const crumbs = articleCrumbs(ldInput)

  const faq = guide.faq.filter((f) => f.q.trim() && f.a.trim())
  const toc = guideToc(guide.body_md)
  const updatedDiffers = guide.published_at && formatGuideDate(guide.published_at) !== formatGuideDate(guide.updated_at)

  return (
    <>
      {ld.map((d, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldScript(d) }} />
      ))}

      <div className="mx-auto mb-3 max-w-[46rem]">
        <Crumbs items={crumbs.map((c, i) => (i < crumbs.length - 1 ? { label: c.name, href: c.path } : { label: c.name }))} />
      </div>

      <article className={ARTICLE_CARD}>
        {theme && (
          <Link href={`/c/${theme.slug}`} className="text-[12px] font-extrabold uppercase tracking-[.06em] text-red-ink hover:underline underline-offset-2">
            {theme.name}
          </Link>
        )}
        <h1 className={`mt-1.5 ${ARTICLE_H1}`}>{guide.title}</h1>

        {/* Semnatura: autor, verificator (cu link spre pagina lor), date — sub titlu */}
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 border-y border-line py-3 text-[13.5px] text-ink-3">
          {guide.author && <span>De <AuthorLink a={guide.author} /></span>}
          {guide.reviewer && <span>Verificat de: <AuthorLink a={guide.reviewer} /></span>}
          {guide.published_at && (
            <span>Publicat: <time dateTime={guide.published_at} className="text-ink-2">{formatGuideDate(guide.published_at)}</time></span>
          )}
          {updatedDiffers && (
            <span>Actualizat: <time dateTime={guide.updated_at} className="text-ink-2">{formatGuideDate(guide.updated_at)}</time></span>
          )}
        </div>

        {/* Mentiunea de afiliere — vizibila inainte de orice link spre magazin */}
        <p className="mt-4 flex gap-2 rounded-xl bg-surface-2 px-3 py-2.5 text-[12.5px] leading-snug text-ink-3">
          <InfoIcon className="mt-px h-4 w-4 shrink-0" />
          <span>
            Unele linkuri sunt de afiliere: dacă cumperi, primim un comision, fără cost pentru tine.{' '}
            <Link href="/ghiduri/metodologie" className="text-red-ink underline underline-offset-2">Cum lucrăm</Link>
          </span>
        </p>

        {guide.summary && (
          <section aria-labelledby="pe-scurt" className="mt-6 rounded-xl border-l-[3px] border-red bg-surface-2 px-4 py-3.5">
            <h2 id="pe-scurt" className="mb-1.5 text-[13px] font-extrabold uppercase tracking-[.06em] text-red-ink">Pe scurt</h2>
            <div className={PROSE_CLASS} dangerouslySetInnerHTML={{ __html: renderMarkdown(guide.summary) }} />
          </section>
        )}

        {/* Cuprins: H2-urile din corp (id-uri puse de lib/guides/markdown.ts) + FAQ. Doar de la 2 sectiuni. */}
        {toc.length + (faq.length ? 1 : 0) >= 2 && (
          <nav aria-labelledby="cuprins" className="mt-6 border-l-[3px] border-line pl-4">
            <h2 id="cuprins" className="text-[13px] font-extrabold uppercase tracking-[.06em] text-ink-3">Cuprins</h2>
            <ol className="mt-2 space-y-1.5 text-[15px] leading-snug">
              {toc.map((h) => (
                <li key={h.id}><a href={`#${h.id}`} className="text-ink-2 underline-offset-2 hover:text-red-ink hover:underline">{h.text}</a></li>
              ))}
              {faq.length > 0 && (
                <li><a href="#faq" className="text-ink-2 underline-offset-2 hover:text-red-ink hover:underline">Întrebări frecvente</a></li>
              )}
            </ol>
          </nav>
        )}

        <div className="mt-6">
          <GuideBody body={guide.body_md} />
        </div>

        {faq.length > 0 && (
          <section aria-labelledby="faq" className="mt-10">
            <h2 id="faq" className="text-[21px] font-extrabold leading-tight text-ink sm:text-[24px]">Întrebări frecvente</h2>
            <div className="mt-3 divide-y divide-line border-y border-line">
              {faq.map((f, i) => (
                <div key={i} className="py-4">
                  <h3 className="text-[17px] font-bold leading-snug text-ink">{f.q}</h3>
                  <p className="mt-1.5 whitespace-pre-line text-[16px] leading-[1.65] text-ink-2 sm:text-[17px]">{f.a}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        <p className="mt-8 text-xs leading-relaxed text-ink-3">
          Prețurile din articol se actualizează automat din datele noastre; prețul final este cel
          afișat de magazin la comandă. Vezi{' '}
          <Link href="/ghiduri/metodologie" className="underline underline-offset-2 hover:text-ink">metodologia</Link>.
        </p>
      </article>

      {/* Articole inrudite: aceleasi categorii de produse (sau acelasi parinte), altfel cele mai noi */}
      {related.length > 0 && (
        <section aria-labelledby="articole-inrudite" className="mx-auto mt-6 max-w-[46rem]">
          <h2 id="articole-inrudite" className="text-[18px] font-extrabold text-ink">Articole înrudite</h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {related.map((r) => (
              <li key={r.slug}>
                <Link href={`/ghiduri/${r.slug}`} className="block h-full rounded-2xl bg-surface p-4 shadow-card ring-1 ring-transparent transition hover:ring-line-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink">
                  {r.category_name && (
                    <span className="text-[11.5px] font-extrabold uppercase tracking-[.06em] text-red-ink">{r.category_name}</span>
                  )}
                  <span className="mt-1 block font-display text-[16px] font-extrabold leading-snug text-ink">{r.title}</span>
                  {r.meta_description && (
                    <span className="mt-1.5 block text-[13.5px] leading-snug text-ink-3 line-clamp-2">{r.meta_description}</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
