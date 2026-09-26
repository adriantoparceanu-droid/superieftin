import { indexNowKey } from '@/lib/guides/indexnow'

// Fisierul-cheie IndexNow (vezi lib/guides/indexnow.ts). Fara INDEXNOW_KEY → 404.
export const dynamic = 'force-dynamic'

export function GET() {
  const key = indexNowKey()
  if (!key) return new Response('Not found', { status: 404 })
  return new Response(key, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
