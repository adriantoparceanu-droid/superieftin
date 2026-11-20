import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { NextRequest, NextResponse } from 'next/server'
import { pingIndexNow } from '@/lib/guides/indexnow'

// Invalidare dupa publicarea ghidurilor DIN AFARA adminului (scriptul de import din worker:
// worker/src/scripts/import-guide-drafts.ts, modul de publicare). Face acelasi lucru ca
// saveGuideAction: revalidatePath pe articol si pe /ghiduri, apoi ping IndexNow pentru caile
// publice ale ghidurilor (doar daca INDEXNOW_KEY e setat).
//
// Corp JSON: { "paths": ["/ghiduri/slug", ...] }
// Acceptam DOAR /ghiduri/... si /p/... (secretul protejeaza oricum ruta, dar limitam efectul).
// /p/... e inca ACCEPTAT (un worker vechi le mai trimite), dar ignorat: paginile de produs nu mai
// exista (trecerea in blog, 20.11.2026) — proxy-ul raspunde 308/410 inainte de orice cache.
const ALLOWED = /^\/(ghiduri(\/[a-z0-9-]{1,120})?|p\/[a-z0-9-]{1,300})$/
const MAX_PATHS = 200

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-revalidate-secret')
  if (!secret || secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalid' }, { status: 400 })
  }
  const raw = (body as { paths?: unknown })?.paths
  if (!Array.isArray(raw) || !raw.length || raw.length > MAX_PATHS) {
    return NextResponse.json({ error: `„paths” trebuie să fie o listă cu 1–${MAX_PATHS} căi` }, { status: 400 })
  }
  const paths = [...new Set(raw.map(String))]
  const bad = paths.filter((p) => !ALLOWED.test(p))
  if (bad.length) return NextResponse.json({ error: 'căi nepermise', bad }, { status: 400 })

  for (const p of paths) if (!p.startsWith('/p/')) revalidatePath(p)
  revalidatePath('/ghiduri')

  // IndexNow doar pentru ghiduri
  const guidePaths = paths.filter((p) => p.startsWith('/ghiduri'))
  if (guidePaths.length) after(() => pingIndexNow([...guidePaths, '/ghiduri']))

  return NextResponse.json({ revalidated: paths.length, indexnow: guidePaths.length > 0 })
}
