import { revalidatePath, revalidateTag } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'
import { CATEGORY_CONTENT_TAG } from '@/lib/category-content'

// Invalidare dupa importul textelor de categorie DIN AFARA adminului (scriptul din worker:
// worker/src/scripts/import-category-texts.ts, `npm run categorii:import`).
//
// De ce { expire: 0 } si nu 'max' ca in admin: cu 'max' prima vizita dupa invalidare primeste
// inca textul VECHI (stale-while-revalidate) — in admin nu se vede pentru ca acolo urmeaza
// refresh(). Aici apelantul e un script, deci expiram imediat: urmatoarea cerere pe /c/<slug>
// citeste textul nou din DB (getCategoryContent, lib/category-content.ts). Pagina /c/ e
// force-dynamic; revalidatePath e pus pentru paritate cu saveCategoryContentAction.
//
// Corp JSON: { "slugs": ["monitoare", "laptopuri", ...] }. Acelasi secret ca /api/revalidate.
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+){0,20}$/
const MAX_SLUGS = 200

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
  const raw = (body as { slugs?: unknown })?.slugs
  if (!Array.isArray(raw) || !raw.length || raw.length > MAX_SLUGS) {
    return NextResponse.json({ error: `„slugs” trebuie să fie o listă cu 1–${MAX_SLUGS} slug-uri` }, { status: 400 })
  }
  const slugs = [...new Set(raw.map(String))]
  const bad = slugs.filter((s) => s.length > 120 || !SLUG_RE.test(s))
  if (bad.length) return NextResponse.json({ error: 'slug-uri invalide', bad }, { status: 400 })

  // Un singur tag pentru toate textele (cache-ul e per slug, dar tag-ul e comun) — ieftin:
  // fiecare categorie isi reciteste textul la urmatoarea vizita (un SELECT pe cheie primara).
  revalidateTag(CATEGORY_CONTENT_TAG, { expire: 0 })
  for (const s of slugs) revalidatePath(`/c/${s}`)

  return NextResponse.json({ revalidated: slugs.length })
}
