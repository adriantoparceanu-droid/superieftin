import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getAuthorPage } from '@/lib/guides/queries'
import { authorProfileLd, externalProfileUrl, ldScript } from '@/lib/guides/jsonld'
import { breadcrumbLd } from '@/lib/seo/jsonld'
import { formatGuideDate } from '@/lib/guides/format'
import { RSS_PATH, RSS_TITLE } from '@/lib/guides/rss'
import { ARTICLE_CARD, ARTICLE_H1 } from '@/components/article'
import { Crumbs } from '@/components/listing/ListingParts'

// Pagina unui autor / verificator (/autori/<slug>): cine e, ce a scris sau a verificat.
// Semnal de incredere (E-E-A-T) — articolele leaga numele autorului aici, iar JSON-LD-ul
// (ProfilePage + Person/Organization) foloseste acelasi @id ca autorul din BlogPosting.
// 404 pentru slug inexistent SAU autor fara niciun articol publicat (o pagina goala nu ajuta pe nimeni).
// ISR ca articolele (15 min): lista se actualizeaza singura dupa publicare.
export const revalidate = 900
export const dynamicParams = true

export async function generateStaticParams() {
  return []
}

type Props = { params: Promise<{ slug: string }> }

async function load(slug: string) {
  const data = await getAuthorPage(slug).catch(() => null)
  return data && data.articles.length ? data : null
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const data = await load(slug)
  if (!data) return { title: 'Autor negăsit' }
  const { author, articles } = data
  const description = author.bio
    ?? `${author.name}: articolele de recomandări scrise sau verificate pe superieftin.ro (${articles.length}).`
  return {
    title: `${author.name} — autor`,
    description,
    alternates: {
      canonical: `/autori/${author.slug}`,
      types: { 'application/rss+xml': [{ url: RSS_PATH, title: RSS_TITLE }] },
    },
    openGraph: {
      type: 'profile',
      siteName: 'superieftin.ro',
      locale: 'ro_RO',
      title: author.name,
      description,
      url: `/autori/${author.slug}`,
    },
  }
}

export default async function AuthorPage({ params }: Props) {
  const { slug } = await params
  const data = await load(slug)
  if (!data) notFound()
  const { author, articles } = data

  const external = externalProfileUrl(author.url)
  // Link intern (ex. „/despre” la echipa) — il aratam ca „Mai multe”, dar nu e sameAs
  const internal = !external && author.url?.startsWith('/') ? author.url : null

  const ld = [
    authorProfileLd({ ...author, articles }),
    breadcrumbLd([
      { name: 'Acasă', path: '/' },
      { name: 'Ghiduri', path: '/ghiduri' },
      { name: author.name, path: `/autori/${author.slug}` },
    ]),
  ]

  return (
    <>
      {ld.map((d, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldScript(d) }} />
      ))}

      <div className="mx-auto mb-3 max-w-[46rem]">
        <Crumbs items={[{ label: 'Acasă', href: '/' }, { label: 'Ghiduri', href: '/ghiduri' }, { label: author.name }]} />
      </div>

      <article className={ARTICLE_CARD}>
        <p className="text-[12px] font-extrabold uppercase tracking-[.06em] text-red-ink">
          {author.kind === 'organization' ? 'Echipă' : 'Autor'}
        </p>
        <h1 className={`mt-1.5 ${ARTICLE_H1}`}>{author.name}</h1>

        {author.bio && <p className="mt-4 text-[16px] leading-[1.65] text-ink-2 sm:text-[17px]">{author.bio}</p>}

        {(external || internal) && (
          <p className="mt-3 text-[14px] text-ink-3">
            {external ? (
              // rel="me": profilul extern apartine aceleiasi persoane (fara nofollow — e chiar autorul)
              <a href={external} rel="me noopener" target="_blank" className="text-red-ink underline underline-offset-2">Profil public</a>
            ) : (
              <Link href={internal!} className="text-red-ink underline underline-offset-2">Mai multe despre noi</Link>
            )}
          </p>
        )}

        <p className="mt-4 text-[14px] leading-relaxed text-ink-3">
          Fiecare articol de pe superieftin.ro are un autor și un verificator, afișați sub titlu.{' '}
          <Link href="/ghiduri/metodologie" className="text-red-ink underline underline-offset-2">Cum lucrăm</Link>
        </p>

        <section aria-labelledby="articole" className="mt-8">
          <h2 id="articole" className="text-[21px] font-extrabold leading-tight text-ink sm:text-[24px]">
            Articole ({articles.length})
          </h2>
          <ul className="mt-3 divide-y divide-line border-y border-line">
            {articles.map((g) => (
              <li key={g.slug} className="py-4">
                <Link href={`/ghiduri/${g.slug}`} className="font-display text-[17px] font-extrabold leading-snug text-ink underline-offset-2 hover:text-red-ink hover:underline">
                  {g.title}
                </Link>
                {g.meta_description && <p className="mt-1 text-[14.5px] leading-snug text-ink-2">{g.meta_description}</p>}
                <p className="mt-1 text-[13px] text-ink-3">
                  {g.role.charAt(0).toUpperCase() + g.role.slice(1)}
                  {g.published_at && <> · <time dateTime={g.published_at}>{formatGuideDate(g.published_at)}</time></>}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </article>
    </>
  )
}
