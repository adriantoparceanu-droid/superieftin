// Importa ciornele de ghid scrise de AI (JSON) in baza de date, ca ciorne in /admin/ghiduri.
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
// - Statusul ramane 'draft': publicarea o face DOAR proprietarul, din editor, dupa verificare.
// - DATABASE_URL vine din mediu (local: --env-file=../.env din npm script; prod: env-ul containerului).

import { readFileSync, readdirSync, statSync } from 'fs'
import { join, resolve } from 'path'
import pool from '../lib/db.js'
import { validateDraft, countUnverified, type GuideDraft } from '../lib/guide-drafts.js'

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
  const paths = argv.filter((a) => a !== '--confirm')
  if (!paths.length) {
    console.error('Utilizare: npm run ghiduri:import -- <director|fișier.json|-> [--confirm]')
    console.error('  „-” = citește JSON-ul de pe stdin (util în containerul de producție).')
    process.exit(1)
  }

  const inputs = collectInputs(paths)
  if (!inputs.length) {
    console.error('Niciun fișier .json găsit.')
    process.exit(1)
  }

  // Autorul si verificatorul trebuie sa existe (seed in migratia 023)
  const authors = await pool.query<{ id: number; slug: string }>(
    'SELECT id, slug FROM guide_authors WHERE slug = ANY($1)', [[AUTHOR_SLUG, REVIEWER_SLUG]])
  const authorId = authors.rows.find((r) => r.slug === AUTHOR_SLUG)?.id
  const reviewerId = authors.rows.find((r) => r.slug === REVIEWER_SLUG)?.id
  if (!authorId || !reviewerId) {
    console.error(`Lipsesc autorii „${AUTHOR_SLUG}” / „${REVIEWER_SLUG}” din guide_authors (migrația 023 aplicată?).`)
    process.exit(1)
  }

  type Planned = { draft: GuideDraft; label: string; action: 'create' | 'update' | 'skip'; guideId?: number; productIds: string[] }
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

    if (draft.category_slug) {
      const c = await pool.query('SELECT 1 FROM categories WHERE slug = $1', [draft.category_slug])
      if (!c.rowCount) errs.push(`category_slug: categoria „${draft.category_slug}” nu există`)
    }

    if (errs.length) { failed.push({ label: inp.label, errors: errs }); continue }

    const cur = await pool.query<{ id: number; status: string }>('SELECT id, status FROM guides WHERE slug = $1', [draft.slug])
    const row = cur.rows[0]
    planned.push({
      draft, label: inp.label,
      action: !row ? 'create' : row.status === 'published' ? 'skip' : 'update',
      guideId: row?.id,
      productIds: draft.product_slugs.map((s) => bySlug.get(s)!),
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
    const what = p.action === 'create' ? 'CREEAZĂ ciornă'
      : p.action === 'update' ? `ACTUALIZEAZĂ ciorna #${p.guideId} (suprascrie și modificările din editor)`
      : `SARE — ghidul #${p.guideId} e PUBLICAT și nu se suprascrie (retrage-l din admin dacă vrei să-l reimporți)`
    console.log(`\n${p.action === 'skip' ? '•' : '✓'} ${d.slug} — ${what}`)
    console.log(`   „${d.title}” · ${d.kind}${d.category_slug ? ` · ${d.category_slug}` : ''} · ${p.productIds.length} produse · ${d.faq.length} FAQ`)
    console.log(`   Fișă: ${d.review.facts.length} afirmații (${todo} de verificat), ${d.review.checklist.length} puncte checklist, ${d.review.warnings.length} avertismente · ${marks} marcaje [DE VERIFICAT]`)
  }

  if (failed.length) {
    console.error(`\n${failed.length} fișier(e) cu erori — nu s-a scris nimic. Corectează și rulează din nou.`)
    await pool.end()
    process.exit(1)
  }

  const toWrite = planned.filter((p) => p.action !== 'skip')
  if (!confirm) {
    console.log(`\nPLAN: ${toWrite.length} de scris, ${planned.length - toWrite.length} sărite. Nimic nu s-a scris — adaugă --confirm.`)
    await pool.end()
    return
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    for (const p of toWrite) {
      const d = p.draft
      const params = [d.slug, d.title, d.meta_description, d.kind, authorId, reviewerId, d.category_slug,
        d.summary, d.body_md, JSON.stringify(d.faq), JSON.stringify(d.review), GENERATED_BY]
      // WHERE status = 'draft': plasa de siguranta daca ghidul a fost publicat intre plan si scriere
      const res = await client.query<{ id: number }>(`
        INSERT INTO guides (slug, title, meta_description, kind, author_id, reviewer_id, category_slug,
                            summary, body_md, faq, review_notes, generated_by, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12, 'draft')
        ON CONFLICT (slug) DO UPDATE SET
          title = EXCLUDED.title, meta_description = EXCLUDED.meta_description, kind = EXCLUDED.kind,
          author_id = EXCLUDED.author_id, reviewer_id = EXCLUDED.reviewer_id,
          category_slug = EXCLUDED.category_slug, summary = EXCLUDED.summary, body_md = EXCLUDED.body_md,
          faq = EXCLUDED.faq, review_notes = EXCLUDED.review_notes, generated_by = EXCLUDED.generated_by,
          updated_at = now()
        WHERE guides.status = 'draft'
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
      console.log(`✓ ${d.slug} → ciorna #${id} (/admin/ghiduri/${id})`)
    }
    await client.query('COMMIT')
    console.log(`\nGata: ${toWrite.length} ciorne scrise. Verifică-le în Admin → Ghiduri.`)
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((err) => { console.error(err); process.exit(1) })
