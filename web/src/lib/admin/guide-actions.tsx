'use server'

import { revalidatePath, refresh } from 'next/cache'
import { redirect } from 'next/navigation'
import { after } from 'next/server'
import pool from '../db'
import { requireAdmin } from './session'
import { searchProductsForGuide } from './guides'
import { slugify, RESERVED_GUIDE_SLUGS, findHealthClaims } from '../guides/format'
import { pingIndexNow } from '../guides/indexnow'
import { GuideBody } from '@/components/guides/GuideBody'
import type { FaqItem } from '../guides/queries'
import { unverifiedFields } from '../guides/review'

export type GuideFormState = { error?: string; message?: string } | null

function parseJson<T>(raw: FormDataEntryValue | null, fallback: T): T {
  try {
    return raw ? (JSON.parse(String(raw)) as T) : fallback
  } catch {
    return fallback
  }
}

// Invalideaza tot ce afiseaza ghidul: articolul (slug nou si vechi), lista, paginile de produs
// legate (sectiunea „Ghiduri despre acest produs”). Sitemap-ul si llms.txt sunt dinamice.
function revalidateGuide(slugs: string[], productSlugs: string[]) {
  for (const s of new Set(slugs)) revalidatePath(`/ghiduri/${s}`)
  revalidatePath('/ghiduri')
  for (const s of new Set(productSlugs)) revalidatePath(`/p/${s}`)
  refresh()
}

// Salveaza (creare sau editare). intent:
//   save      → pastreaza starea curenta (ciorna ramane ciorna; ghidul publicat se actualizeaza live)
//   publish   → publica (published_at = prima publicare, nu se schimba la re-publicare)
//   unpublish → retrage: redevine ciorna, pagina publica da 404
export async function saveGuideAction(_prev: GuideFormState, formData: FormData): Promise<GuideFormState> {
  await requireAdmin()

  const id = Number(formData.get('id')) || null
  const intent = String(formData.get('intent') ?? 'save')
  const title = String(formData.get('title') ?? '').trim().slice(0, 200)
  const slug = slugify(String(formData.get('slug') ?? '').trim() || title)
  const meta = String(formData.get('meta_description') ?? '').trim().slice(0, 300) || null
  const kind = formData.get('kind') === 'categorie' ? 'categorie' : 'produs'
  const authorId = Number(formData.get('author_id')) || null
  const reviewerId = Number(formData.get('reviewer_id')) || null
  const categorySlug = String(formData.get('category_slug') ?? '').trim() || null
  const summary = String(formData.get('summary') ?? '').trim() || null
  const body = String(formData.get('body_md') ?? '')
  const faq = parseJson<FaqItem[]>(formData.get('faq'), [])
    .map((f) => ({ q: String(f.q ?? '').trim(), a: String(f.a ?? '').trim() }))
    .filter((f) => f.q && f.a)
  const productIds = [...new Set(parseJson<string[]>(formData.get('products'), []).map(String).filter((p) => /^\d+$/.test(p)))]

  if (!title) return { error: 'Titlul este obligatoriu.' }
  if (!slug) return { error: 'Slug invalid.' }
  if (RESERVED_GUIDE_SLUGS.includes(slug)) return { error: `Slug-ul „${slug}” este rezervat (pagină existentă).` }

  // Starea finala
  let status: 'draft' | 'published'
  if (intent === 'publish') status = 'published'
  else if (intent === 'unpublish') status = 'draft'
  else if (id) {
    const cur = await pool.query<{ status: 'draft' | 'published' }>('SELECT status FROM guides WHERE id = $1', [id])
    if (!cur.rows[0]) return { error: 'Ghidul nu mai există.' }
    status = cur.rows[0].status
  } else status = 'draft'

  // Condiții de publicare: un ghid public are autor, verificator uman (decizia proprietarului:
  // „Verificat de”), descriere meta si text. Afirmatiile de sanatate blocheaza publicarea (regula 8).
  if (status === 'published') {
    const missing = [
      !authorId && 'autor',
      !reviewerId && 'verificator',
      !meta && 'descriere meta',
      !body.trim() && 'corpul articolului',
    ].filter(Boolean)
    if (missing.length) return { error: `Pentru publicare lipsește: ${missing.join(', ')}.` }
    const claims = findHealthClaims([title, meta, summary, body, ...faq.flatMap((f) => [f.q, f.a])].join('\n'))
    if (claims.length) {
      return { error: `Textul conține afirmații de sănătate interzise (REGULI.md, regula 8): ${claims.join(', ')}. Reformulează înainte de publicare.` }
    }
    // Ciornele scrise de AI marcheaza locurile nesigure cu „[DE VERIFICAT: …]”. Butonul „Publică”
    // e dezactivat in editor cat timp exista, dar verificam si aici (formularul poate fi trimis ocolind UI-ul).
    const unverified = unverifiedFields({
      titlu: title, 'descriere meta': meta, rezumat: summary, corp: body,
      FAQ: faq.flatMap((f) => [f.q, f.a]).join('\n'),
    })
    if (unverified.length) {
      return { error: `Mai există marcaje [DE VERIFICAT] în: ${unverified.map((u) => `${u.field} (${u.count})`).join(', ')}. Verifică și șterge-le înainte de publicare.` }
    }
  }

  const client = await pool.connect()
  let guideId = id
  let oldSlug: string | null = null
  let oldProductSlugs: string[] = []
  let wasPublished = false
  try {
    await client.query('BEGIN')
    if (id) {
      const prev = await client.query<{ slug: string; status: string }>('SELECT slug, status FROM guides WHERE id = $1 FOR UPDATE', [id])
      if (!prev.rows[0]) throw new Error('Ghidul nu mai există.')
      oldSlug = prev.rows[0].slug
      wasPublished = prev.rows[0].status === 'published'
      const ps = await client.query<{ slug: string }>(
        'SELECT p.slug FROM guide_products gp JOIN products p ON p.id = gp.product_id WHERE gp.guide_id = $1', [id])
      oldProductSlugs = ps.rows.map((r) => r.slug)
      await client.query(`
        UPDATE guides SET slug = $2, title = $3, meta_description = $4, kind = $5, author_id = $6,
          reviewer_id = $7, category_slug = $8, summary = $9, body_md = $10, faq = $11::jsonb,
          status = $12,
          published_at = CASE WHEN $12 = 'published' THEN COALESCE(published_at, now()) ELSE published_at END,
          updated_at = now()
        WHERE id = $1
      `, [id, slug, title, meta, kind, authorId, reviewerId, categorySlug, summary, body, JSON.stringify(faq), status])
    } else {
      const ins = await client.query<{ id: number }>(`
        INSERT INTO guides (slug, title, meta_description, kind, author_id, reviewer_id, category_slug,
                            summary, body_md, faq, status, published_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, CASE WHEN $11 = 'published' THEN now() END)
        RETURNING id
      `, [slug, title, meta, kind, authorId, reviewerId, categorySlug, summary, body, JSON.stringify(faq), status])
      guideId = ins.rows[0].id
    }
    await client.query('DELETE FROM guide_products WHERE guide_id = $1', [guideId])
    if (productIds.length) {
      await client.query(`
        INSERT INTO guide_products (guide_id, product_id, position)
        SELECT $1, pid, ord::int FROM unnest($2::bigint[]) WITH ORDINALITY AS t(pid, ord)
        WHERE EXISTS (SELECT 1 FROM products WHERE id = pid)
      `, [guideId, productIds])
    }
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    if ((err as { code?: string }).code === '23505') return { error: `Există deja un ghid cu slug-ul „${slug}”.` }
    return { error: err instanceof Error ? err.message : 'Eroare la salvare.' }
  } finally {
    client.release()
  }

  const newProducts = await pool.query<{ slug: string }>(
    'SELECT p.slug FROM guide_products gp JOIN products p ON p.id = gp.product_id WHERE gp.guide_id = $1', [guideId])
  revalidateGuide([slug, ...(oldSlug ? [oldSlug] : [])], [...oldProductSlugs, ...newProducts.rows.map((r) => r.slug)])

  // IndexNow: doar cand se schimba ceva public (publicare, actualizare live, retragere)
  if (status === 'published' || wasPublished) {
    const paths = [`/ghiduri/${slug}`, '/ghiduri', ...(oldSlug && oldSlug !== slug ? [`/ghiduri/${oldSlug}`] : [])]
    after(() => pingIndexNow(paths))
  }

  if (!id) redirect(`/admin/ghiduri/${guideId}?salvat=1`)
  const msg = intent === 'publish' ? 'Publicat.' : intent === 'unpublish' ? 'Retras — ghidul e din nou ciornă (404 public).' : 'Salvat.'
  return { message: msg }
}

// Sterge DOAR ciornele (un ghid publicat trebuie intai retras — evita stergerea din greseala)
export async function deleteGuideAction(formData: FormData) {
  await requireAdmin()
  const id = Number(formData.get('id'))
  if (!id) return
  await pool.query(`DELETE FROM guides WHERE id = $1 AND status = 'draft'`, [id])
  revalidatePath('/ghiduri')
  redirect('/admin/ghiduri')
}

// Cautare de produse pentru editor (legare produse de ghid)
export async function searchGuideProductsAction(q: string) {
  await requireAdmin()
  return searchProductsForGuide(String(q).slice(0, 100))
}

// Previzualizare: randeaza corpul Markdown cu blocurile live din baza de date, exact ca pe
// pagina publica (aceeasi componenta), plus avertismente pentru marcaje gresite.
export async function previewGuideAction(body: string) {
  await requireAdmin()
  return <GuideBody body={String(body).slice(0, 200_000)} preview />
}

// ---------- Autori ----------

export async function saveGuideAuthorAction(formData: FormData) {
  await requireAdmin()
  const id = Number(formData.get('id')) || null
  const name = String(formData.get('name') ?? '').trim().slice(0, 120)
  if (!name) return
  const kind = formData.get('kind') === 'organization' ? 'organization' : 'person'
  const bio = String(formData.get('bio') ?? '').trim().slice(0, 1000) || null
  let url = String(formData.get('url') ?? '').trim().slice(0, 300) || null
  // Doar linkuri pe site (/…) sau https:// — altfel un „javascript:” ar ajunge in href
  if (url && !url.startsWith('/') && !/^https:\/\//i.test(url)) url = null
  if (id) {
    await pool.query('UPDATE guide_authors SET name = $2, kind = $3, bio = $4, url = $5 WHERE id = $1', [id, name, kind, bio, url])
  } else {
    await pool.query(
      'INSERT INTO guide_authors (name, slug, kind, bio, url) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (slug) DO NOTHING',
      [name, slugify(name), kind, bio, url]
    )
  }
  // Numele autorului apare pe toate ghidurile lui
  revalidatePath('/ghiduri/[slug]', 'page')
  refresh()
}
