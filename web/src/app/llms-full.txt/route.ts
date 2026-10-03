import { buildLlmsFull, type LlmsGuideFull } from '@/lib/seo/llms'
import { loadLlmsData } from '@/lib/seo/llms-data'
import { getPublishedGuide } from '@/lib/guides/queries'

// /llms-full.txt — llms.txt + metodologia si textul integral al ghidurilor publicate (Markdown),
// cu marcajele de pret inlocuite prin „vezi prețul live pe <URL>” (fara preturi care se invechesc).
export const dynamic = 'force-dynamic'

export async function GET() {
  const data = await loadLlmsData()
  const guides = (await Promise.all(
    data.guides.map((g) => getPublishedGuide(g.slug).catch(() => null))
  )).filter((g): g is NonNullable<typeof g> => g != null) as LlmsGuideFull[]
  return new Response(buildLlmsFull(data, guides), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
