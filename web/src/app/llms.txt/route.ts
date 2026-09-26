import { getPublishedGuideSlugs } from '@/lib/guides/queries'
import { getCategories, getSubcategories } from '@/lib/queries'
import { REAL_DISCOUNT_PCT } from '@/lib/discount'
import { OFFER_STALE_DAYS } from '@/lib/availability'

// /llms.txt — rezumat al site-ului pentru asistentii AI (propunere de standard: llmstxt.org).
// Dinamic (nu la build: DB-ul nu e accesibil atunci), cu cache HTTP de o ora.
export const dynamic = 'force-dynamic'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.superieftin.ro'

// Aceeasi excludere ca in sitemap / reduceri-reale (REGULI.md regula 8)
const EXCLUDED_ROOTS = ['sanatate-naturale']

export async function GET() {
  const [guides, categories] = await Promise.all([
    getPublishedGuideSlugs().catch(() => []),
    getCategories().catch(() => []),
  ])

  const roots = categories.filter((c) => !EXCLUDED_ROOTS.includes(c.category))
  const landing = (await Promise.all(
    roots.map(async (c) => [
      { slug: c.category, name: c.name ?? c.category },
      ...(await getSubcategories(c.category).catch(() => [])).map((s) => ({ slug: s.slug, name: s.name })),
    ])
  )).flat()

  const lines: string[] = [
    '# superieftin.ro',
    '',
    '> Comparator de prețuri pentru magazinele online din România. Urmărim zilnic prețurile și ' +
      `marcăm ca „reducere reală” doar prețurile cu minim ${REAL_DISCOUNT_PCT}% sub mediana ultimelor 30 de zile.`,
    '',
    'Metodologie pe scurt:',
    '- Prețurile vin din feed-urile magazinelor (prin rețelele de afiliere) și din scanări periodice; fiecare preț intră în istoric.',
    `- Reducere reală = preț curent cu cel puțin ${REAL_DISCOUNT_PCT}% sub mediana prețurilor din ultimele 30 de zile (nu față de „prețul vechi” al magazinului).`,
    `- Ofertele neconfirmate de ${OFFER_STALE_DAYS} zile sunt ascunse.`,
    '- Linkurile spre magazine sunt de afiliere (Profitshare, 2Performant); comisionul nu influențează ordinea ofertelor (ordonate după preț).',
    '- Prețurile din ghiduri se completează automat din date, nu sunt scrise de mână.',
    '',
    '## Pagini principale',
    '',
    `- [Metodologie](${SITE_URL}/ghiduri/metodologie): cum verificăm prețurile și reducerile`,
    `- [Despre noi](${SITE_URL}/despre): cine operează site-ul`,
    `- [Ghiduri](${SITE_URL}/ghiduri): lista ghidurilor de cumpărare`,
    '',
  ]

  if (guides.length) {
    lines.push('## Ghiduri', '')
    for (const g of guides) {
      lines.push(`- [${g.title}](${SITE_URL}/ghiduri/${g.slug})${g.meta_description ? `: ${g.meta_description}` : ''}`)
    }
    lines.push('')
  }

  if (landing.length) {
    lines.push('## Reduceri reale pe categorii', '')
    for (const l of landing) {
      lines.push(`- [Reduceri reale la ${l.name}](${SITE_URL}/reduceri-reale/${l.slug})`)
    }
    lines.push('')
  }

  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
