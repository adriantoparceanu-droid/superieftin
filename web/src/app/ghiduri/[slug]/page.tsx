import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getPublishedGuide, getGuideProductIds, loadLiveProducts, refsKey } from '@/lib/guides/queries'
import { blogPostingLd, breadcrumbLd, faqLd, productLd, ldScript } from '@/lib/guides/jsonld'
import { formatGuideDate } from '@/lib/guides/format'
import { renderMarkdown } from '@/lib/guides/markdown'
import { formatPrice } from '@/lib/discount'
import { GuideBody, PROSE_CLASS } from '@/components/guides/GuideBody'

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

  return (
    <>
      {ld.map((d, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldScript(d) }} />
      ))}

      <nav aria-label="Breadcrumb" className="text-sm text-muted mb-4 flex gap-1.5 items-center flex-wrap">
        <Link href="/" className="hover:text-[var(--color-text)]">Acasă</Link>
        <span>/</span>
        <Link href="/ghiduri" className="hover:text-[var(--color-text)]">Ghiduri</Link>
        <span>/</span>
        <span className="text-[var(--color-text)] truncate max-w-xs">{guide.title}</span>
      </nav>

      <article className="max-w-3xl mx-auto bg-surface border border-line rounded-xl p-5 sm:p-8">
        {/* Mentiunea de afiliere — vizibila inainte de orice link spre magazin */}
        <p className="mb-5 rounded-lg bg-[var(--color-page)] border border-line px-3 py-2 text-xs text-muted">
          Articolul conține linkuri de afiliere: dacă cumperi prin ele, primim un comision de la magazin,
          fără cost suplimentar pentru tine. Comisionul nu schimbă ordinea ofertelor.{' '}
          <Link href="/ghiduri/metodologie" className="text-brand underline underline-offset-2">Cum lucrăm</Link>
        </p>

        {guide.category_slug && guide.category_name && (
          <Link href={`/c/${guide.category_slug}`} className="text-xs font-semibold uppercase tracking-wide text-brand hover:underline">
            {guide.category_name}
          </Link>
        )}
        <h1 className="font-archivo text-2xl sm:text-3xl text-[var(--color-text)] mt-1 leading-tight">{guide.title}</h1>

        <div className="mt-3 text-sm text-muted flex flex-wrap gap-x-4 gap-y-1">
          {guide.author && (
            <span>
              De{' '}
              {guide.author.url
                ? <Link href={guide.author.url} className="text-[var(--color-text)] hover:text-brand">{guide.author.name}</Link>
                : <span className="text-[var(--color-text)]">{guide.author.name}</span>}
            </span>
          )}
          {guide.reviewer && (
            <span>
              Verificat de:{' '}
              {guide.reviewer.url
                ? <Link href={guide.reviewer.url} className="text-[var(--color-text)] hover:text-brand">{guide.reviewer.name}</Link>
                : <span className="text-[var(--color-text)]">{guide.reviewer.name}</span>}
            </span>
          )}
          {guide.published_at && (
            <span>Publicat: <time dateTime={guide.published_at}>{formatGuideDate(guide.published_at)}</time></span>
          )}
          {updatedDiffers && (
            <span>Actualizat: <time dateTime={guide.updated_at}>{formatGuideDate(guide.updated_at)}</time></span>
          )}
        </div>

        {guide.summary && (
          <section aria-labelledby="pe-scurt" className="mt-6 rounded-lg border-l-4 border-brand bg-[var(--color-page)] p-4">
            <h2 id="pe-scurt" className="font-semibold mb-1">Pe scurt</h2>
            <div className={PROSE_CLASS} dangerouslySetInnerHTML={{ __html: renderMarkdown(guide.summary) }} />
          </section>
        )}

        <div className="mt-6">
          <GuideBody body={guide.body_md} />
        </div>

        {guide.faq.length > 0 && (
          <section aria-labelledby="faq" className="mt-10">
            <h2 id="faq" className="font-archivo text-xl mb-3">Întrebări frecvente</h2>
            <div className="space-y-4">
              {guide.faq.map((f, i) => (
                <div key={i}>
                  <h3 className="font-semibold">{f.q}</h3>
                  <p className="mt-1 text-[var(--color-text)] leading-relaxed whitespace-pre-line">{f.a}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Legaturi interne spre paginile de produs (fiecare cu istoricul complet de pret) */}
        {linkedProducts.length > 0 && (
          <section aria-labelledby="produse" className="mt-10 border-t border-line pt-6">
            <h2 id="produse" className="font-semibold mb-2">Produsele din acest ghid</h2>
            <ul className="space-y-1 text-sm">
              {linkedProducts.map((p) => (
                <li key={p.id} className="flex flex-wrap justify-between gap-2">
                  <Link href={`/p/${p.slug}`} className="text-brand hover:underline">{p.name}</Link>
                  <span className="text-muted tabular-nums">
                    {p.offers[0] ? `de la ${formatPrice(p.offers[0].current_price)}` : 'indisponibil momentan'}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="mt-8 text-xs text-muted">
          Prețurile și reducerile din articol se actualizează automat din datele noastre; prețul final
          este cel afișat de magazin la comandă. Vezi{' '}
          <Link href="/ghiduri/metodologie" className="underline underline-offset-2">metodologia</Link>.
        </p>
      </article>
    </>
  )
}
