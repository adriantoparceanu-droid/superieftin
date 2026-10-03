import { buildLlmsTxt } from '@/lib/seo/llms'
import { loadLlmsData } from '@/lib/seo/llms-data'

// /llms.txt — rezumat al site-ului pentru asistentii AI (propunere de standard: llmstxt.org).
// Textul se construieste in lib/seo/llms.ts (cifre live, categorii, ghiduri, operator).
// Dinamic (nu la build: DB-ul nu e accesibil atunci), cu cache HTTP de o ora.
export const dynamic = 'force-dynamic'

export async function GET() {
  return new Response(buildLlmsTxt(await loadLlmsData()), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
