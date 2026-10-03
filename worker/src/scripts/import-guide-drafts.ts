// Importa ghidurile scrise de AI (JSON) in baza de date: ca ciorne in /admin/ghiduri sau, pentru
// fisierele cu bloc „publish” (content/ghiduri/publicate/), direct ca ghiduri publicate.
//
// Utilizare (local, din worker/):
//   npm run ghiduri:import -- ../content/ghiduri/drafts             # PLAN: arata ce ar face
//   npm run ghiduri:import -- ../content/ghiduri/drafts --confirm   # scrie in DB
//   npm run ghiduri:import -- ../content/ghiduri/drafts/x.json --confirm
// Productie (containerul worker; fisierul se trimite pe stdin, deci nu trebuie copiat in container):
//   docker compose exec -T worker node worker/dist/scripts/import-guide-drafts.js - --confirm < x.json
// Formatul fisierului: content/ghiduri/README.md.
//
// Reguli:
// - Implicit PLAN (nu scrie nimic). Scrierea cere --confirm.
// - Totul sau nimic: daca un singur fisier are erori, nu se scrie niciunul (exit 1).
// - Upsert dupa slug, DAR un ghid PUBLICAT nu se suprascrie niciodata (se sare, cu mesaj).
//   O ciorna existenta cu acelasi slug se actualizeaza (inclusiv modificarile facute in editor!).
// - Fara bloc „publish”: statusul ramane 'draft'; publicarea o face proprietarul, din editor.
// - Cu bloc „publish” (decizia proprietarului din 2026-10-04: ghidurile verificate se publica
//   automat): aceleasi conditii ca la „Publica” din admin (autor, verificator, meta, fara
//   afirmatii de sanatate, fara [DE VERIFICAT]) + toate faptele din fisa „confirmat” + fara
//   preturi scrise de mana (lib/guide-drafts.ts → publishErrors). Fisierul e sursa de adevar:
//   un ghid publicat se ACTUALIZEAZA din fisier, dar doar daca s-a schimbat ceva (altfel
//   „neschimbat” — reaplicarea nu atinge nimic, nici updated_at). published_at = prima publicare.
//   Dupa scriere: POST ${SITE_URL}/api/revalidate/ghiduri (revalidatePath + IndexNow, ca adminul).
//   --no-revalidate sare pasul (ex. la testare locala, unde .env poate avea SITE_URL de productie).
// - DATABASE_URL vine din mediu (local: --env-file=../.env din npm script; prod: env-ul containerului).

import { readFileSync, readdirSync, statSync } from 'fs'
import { join, resolve } from 'path'
import pool from '../lib/db.js'
import { validateDraft, countUnverified, type GuideDraft } from '../lib/guide-drafts.js'

// Implicit pentru ciorne (fisierele fara bloc „publish” — comportamentul vechi)
const AUTHOR_SLUG = 'echipa-superieftin'   // „Echipa Superieftin.ro” (migratia 023)
const REVIEWER_SLUG = 'adrian'             // verificatorul uman
const GENERATED_BY = 'claude'

interface Input { label: string; raw: unknown; parseError?: string }

function readStdin(): string {
  return readFileSync(0, 'utf8')
}

// Un fisier/stdin poate contine un obiect (o ciorna) sau o lista de obiecte.
function explode(label: string, text: string): Input[] {
  try {
    const data = JSON.parse(text)
    return Array.isArray(data) ? data.map((d, i) => ({ label: `${label}[${i}]`, raw: d })) : [{ label, raw: data }]
  } catch (err) {
    return [{ label, raw: null, parseError: `JSON invalid: ${(err as Error).message}` }]
  }
}

function collectInputs(args: string[]): Input[] {
  const out: Input[] = []
  for (const a of args) {
    if (a === '-' || a === '--stdin') {
      out.push(...explode('stdin', readStdin()))
      continue
    }
    const p = resolve(a)
    let st
    try {
      st = statSync(p)
    } catch {
      out.push({ label: a, raw: null, parseError: 'fișierul/directorul nu există' })
      continue
    }
    const files = st.isDirectory()
      ? readdirSync(p).filter((f) => f.endsWith('.json')).sort().map((f) => join(p, f))
      : [p]
    for (const f of files) out.push(...explode(f, readFileSync(f, 'utf8')))
  }
  return out
}

async function main() {
  const argv = process.argv.slice(2)
  const confirm = argv.includes('--confirm')
  const noRevalidate = argv.includes('--no-revalidate')
  const paths = argv.filter((a) => a !== '--confirm' && a !== '--no-revalidate')
  if (!paths.length) {
    console.error('Utilizare: npm run ghiduri:import -- <director|fișier.json|-> [--confirm] [--no-revalidate]')
    console.error('  „-” = citește JSON-ul de pe stdin (util în containerul de producție).')
    process.exit(1)
  }

  const inputs = collectInputs(paths)
  if (!inputs.length) {
    console.error('Niciun fișier .json găsit.')
    process.exit(1)
  }

  // Autorii (seed in migratia 023 + eventuali adaugati din admin), dupa slug
  const authorRows = await pool.query<{ id: number; slug: string }>('SELECT id, slug FROM guide_authors')
  const authorIdBySlug = new Map(authorRows.rows.map((r) => [r.slug, r.id]))
  if (!authorIdBySlug.has(AUTHOR_SLUG) || !authorIdBySlug.has(REVIEWER_SLUG)) {
    console.error(`Lipsesc autorii „${AUTHOR_SLUG}” / „${REVIEWER_SLUG}” din guide_authors (migrația 023 aplicată?).`)
    process.exit(1)
  }

  type Action = 'create' | 'update' | 'skip' | 'unchanged'
  type Planned = {
    draft: GuideDraft; label: string; action: Action; guideId?: number; productIds: string[]
    authorId: number; reviewerId: number; status: 'draft' | 'published'; wasPublished: boolean
    oldSlugs: string[]   // slug-urile produselor legate inainte (pentru revalidarea /p/)
    unavailable: string[] // produse (legate sau din marcaje) fara oferta disponibila acum
  }
  const planned: Planned[] = []
  const failed: { label: string; errors: string[] }[] = []
  const seen = new Map<string, string>()

  for (const inp of inputs) {
    if (inp.parseError) { failed.push({ label: inp.label, errors: [inp.parseError] }); continue }
    const { draft, errors, markerRefs } = validateDraft(inp.raw)
    if (!draft) { failed.push({ label: inp.label, errors }); continue }
    const errs: string[] = []

    if (seen.has(draft.slug)) errs.push(`slug-ul „${draft.slug}” apare și în ${seen.get(draft.slug)}`)
    seen.set(draft.slug, inp.label)

    // Produsele legate: slug-urile trebuie sa existe; pozitia = ordinea din fisier
    const prod = await pool.query<{ id: string; slug: string }>(
      'SELECT id::text, slug FROM products WHERE slug = ANY($1)', [draft.product_slugs])
    const bySlug = new Map(prod.rows.map((r) => [r.slug, r.id]))
    for (const s of draft.product_slugs) if (!bySlug.has(s)) errs.push(`product_slugs: produsul „${s}” nu există în baza de date`)

    // Marcajele din corp: id sau slug de produs existent (altfel pe site ar aparea „indisponibil”)
    const ids = markerRefs.filter((r) => /^\d{1,18}$/.test(r))
    const slugs = markerRefs.filter((r) => !/^\d{1,18}$/.test(r))
    const found = await pool.query<{ id: string; slug: string }>(
      'SELECT id::text, slug FROM products WHERE id = ANY($1::bigint[]) OR slug = ANY($2)', [ids, slugs])
    const known = new Set(found.rows.flatMap((r) => [r.id, r.slug]))
    for (const r of markerRefs) if (!known.has(r)) errs.push(`body_md: marcajul trimite la produsul „${r}”, care nu există în baza de date`)

    const authorId = authorIdBySlug.get(draft.publish?.author_slug ?? AUTHOR_SLUG)
    const reviewerId = authorIdBySlug.get(draft.publish?.reviewer_slug ?? REVIEWER_SLUG)
    if (!authorId) errs.push(`publish.author_slug: autorul „${draft.publish?.author_slug}” nu există în guide_authors`)
    if (!reviewerId) errs.push(`publish.reviewer_slug: verificatorul „${draft.publish?.reviewer_slug}” nu există în guide_authors`)

    if (draft.category_slug) {
      const c = await pool.query('SELECT 1 FROM categories WHERE slug = $1', [draft.category_slug])
      if (!c.rowCount) errs.push(`category_slug: categoria „${draft.category_slug}” nu există`)
    }

    if (errs.length) { failed.push({ label: inp.label, errors: errs }); continue }

    const productIds = draft.product_slugs.map((s) => bySlug.get(s)!)
    // Avertisment (nu eroare): produse fara oferta disponibila acum → pe pagina apar „indisponibil”.
    // Aceeasi regula ca OFFER_AVAILABLE_SQL din web/src/lib/availability.ts (3 zile, magazin activ).
    const allRefs = [...new Set([...draft.product_slugs, ...markerRefs])]
    const av = await pool.query<{ ref: string }>(`
      SELECT p.slug AS ref FROM products p
      WHERE (p.slug = ANY($1) OR p.id::text = ANY($1)) AND NOT EXISTS (
        SELECT 1 FROM offers o WHERE o.product_id = p.id AND o.in_stock = true
          AND o.last_checked >= now() - INTERVAL '3 days'
          AND o.retailer_id <> ALL (ARRAY(SELECT id FROM retailers WHERE paused_at IS NOT NULL)))`, [allRefs])
    const unavailable = av.rows.map((r) => r.ref)
    const cur = await pool.query<CurrentRow>(`
      SELECT g.id, g.status, g.title, g.meta_description, g.kind, g.author_id, g.reviewer_id, g.category_slug,
             g.summary, g.body_md, g.faq, g.review_notes, g.generated_by,
             COALESCE((SELECT array_agg(gp.product_id::text ORDER BY gp.position) FROM guide_products gp WHERE gp.guide_id = g.id), '{}') AS product_ids,
             COALESCE((SELECT array_agg(p.slug) FROM guide_products gp JOIN products p ON p.id = gp.product_id WHERE gp.guide_id = g.id), '{}') AS product_slugs
      FROM guides g WHERE g.slug = $1`, [draft.slug])
    const row = cur.rows[0]
    const status = draft.publish ? 'published' : 'draft'
    let action: Action
    if (!row) action = 'create'
    else if (row.status === 'published' && !draft.publish) action = 'skip'
    else action = sameContent(row, draft, authorId!, reviewerId!, status, productIds) ? 'unchanged' : 'update'
    planned.push({
      draft, label: inp.label, action, guideId: row?.id, productIds,
      authorId: authorId!, reviewerId: reviewerId!, status,
      wasPublished: row?.status === 'published', oldSlugs: row?.product_slugs ?? [], unavailable,
    })
  }

  // Raport
  for (const f of failed) {
    console.error(`\n✗ ${f.label}`)
    for (const e of f.errors) console.error(`   - ${e}`)
  }
  for (const p of planned) {
    const d = p.draft
    const todo = d.review.facts.filter((f) => f.status === 'de_verificat').length
    const marks = countUnverified([d.summary, d.body_md, ...d.faq.flatMap((f) => [f.q, f.a])].join('\n'))
    const pub = p.status === 'published'
    const what = p.action === 'create' ? (pub ? 'CREEAZĂ și PUBLICĂ' : 'CREEAZĂ ciornă')
      : p.action === 'update' ? (pub
        ? (p.wasPublished ? `ACTUALIZEAZĂ ghidul publicat #${p.guideId}` : `ACTUALIZEAZĂ și PUBLICĂ ciorna #${p.guideId}`)
        : `ACTUALIZEAZĂ ciorna #${p.guideId} (suprascrie și modificările din editor)`)
      : p.action === 'unchanged' ? `NESCHIMBAT — #${p.guideId} e deja identic cu fișierul`
      : `SARE — ghidul #${p.guideId} e PUBLICAT și nu se suprascrie (retrage-l din admin dacă vrei să-l reimporți)`
    console.log(`\n${p.action === 'skip' || p.action === 'unchanged' ? '•' : '✓'} ${d.slug} — ${what}`)
    console.log(`   „${d.title}” · ${d.kind}${d.category_slug ? ` · ${d.category_slug}` : ''} · ${p.productIds.length} produse (id ${p.productIds.join(', ') || '—'}) · ${d.faq.length} FAQ`)
    if (d.publish) console.log(`   Autor: ${d.publish.author_slug} · verificator: ${d.publish.reviewer_slug}`)
    if (p.unavailable.length) console.log(`   ⚠ fără ofertă disponibilă acum (pe pagină apar „indisponibil”): ${p.unavailable.join(', ')}`)
    console.log(`   Fișă: ${d.review.facts.length} afirmații (${todo} de verificat), ${d.review.checklist.length} puncte checklist, ${d.review.warnings.length} avertismente · ${marks} marcaje [DE VERIFICAT]`)
  }

  if (failed.length) {
    console.error(`\n${failed.length} fișier(e) cu erori — nu s-a scris nimic. Corectează și rulează din nou.`)
    await pool.end()
    process.exit(1)
  }

  const toWrite = planned.filter((p) => p.action === 'create' || p.action === 'update')
  if (!confirm) {
    console.log(`\nPLAN: ${toWrite.length} de scris (${toWrite.filter((p) => p.status === 'published').length} publicate), ${planned.length - toWrite.length} sărite/neschimbate. Nimic nu s-a scris — adaugă --confirm.`)
    await pool.end()
    return
  }

  const client = await pool.connect()
  const revalidate: string[] = []   // cai publice de invalidat dupa COMMIT
  let written = 0
  try {
    await client.query('BEGIN')
    for (const p of toWrite) {
      const d = p.draft
      const params = [d.slug, d.title, d.meta_description, d.kind, p.authorId, p.reviewerId, d.category_slug,
        d.summary, d.body_md, JSON.stringify(d.faq), JSON.stringify(d.review), GENERATED_BY, p.status]
      // Ciorne: WHERE status = 'draft' — plasa de siguranta daca ghidul a fost publicat intre plan
      // si scriere. Fisierele „publish” pot actualiza si un ghid publicat (fisierul e sursa).
      // published_at = prima publicare (nu se schimba la actualizari), exact ca in admin.
      const res = await client.query<{ id: number }>(`
        INSERT INTO guides (slug, title, meta_description, kind, author_id, reviewer_id, category_slug,
                            summary, body_md, faq, review_notes, generated_by, status, published_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12, $13,
                CASE WHEN $13 = 'published' THEN now() END)
        ON CONFLICT (slug) DO UPDATE SET
          title = EXCLUDED.title, meta_description = EXCLUDED.meta_description, kind = EXCLUDED.kind,
          author_id = EXCLUDED.author_id, reviewer_id = EXCLUDED.reviewer_id,
          category_slug = EXCLUDED.category_slug, summary = EXCLUDED.summary, body_md = EXCLUDED.body_md,
          faq = EXCLUDED.faq, review_notes = EXCLUDED.review_notes, generated_by = EXCLUDED.generated_by,
          status = EXCLUDED.status,
          published_at = CASE WHEN EXCLUDED.status = 'published' THEN COALESCE(guides.published_at, now()) ELSE guides.published_at END,
          updated_at = now()
        WHERE guides.status = 'draft' OR EXCLUDED.status = 'published'
        RETURNING id
      `, params)
      if (!res.rows[0]) { console.log(`• ${d.slug}: publicat între timp — sărit.`); continue }
      const id = res.rows[0].id
      await client.query('DELETE FROM guide_products WHERE guide_id = $1', [id])
      if (p.productIds.length) {
        await client.query(`
          INSERT INTO guide_products (guide_id, product_id, position)
          SELECT $1, pid, ord::int FROM unnest($2::bigint[]) WITH ORDINALITY AS t(pid, ord)
        `, [id, p.productIds])
      }
      written++
      if (p.status === 'published') {
        revalidate.push(`/ghiduri/${d.slug}`, ...d.product_slugs.map((s) => `/p/${s}`), ...p.oldSlugs.map((s) => `/p/${s}`))
        console.log(`✓ ${d.slug} → PUBLICAT #${id} (/ghiduri/${d.slug})`)
      } else {
        console.log(`✓ ${d.slug} → ciorna #${id} (/admin/ghiduri/${id})`)
      }
    }
    await client.query('COMMIT')
    console.log(`\nGata: ${written} ghiduri scrise.`)
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
    await pool.end()
  }

  if (revalidate.length) await revalidateSite([...new Set(revalidate)], noRevalidate)
}

interface CurrentRow {
  id: number; status: string; title: string; meta_description: string | null; kind: string
  author_id: number | null; reviewer_id: number | null; category_slug: string | null
  summary: string | null; body_md: string; faq: unknown; review_notes: unknown; generated_by: string | null
  product_ids: string[]; product_slugs: string[]
}

// JSON cu chei sortate (jsonb din Postgres nu pastreaza ordinea cheilor)
function canon(v: unknown): string {
  const norm = (x: unknown): unknown => Array.isArray(x) ? x.map(norm)
    : x && typeof x === 'object' ? Object.fromEntries(Object.keys(x as object).sort().map((k) => [k, norm((x as Record<string, unknown>)[k])]))
    : x
  return JSON.stringify(norm(v ?? null))
}

// Identic cu ce ar scrie importul? (atunci nu scriem nimic → reaplicarea e idempotenta)
function sameContent(row: CurrentRow, d: GuideDraft, authorId: number, reviewerId: number,
  status: string, productIds: string[]): boolean {
  return row.status === status && row.title === d.title && row.meta_description === d.meta_description
    && row.kind === d.kind && row.author_id === authorId && row.reviewer_id === reviewerId
    && row.category_slug === d.category_slug && row.summary === d.summary && row.body_md === d.body_md
    && canon(row.faq) === canon(d.faq) && canon(row.review_notes) === canon(d.review)
    && row.generated_by === GENERATED_BY && row.product_ids.join(',') === productIds.join(',')
}

// Acelasi efect ca saveGuideAction din admin: revalidatePath + IndexNow, prin ruta web
// /api/revalidate/ghiduri (worker-ul nu poate apela revalidatePath direct).
async function revalidateSite(paths: string[], skip: boolean) {
  const siteUrl = process.env.SITE_URL
  const secret = process.env.REVALIDATE_SECRET
  const fallback = 'Fără invalidare: articolele noi apar oricum (ISR la prima vizită); un ghid care dădea 404 sau un text vechi se actualizează în cel mult 15 min, paginile /p/ în cel mult 1 h. Pentru imediat: docker compose up -d --force-recreate web.'
  if (skip) { console.log(`\nInvalidare sărită (--no-revalidate). ${fallback}`); return }
  if (!siteUrl || !secret) { console.warn(`\n⚠ SITE_URL / REVALIDATE_SECRET lipsesc. ${fallback}`); return }
  try {
    const res = await fetch(`${siteUrl}/api/revalidate/ghiduri`, {
      method: 'POST',
      headers: { 'x-revalidate-secret': secret, 'content-type': 'application/json' },
      body: JSON.stringify({ paths }),
      signal: AbortSignal.timeout(30000),
    })
    const body = await res.text()
    if (res.ok) console.log(`\nSite invalidat (${paths.length} căi) + IndexNow: ${body}`)
    else console.warn(`\n⚠ Invalidarea a răspuns ${res.status}: ${body.slice(0, 300)}. ${fallback}`)
  } catch (err) {
    console.warn(`\n⚠ Nu s-a putut contacta ${siteUrl}: ${(err as Error).message}. ${fallback}`)
  }
}

main().catch((err) => { console.error(err); process.exit(1) })
