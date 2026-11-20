import { buildLlmsFull, type LlmsGuideFull } from '@/lib/seo/llms'
import { loadLlmsData } from '@/lib/seo/llms-data'
import { getPublishedGuide } from '@/lib/guides/queries'

// /llms-full.txt — llms.txt + textul integral al articolelor publicate (Markdown),
// cu marcajele de produs inlocuite prin trimiteri spre cardul din articol (fara preturi care se invechesc).
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
