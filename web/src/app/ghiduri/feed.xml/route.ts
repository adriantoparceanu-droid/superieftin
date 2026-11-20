import { buildRss, RSS_MAX_ITEMS } from '@/lib/guides/rss'
import { listRssGuides } from '@/lib/guides/queries'

// /ghiduri/feed.xml — fluxul RSS 2.0 al articolelor publicate (ultimele 50).
// Dinamic (nu la build: DB-ul nu e accesibil atunci), cu cache HTTP de o ora — ca /llms.txt.
// Daca DB-ul nu raspunde, intoarcem un flux gol valid (cititoarele nu primesc o eroare).
export const dynamic = 'force-dynamic'

export async function GET() {
  const items = await listRssGuides(RSS_MAX_ITEMS).catch(() => [])
  return new Response(buildRss(items), {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
