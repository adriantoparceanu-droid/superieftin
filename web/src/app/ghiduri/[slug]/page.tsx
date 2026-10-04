import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getPublishedGuide, getGuideProductIds, loadLiveProducts, refsKey } from '@/lib/guides/queries'
import { blogPostingLd, breadcrumbLd, faqLd, productLd, ldScript } from '@/lib/guides/jsonld'
import { formatGuideDate } from '@/lib/guides/format'
import { renderMarkdown } from '@/lib/guides/markdown'
import { formatPrice } from '@/lib/discount'
import { GuideBody, PROSE_CLASS } from '@/components/guides/GuideBody'
import { ARTICLE_CARD, ARTICLE_H1 } from '@/components/article'
import { Crumbs, InfoIcon } from '@/components/listing/ListingParts'

// ISR: pagina se regenereaza cel mult la 15 minute (preturile din blocurile live raman proaspete,
// ca pe /reduceri-reale/), iar la salvare / publicare din admin se invalideaza imediat (revalidatePath).
export const revalidate = 900
export const dynamicParams = true

// Nimic la build (DB-ul nu e accesibil la build); fiecare ghid se randeaza la prima vizita si se
// pastreaza in cache. Lista goala = ISR pe cai necunoscute (vezi docs generateStaticParams).
export async function generateStaticParams() {
  return []
}

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const guide = await getPublishedGuide(slug)
  if (!guide) return { title: 'Ghid negăsit' }
  const description = guide.meta_description ?? undefined
  return {
    title: guide.title,
    description,
    alternates: { canonical: `/ghiduri/${guide.slug}` },
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
    },
  }
}

export default async function GuidePage({ params }: Props) {
  const { slug } = await params
  const guide = await getPublishedGuide(slug)
  // Ciornele si ghidurile retrase nu sunt publice → 404
  if (!guide) notFound()

  const linkedIds = await getGuideProductIds(guide.id)
  const linked = await loadLiveProducts(refsKey(linkedIds))
  const linkedProducts = linkedIds.map((id) => linked.get(id)).filter((p) => !!p)

  const ld = [
    blogPostingLd(guide),
    breadcrumbLd(guide),
    faqLd(guide),
    ...linkedProducts.map(productLd),
  ].filter(Boolean)

  const updatedDiffers = guide.published_at && formatGuideDate(guide.published_at) !== formatGuideDate(guide.updated_at)

  const nameOf = (a: NonNullable<typeof guide.author>) =>
    a.url
      ? <Link href={a.url} className="font-semibold text-ink underline-offset-2 hover:text-red-ink hover:underline">{a.name}</Link>
      : <span className="font-semibold text-ink">{a.name}</span>

  return (
    <>
      {ld.map((d, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldScript(d) }} />
      ))}

      <div className="mx-auto mb-3 max-w-[46rem]">
        <Crumbs items={[{ label: 'Acasă', href: '/' }, { label: 'Ghiduri', href: '/ghiduri' }, { label: guide.title }]} />
      </div>

      <article className={ARTICLE_CARD}>
        {guide.category_slug && guide.category_name && (
          <Link href={`/c/${guide.category_slug}`} className="text-[12px] font-extrabold uppercase tracking-[.06em] text-red-ink hover:underline underline-offset-2">
            {guide.category_name}
          </Link>
        )}
        <h1 className={`mt-1.5 ${ARTICLE_H1}`}>{guide.title}</h1>

        {/* Semnatura: autor, verificator, date — sub titlu, cum promite /ghiduri/metodologie */}
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 border-y border-line py-3 text-[13.5px] text-ink-3">
          {guide.author && <span>De {nameOf(guide.author)}</span>}
          {guide.reviewer && <span>Verificat de: {nameOf(guide.reviewer)}</span>}
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
            Articolul conține linkuri de afiliere: dacă cumperi prin ele, primim un comision de la magazin,
            fără cost suplimentar pentru tine. Comisionul nu schimbă ordinea ofertelor.{' '}
            <Link href="/ghiduri/metodologie" className="text-red-ink underline underline-offset-2">Cum lucrăm</Link>
          </span>
        </p>

        {guide.summary && (
          <section aria-labelledby="pe-scurt" className="mt-6 rounded-xl border-l-[3px] border-red bg-surface-2 px-4 py-3.5">
            <h2 id="pe-scurt" className="mb-1.5 text-[13px] font-extrabold uppercase tracking-[.06em] text-red-ink">Pe scurt</h2>
            <div className={PROSE_CLASS} dangerouslySetInnerHTML={{ __html: renderMarkdown(guide.summary) }} />
          </section>
        )}

        <div className="mt-6">
          <GuideBody body={guide.body_md} />
        </div>

        {guide.faq.length > 0 && (
          <section aria-labelledby="faq" className="mt-10">
            <h2 id="faq" className="text-[21px] font-extrabold leading-tight text-ink sm:text-[24px]">Întrebări frecvente</h2>
            <div className="mt-3 divide-y divide-line border-y border-line">
              {guide.faq.map((f, i) => (
                <div key={i} className="py-4">
                  <h3 className="text-[17px] font-bold leading-snug text-ink">{f.q}</h3>
                  <p className="mt-1.5 whitespace-pre-line text-[16px] leading-[1.65] text-ink-2 sm:text-[17px]">{f.a}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Legaturi interne spre paginile de produs (fiecare cu istoricul complet de pret) */}
        {linkedProducts.length > 0 && (
          <section aria-labelledby="produse" className="mt-10">
            <h2 id="produse" className="text-[18px] font-extrabold text-ink">Produsele din acest ghid</h2>
            <ul className="mt-2 divide-y divide-line text-sm">
              {linkedProducts.map((p) => (
                <li key={p.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2.5">
                  <Link href={`/p/${p.slug}`} className="min-w-0 font-semibold text-ink underline-offset-2 hover:text-red-ink hover:underline">{p.name}</Link>
                  <span className="tabular-nums text-ink-3">
                    {p.offers[0] ? <>de la <strong className="font-display font-extrabold text-ink">{formatPrice(p.offers[0].current_price)}</strong></> : 'indisponibil momentan'}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="mt-8 text-xs leading-relaxed text-ink-3">
          Prețurile și reducerile din articol se actualizează automat din datele noastre; prețul final
          este cel afișat de magazin la comandă. Vezi{' '}
          <Link href="/ghiduri/metodologie" className="underline underline-offset-2 hover:text-ink">metodologia</Link>.
        </p>
      </article>
    </>
  )
}
