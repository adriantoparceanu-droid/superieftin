// Importa textele paginilor de categorie (/c/<slug>: textul introductiv + intrebarile frecvente)
// din fisiere JSON (content/categorii/<slug>.json) in coloanele categories.intro_md / faq /
// content_updated_at (migratia 030) — acelasi efect ca „Salvează” din Admin → Categorii → „text”.
//
// Utilizare (local, din worker/):
//   npm run categorii:import -- ../content/categorii                      # PLAN: arata ce ar face
//   npm run categorii:import -- ../content/categorii --confirm --no-revalidate
//   npm run categorii:import -- ../content/categorii/monitoare.json --confirm --no-revalidate
// Productie (containerul worker; fisierul se trimite pe stdin, deci nu trebuie copiat in container):
//   docker compose exec -T worker node worker/dist/scripts/import-category-texts.js - --confirm < monitoare.json
// Formatul fisierului: content/categorii/README.md.
//
// Reguli:
// - Implicit PLAN (nu scrie nimic). Scrierea cere --confirm.
// - Totul sau nimic: daca un singur fisier are erori, nu se scrie niciunul (exit 1); scrierea e
//   intr-o singura tranzactie.
// - Validarea textului = cea de la salvarea din admin (lib/category-texts.ts, copie a
//   web/src/lib/category-markers.ts) + fisa de verificare (toate faptele „confirmat”).
// - Refuza: categorie inexistenta, ascunsa (ea sau parintele — /c/ ar da 404), Sanatate &
//   Naturale si farmacie-veterinara (REGULI.md regula 8).
// - Fisierul e sursa de adevar: suprascrie si un text editat in admin, dar doar daca ceva difera
//   (altfel NESCHIMBAT — nu se atinge nici content_updated_at). Daca textul a fost salvat din
//   admin intre plan si scriere, importul se opreste (ROLLBACK), ca sa nu piarda editarea.
// - Dupa COMMIT: POST ${SITE_URL}/api/revalidate/categorii (expira imediat cache-ul textului —
//   altfel /c/ arata textul vechi pana la 1 h). --no-revalidate sare pasul (local: .env-ul are
//   SITE_URL de productie).
// - DATABASE_URL vine din mediu (local: --env-file=../.env din npm script; prod: env-ul containerului).

import { readFileSync, readdirSync, statSync } from 'fs'
import { join, resolve } from 'path'
import pool from '../lib/db.js'
import { validateCategoryFile, planAction, normalizeDbFaq, isExcludedCategory, type CategoryTextFile, type CategoryTextAction } from '../lib/category-texts.js'

interface Input { label: string; raw: unknown; parseError?: string }

// Un fisier/stdin poate contine un obiect (o categorie) sau o lista de obiecte.
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
      out.push(...explode('stdin', readFileSync(0, 'utf8')))
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

interface CategoryRow {
  id: number; slug: string; name: string; is_visible: boolean
  intro_md: string | null; faq: unknown; content_updated_at: Date | null
  updated_raw: string | null   // content_updated_at ca text: pastreaza microsecundele (Date le pierde)
  ancestors: string[]; hidden_ancestor: string | null
}

const fmtDate = (d: Date | null) => d
  ? d.toLocaleString('ro-RO', { timeZone: 'Europe/Bucharest', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : 'fără dată'

async function main() {
  const argv = process.argv.slice(2)
  const confirm = argv.includes('--confirm')
  const noRevalidate = argv.includes('--no-revalidate')
  const paths = argv.filter((a) => a !== '--confirm' && a !== '--no-revalidate')
  if (!paths.length) {
    console.error('Utilizare: npm run categorii:import -- <director|fișier.json|-> [--confirm] [--no-revalidate]')
    console.error('  „-” = citește JSON-ul de pe stdin (un obiect sau o listă; util în containerul de producție).')
    process.exit(1)
  }

  const inputs = collectInputs(paths)
  if (!inputs.length) {
    console.error('Niciun fișier .json găsit.')
    process.exit(1)
  }

  type Planned = { file: CategoryTextFile; label: string; action: CategoryTextAction; cat: CategoryRow }
  const planned: Planned[] = []
  const failed: { label: string; errors: string[] }[] = []
  const seen = new Map<string, string>()

  for (const inp of inputs) {
    if (inp.parseError) { failed.push({ label: inp.label, errors: [inp.parseError] }); continue }
    // Slug duplicat in acelasi import: verificat si cand fisierul are alte erori
    const rawSlug = typeof (inp.raw as { slug?: unknown })?.slug === 'string' ? ((inp.raw as { slug: string }).slug).trim() : ''
    const dupOf = rawSlug ? seen.get(rawSlug) : undefined
    if (rawSlug && !dupOf) seen.set(rawSlug, inp.label)
    const { file, errors } = validateCategoryFile(inp.raw)
    if (dupOf) errors.unshift(`slug-ul „${rawSlug}” apare și în ${dupOf}`)
    if (!file || dupOf) { failed.push({ label: inp.label, errors }); continue }
    const errs: string[] = []

    // Categoria + stramosii ei (slug-uri, si primul stramos ascuns daca exista)
    const { rows } = await pool.query<CategoryRow>(`
      WITH RECURSIVE up AS (
        SELECT c.parent_id AS id, 1 AS depth FROM categories c WHERE c.slug = $1
        UNION ALL
        SELECT p.parent_id, up.depth + 1 FROM up JOIN categories p ON p.id = up.id
        WHERE up.id IS NOT NULL AND up.depth < 10
      )
      SELECT c.id, c.slug, c.name, c.is_visible, c.intro_md, c.faq, c.content_updated_at, c.content_updated_at::text AS updated_raw,
             COALESCE((SELECT array_agg(a.slug ORDER BY up.depth) FROM up JOIN categories a ON a.id = up.id), '{}') AS ancestors,
             (SELECT a.slug FROM up JOIN categories a ON a.id = up.id WHERE NOT a.is_visible ORDER BY up.depth LIMIT 1) AS hidden_ancestor
      FROM categories c WHERE c.slug = $1
    `, [file.slug])
    const cat = rows[0]
    if (!cat) errs.push(`categoria „${file.slug}” nu există în baza de date`)
    else {
      if (!cat.is_visible) errs.push(`categoria „${file.slug}” e ascunsă (is_visible = false) — /c/${file.slug} dă 404`)
      if (cat.hidden_ancestor) errs.push(`categoria-părinte „${cat.hidden_ancestor}” e ascunsă — /c/${file.slug} nu e publică`)
      if (isExcludedCategory(cat.slug, cat.ancestors)) {
        errs.push(`categoria „${file.slug}” e în Sănătate & Naturale / farmacie veterinară — exclusă (REGULI.md, regula 8)`)
      }
    }

    if (errs.length || !cat) { failed.push({ label: inp.label, errors: errs }); continue }
    planned.push({ file, label: inp.label, cat, action: planAction(cat, file) })
  }

  // Raport
  for (const f of failed) {
    console.error(`\n✗ ${f.label}`)
    for (const e of f.errors) console.error(`   - ${e}`)
  }
  for (const p of planned) {
    const { file, cat } = p
    const oldFaq = normalizeDbFaq(cat.faq).length
    const oldLen = cat.intro_md?.length ?? 0
    const what = p.action === 'create' ? 'CREEAZĂ (categoria nu are text)'
      : p.action === 'update' ? `ACTUALIZEAZĂ textul salvat ${fmtDate(cat.content_updated_at)} (suprascrie și editările din admin)`
      : 'NESCHIMBAT — textul din DB e identic cu fișierul'
    console.log(`\n${p.action === 'unchanged' ? '•' : '✓'} ${file.slug} („${cat.name}”, /c/${file.slug}) — ${what}`)
    console.log(p.action === 'update'
      ? `   Text: ${oldLen} → ${file.intro_md.length} caractere · FAQ: ${oldFaq} → ${file.faq.length}`
      : `   Text: ${file.intro_md.length} caractere · FAQ: ${file.faq.length}`)
    console.log(`   Fișă: ${file.review.facts.length} afirmații confirmate, ${file.review.warnings.length} avertismente`)
    for (const w of file.review.warnings) console.log(`   ⚠ ${w}`)
  }

  if (failed.length) {
    console.error(`\n${failed.length} fișier(e) cu erori — nu s-a scris nimic. Corectează și rulează din nou.`)
    await pool.end()
    process.exit(1)
  }

  const toWrite = planned.filter((p) => p.action !== 'unchanged')
  if (!confirm) {
    console.log(`\nPLAN: ${toWrite.filter((p) => p.action === 'create').length} de creat, ${toWrite.filter((p) => p.action === 'update').length} de actualizat, ${planned.length - toWrite.length} neschimbate. Nimic nu s-a scris — adaugă --confirm.`)
    await pool.end()
    return
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    for (const p of toWrite) {
      // Aceleasi coloane ca saveCategoryContentAction. Conditia pe content_updated_at = plasa de
      // siguranta: daca cineva a salvat din admin intre citire si scriere, oprim tot importul.
      const res = await client.query(`
        UPDATE categories
        SET intro_md = $2, faq = $3::jsonb, content_updated_at = now()
        WHERE id = $1 AND content_updated_at IS NOT DISTINCT FROM $4::timestamptz
      `, [p.cat.id, p.file.intro_md, JSON.stringify(p.file.faq), p.cat.updated_raw])
      if (res.rowCount !== 1) {
        throw new Error(`textul categoriei „${p.file.slug}” s-a schimbat între timp (salvat din admin?) — nu s-a scris nimic, rulează din nou planul`)
      }
      console.log(`✓ ${p.file.slug} → scris (/c/${p.file.slug})`)
    }
    await client.query('COMMIT')
    console.log(`\nGata: ${toWrite.length} categorii scrise.`)
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
    await pool.end()
  }

  if (toWrite.length) await revalidateSite(toWrite.map((p) => p.file.slug), noRevalidate)
}

// Acelasi efect ca salvarea din admin (cache-ul textului expirat + revalidatePath pe /c/<slug>),
// prin ruta web /api/revalidate/categorii (worker-ul nu poate apela revalidateTag direct).
async function revalidateSite(slugs: string[], skip: boolean) {
  const siteUrl = process.env.SITE_URL
  const secret = process.env.REVALIDATE_SECRET
  const fallback = 'Fără invalidare: textul nou apare pe /c/ în cel mult 1 oră (cache-ul textului). Pentru imediat: docker compose up -d --force-recreate web.'
  if (skip) { console.log(`\nInvalidare sărită (--no-revalidate). ${fallback}`); return }
  if (!siteUrl || !secret) { console.warn(`\n⚠ SITE_URL / REVALIDATE_SECRET lipsesc. ${fallback}`); return }
  try {
    const res = await fetch(`${siteUrl}/api/revalidate/categorii`, {
      method: 'POST',
      headers: { 'x-revalidate-secret': secret, 'content-type': 'application/json' },
      body: JSON.stringify({ slugs }),
      signal: AbortSignal.timeout(30000),
    })
    const body = await res.text()
    if (res.ok) console.log(`\nSite invalidat (${slugs.length} categorii): ${body}`)
    else console.warn(`\n⚠ Invalidarea a răspuns ${res.status}: ${body.slice(0, 300)}. ${fallback}`)
  } catch (err) {
    console.warn(`\n⚠ Nu s-a putut contacta ${siteUrl}: ${(err as Error).message}. ${fallback}`)
  }
}

main().catch((err) => { console.error(err); process.exit(1) })
