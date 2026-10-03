import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { NextRequest, NextResponse } from 'next/server'
import { pingIndexNow } from '@/lib/guides/indexnow'

// Invalidare dupa publicarea ghidurilor DIN AFARA adminului (scriptul de import din worker:
// worker/src/scripts/import-guide-drafts.ts, modul de publicare). Face acelasi lucru ca
// saveGuideAction: revalidatePath pe articol, pe /ghiduri si pe paginile /p/ legate, apoi
// ping IndexNow pentru caile publice ale ghidurilor (doar daca INDEXNOW_KEY e setat).
//
// Corp JSON: { "paths": ["/ghiduri/slug", "/p/slug-produs", ...] }
// Acceptam DOAR /ghiduri/... si /p/... (secretul protejeaza oricum ruta, dar limitam efectul).
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

  for (const p of paths) revalidatePath(p)
  revalidatePath('/ghiduri')

  // IndexNow doar pentru ghiduri (paginile /p/ nu se schimba ca text public important)
  const guidePaths = paths.filter((p) => p.startsWith('/ghiduri'))
  if (guidePaths.length) after(() => pingIndexNow([...guidePaths, '/ghiduri']))

  return NextResponse.json({ revalidated: paths.length, indexnow: guidePaths.length > 0 })
}
