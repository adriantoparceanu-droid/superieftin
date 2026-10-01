'use server'

import { revalidateTag, revalidatePath, refresh } from 'next/cache'
import { redirect } from 'next/navigation'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import pool from '../db'
import { verifyPassword, hashPassword } from './password'
import { createSession, destroySession, requireAdmin } from './session'
import { termsPattern, firstMatchingRule, NAME_NORMALIZED_SQL, type NameRuleForMatch } from './nameMatch'
import {
  scanTpFeed, extractDomain, retailerSlugForDomain, normalizeFeedCategory, suggestSiteCategory,
  type FeedScanResult, type FeedCategoryInfo, type SiteCategory,
} from './feed-categories'
import { OFFER_AVAILABLE_SQL } from '../availability'

// Slugify identic cu worker/src/lib/slug.ts
function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[șțăî]/g, (c) => ({ ș: 's', ț: 't', ă: 'a', î: 'i' }[c] || c))
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120)
}

// Invalideaza cache-ul site-ului public (date tag-uite) SI reimprospateaza router-ul
// client, ca paginile de admin (date necachate) sa arate imediat starea noua fara refresh manual.
function revalidateAll() {
  revalidateTag('products', 'max')
  revalidateTag('categories', 'max')
  revalidateTag('menu', 'max')
  refresh()
}

// Ca revalidateAll, dar doar pentru meniu (header) + refresh admin.
function revalidateMenu() {
  revalidateTag('menu', 'max')
  refresh()
}

// ---------- Autentificare ----------

export async function loginAction(_prev: { error?: string } | null, formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const password = String(formData.get('password') ?? '')
  const { rows } = await pool.query<{ id: number; password_hash: string }>(
    'SELECT id, password_hash FROM admin_users WHERE email = $1 AND is_active = true',
    [email]
  )
  if (!rows[0] || !verifyPassword(password, rows[0].password_hash)) {
    return { error: 'Email sau parolă greșite.' }
  }
  await pool.query('UPDATE admin_users SET last_login_at = now() WHERE id = $1', [rows[0].id])
  await createSession(rows[0].id)
  redirect('/admin')
}

export async function logoutAction() {
  await destroySession()
  redirect('/admin/login')
}

// ---------- Categorii ----------

// Creeaza categoria (si itemul ei de meniu, sub itemul parintelui). Folosita de
// createCategoryAction si de „Creează categorie nouă” din Surse feed → Alege categoriile.
// Daca slug-ul exista deja (ex. „Car Kit” cand exista „Car kit”), NU cream un duplicat:
// intoarcem categoria existenta cu created = false, iar meniul ramane neatins.
async function insertCategoryWithMenu(
  name: string, parentId: number | null, icon: string | null,
): Promise<{ id: number; created: boolean }> {
  const slug = toSlug(name)
  const inserted = await pool.query<{ id: number }>(`
    INSERT INTO categories (name, slug, parent_id, icon, sort_order)
    VALUES ($1, $2, $3, $4, (SELECT coalesce(max(sort_order), 0) + 1 FROM categories))
    ON CONFLICT (slug) DO NOTHING
    RETURNING id
  `, [name, slug, parentId, icon])

  // Categorie nouă → apare automat și în meniul din header (sub părinte, dacă acesta
  // are deja un item de meniu). Se poate reordona/ascunde ulterior din /admin/meniu.
  const categoryId = inserted.rows[0]?.id
  if (categoryId) {
    const menuParentId = parentId
      ? (await pool.query<{ id: number }>(
          'SELECT id FROM menu_items WHERE category_id = $1 ORDER BY id LIMIT 1', [parentId]
        )).rows[0]?.id ?? null
      : null
    await pool.query(`
      INSERT INTO menu_items (label, category_id, parent_id, sort_order, is_visible)
      SELECT $1, $2, $3, (SELECT coalesce(max(sort_order), 0) + 1 FROM menu_items), true
      WHERE NOT EXISTS (SELECT 1 FROM menu_items WHERE category_id = $2)
    `, [name, categoryId, menuParentId])
    return { id: categoryId, created: true }
  }
  // ON CONFLICT DO NOTHING nu intoarce id-ul randului existent → il cautam dupa slug
  const existing = await pool.query<{ id: number }>('SELECT id FROM categories WHERE slug = $1', [slug])
  return { id: existing.rows[0].id, created: false }
}

export async function createCategoryAction(formData: FormData) {
  await requireAdmin()
  const name = String(formData.get('name') ?? '').trim()
  if (!name) return
  const parentId = formData.get('parent_id') ? Number(formData.get('parent_id')) : null
  const icon = String(formData.get('icon') ?? '').trim() || null
  await insertCategoryWithMenu(name, parentId, icon)
  revalidateAll()
}

export async function updateCategoryAction(formData: FormData) {
  await requireAdmin()
  const id = Number(formData.get('id'))
  const name = String(formData.get('name') ?? '').trim()
  if (!id || !name) return
  const parentId = formData.get('parent_id') ? Number(formData.get('parent_id')) : null
  const icon = String(formData.get('icon') ?? '').trim() || null
  // Slug-ul ramane stabil (URL-uri publice); doar numele/parintele/iconita se schimba
  await pool.query(
    'UPDATE categories SET name = $2, parent_id = $3, icon = $4 WHERE id = $1',
    [id, name, parentId === id ? null : parentId, icon]
  )
  revalidateAll()
}

export async function toggleCategoryVisibilityAction(formData: FormData) {
  await requireAdmin()
  const id = Number(formData.get('id'))
  if (!id) return
  await pool.query('UPDATE categories SET is_visible = NOT is_visible WHERE id = $1', [id])
  revalidateAll()
}

// Persista intregul arbore de categorii dupa drag-and-drop (parinte + ordine per categorie).
// Categoriile au maxim 2 niveluri (o categorie cu copii nu poate deveni subcategorie).
export async function reorderCategoriesAction(
  items: { id: number; parentId: number | null; sortOrder: number }[]
) {
  await requireAdmin()
  if (!Array.isArray(items) || !items.length) return

  const parentOf = new Map<number, number | null>(items.map((i) => [i.id, i.parentId]))
  const depthOf = (id: number): number => {
    let d = 0
    let p = parentOf.get(id) ?? null
    const seen = new Set<number>()
    while (p != null && !seen.has(p)) { seen.add(p); d++; p = parentOf.get(p) ?? null }
    return d
  }
  for (const it of items) {
    if (depthOf(it.id) > 1) throw new Error('Categoriile pot avea maxim 2 niveluri')
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    for (const it of items) {
      await client.query(
        'UPDATE categories SET parent_id = $2, sort_order = $3 WHERE id = $1',
        [it.id, it.parentId, it.sortOrder]
      )
    }
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
  revalidateAll()
}

export async function deleteCategoryAction(formData: FormData) {
  await requireAdmin()
  const id = Number(formData.get('id'))
  const reassignTo = formData.get('reassign_to') ? Number(formData.get('reassign_to')) : null
  if (!id) return
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    // Realoca produsele si subcategoriile, apoi sterge
    await client.query('UPDATE products SET category_id = $2 WHERE category_id = $1', [id, reassignTo])
    await client.query('UPDATE categories SET parent_id = NULL WHERE parent_id = $1', [id])
    await client.query('DELETE FROM feed_category_map WHERE category_id = $1', [id])
    await client.query('DELETE FROM categories WHERE id = $1', [id])
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
  revalidateAll()
}

// ---------- Mapare feed -> categorie ----------

export async function createMappingRuleAction(formData: FormData) {
  await requireAdmin()
  const feedCategory = String(formData.get('feed_category') ?? '').trim()
  const categoryId = Number(formData.get('category_id'))
  if (!feedCategory || !categoryId) return
  const retailerId = formData.get('global') === 'on' ? null
    : formData.get('retailer_id') ? Number(formData.get('retailer_id')) : null
  const tagIds = formData.getAll('tag_ids').map(Number).filter(Boolean)

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    await client.query(`
      INSERT INTO feed_category_map (retailer_id, feed_category, category_id, tag_ids)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (coalesce(retailer_id, 0), lower(feed_category))
      DO UPDATE SET category_id = EXCLUDED.category_id, tag_ids = EXCLUDED.tag_ids
    `, [retailerId, feedCategory, categoryId, tagIds])

    // Aplicare retroactiva pe produsele existente
    const retailerFilter = retailerId
      ? 'AND EXISTS (SELECT 1 FROM offers o WHERE o.product_id = p.id AND o.retailer_id = $3)'
      : ''
    const params: unknown[] = [feedCategory.toLowerCase(), categoryId]
    if (retailerId) params.push(retailerId)
    await client.query(`
      UPDATE products p SET
        category_id = $2,
        category = (SELECT slug FROM categories WHERE id = $2)
      WHERE lower(coalesce(p.feed_category, '')) = $1 ${retailerFilter}
    `, params)

    if (tagIds.length) {
      const tagParams: unknown[] = [feedCategory.toLowerCase(), tagIds]
      if (retailerId) tagParams.push(retailerId)
      await client.query(`
        INSERT INTO product_tags (product_id, tag_id)
        SELECT p.id, unnest($2::int[])
        FROM products p
        WHERE lower(coalesce(p.feed_category, '')) = $1 ${retailerFilter}
        ON CONFLICT DO NOTHING
      `, tagParams)
    }

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
  revalidateAll()
}

export async function deleteMappingRuleAction(formData: FormData) {
  await requireAdmin()
  const id = Number(formData.get('id'))
  if (!id) return
  await pool.query('DELETE FROM feed_category_map WHERE id = $1', [id])
  revalidateAll()
}

// ---------- Taguri ----------

export async function createTagAction(formData: FormData) {
  await requireAdmin()
  const name = String(formData.get('name') ?? '').trim()
  if (!name) return
  await pool.query(
    'INSERT INTO tags (name, slug) VALUES ($1, $2) ON CONFLICT (slug) DO NOTHING',
    [name, toSlug(name)]
  )
  revalidateAll()
}

export async function deleteTagAction(formData: FormData) {
  await requireAdmin()
  const id = Number(formData.get('id'))
  if (!id) return
  await pool.query('DELETE FROM tags WHERE id = $1', [id])
  revalidateAll()
}

// ---------- Meniu ----------

export async function createMenuItemAction(formData: FormData) {
  await requireAdmin()
  const label = String(formData.get('label') ?? '').trim()
  const categoryId = formData.get('category_id') ? Number(formData.get('category_id')) : null
  const url = String(formData.get('url') ?? '').trim() || null
  if (!label || (!categoryId && !url)) return
  // Itemii noi se creeaza la nivel 1; imbricarea se face apoi prin drag-and-drop.
  await pool.query(`
    INSERT INTO menu_items (label, category_id, url, parent_id, sort_order)
    VALUES ($1, $2, $3, NULL, (SELECT coalesce(max(sort_order), 0) + 1 FROM menu_items))
  `, [label, categoryId, categoryId ? null : url])
  revalidateMenu()
}

export async function toggleMenuItemAction(formData: FormData) {
  await requireAdmin()
  const id = Number(formData.get('id'))
  if (!id) return
  await pool.query('UPDATE menu_items SET is_visible = NOT is_visible WHERE id = $1', [id])
  revalidateMenu()
}

// Persista intregul arbore dupa drag-and-drop: noul parinte + ordine pentru fiecare item.
// Valideaza adancimea (max 3 niveluri) chiar daca UI o impune deja.
export async function reorderMenuAction(
  items: { id: number; parentId: number | null; sortOrder: number }[]
) {
  await requireAdmin()
  if (!Array.isArray(items) || !items.length) return

  const parentOf = new Map<number, number | null>(items.map((i) => [i.id, i.parentId]))
  const depthOf = (id: number): number => {
    let d = 0
    let p = parentOf.get(id) ?? null
    const seen = new Set<number>()
    while (p != null && !seen.has(p)) { seen.add(p); d++; p = parentOf.get(p) ?? null }
    return d
  }
  for (const it of items) {
    if (depthOf(it.id) > 2) throw new Error('Adâncime maximă depășită (max 3 niveluri)')
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    for (const it of items) {
      await client.query(
        'UPDATE menu_items SET parent_id = $2, sort_order = $3 WHERE id = $1',
        [it.id, it.parentId, it.sortOrder]
      )
    }
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
  revalidateMenu()
}

export async function deleteMenuItemAction(formData: FormData) {
  await requireAdmin()
  const id = Number(formData.get('id'))
  if (!id) return
  await pool.query('DELETE FROM menu_items WHERE id = $1', [id])
  revalidateMenu()
}

// ---------- Import feed ----------

export async function uploadFeedAction(_prev: { message?: string; error?: string } | null, formData: FormData) {
  await requireAdmin()
  const file = formData.get('file') as File | null
  if (!file || !file.size) return { error: 'Alege un fișier XML sau CSV.' }
  const ext = file.name.toLowerCase().endsWith('.csv') ? 'csv' : 'xml'
  if (!/\.(xml|csv)$/i.test(file.name)) return { error: 'Doar fișiere .xml sau .csv.' }

  const uploadDir = process.env.UPLOAD_DIR || join(process.cwd(), '..', 'uploads')
  await mkdir(uploadDir, { recursive: true })
  const destPath = join(uploadDir, `upload-${Date.now()}.${ext}`)
  await writeFile(destPath, Buffer.from(await file.arrayBuffer()))

  const retailerSlug = String(formData.get('retailer_slug') ?? '').trim() || undefined

  // Trimite jobul catre worker prin coada BullMQ existenta
  const { Queue } = await import('bullmq')
  const queue = new Queue('sync', {
    connection: { url: process.env.REDIS_URL || 'redis://localhost:6379', maxRetriesPerRequest: null },
  })
  await queue.add('file-import', { type: 'file-import', filePath: destPath, retailerSlug, filename: file.name })
  await queue.close()

  return { message: `„${file.name}" a fost trimis la import. Rezultatul apare în istoric în câteva minute.` }
}

// ---------- Utilizatori ----------

export async function createAdminUserAction(formData: FormData) {
  await requireAdmin()
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const password = String(formData.get('password') ?? '')
  const name = String(formData.get('name') ?? '').trim()
  if (!email || password.length < 8) return
  await pool.query(`
    INSERT INTO admin_users (email, password_hash, name)
    VALUES ($1, $2, $3)
    ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, is_active = true
  `, [email, hashPassword(password), name])
  refresh()
}

export async function toggleAdminUserAction(formData: FormData) {
  const current = await requireAdmin()
  const id = Number(formData.get('id'))
  if (!id || id === current.id) return  // nu te dezactivezi singur
  await pool.query('UPDATE admin_users SET is_active = NOT is_active WHERE id = $1', [id])
  refresh()
}

// ---------- Surse feed (external_feeds) ----------

export async function addExternalFeedAction(formData: FormData) {
  await requireAdmin()
  const url = String(formData.get('url') ?? '').trim()
  const network = String(formData.get('network') ?? '').trim() || '2performant'
  const label = String(formData.get('label') ?? '').trim() || null
  if (!/^https?:\/\//i.test(url)) return  // URL valid obligatoriu
  // „Alege categoriile înainte de primul import” (bifata implicit): feed-ul nou porneste cu
  // filtrul gol '{}' → workerul il sare pana alegi categoriile, ca importul de noapte sa nu
  // aduca tot feed-ul (ex. 17.000 de produse, majoritatea huse). Doar 2Performant are filtru.
  const chooseFirst = formData.get('choose_categories') === 'on' && network === '2performant'
  await pool.query(
    `INSERT INTO external_feeds (url, network, label, category_filter) VALUES ($1, $2, $3, $4)
     ON CONFLICT (url) DO UPDATE SET network = EXCLUDED.network, label = EXCLUDED.label, is_active = true`,
    // La un URL deja existent filtrul ramane cel salvat (nu-l resetam la re-adaugare)
    [url, network, label, chooseFirst ? [] : null]
  )
  refresh()
}

export async function toggleExternalFeedAction(formData: FormData) {
  await requireAdmin()
  const id = Number(formData.get('id'))
  if (!id) return
  await pool.query('UPDATE external_feeds SET is_active = NOT is_active WHERE id = $1', [id])
  refresh()
}

export async function deleteExternalFeedAction(formData: FormData) {
  await requireAdmin()
  const id = Number(formData.get('id'))
  if (!id) return
  await pool.query('DELETE FROM external_feeds WHERE id = $1', [id])
  refresh()
}

// ---------- Surse feed → „Alege categoriile” (external_feeds.category_filter, migratia 028) ----------

function revalidateFeedPages() {
  revalidatePath('/admin/surse-feed')
  revalidatePath('/admin/magazine')
}

// Descarca feed-ul ACUM (streaming, nu tot XML-ul in memorie) si intoarce categoriile lui cu
// numarul de produse + informatia de mapare. Nu scrie nimic in baza de date.
export async function scanFeedCategoriesAction(feedId: number): Promise<FeedScanResult | { error: string }> {
  await requireAdmin()
  const { rows: feedRows } = await pool.query<{ id: number; url: string; label: string | null; network: string; category_filter: string[] | null }>(
    'SELECT id, url, label, network, category_filter FROM external_feeds WHERE id = $1', [Number(feedId)]
  )
  const feed = feedRows[0]
  if (!feed) return { error: 'Feed-ul nu mai există.' }
  if (feed.network !== '2performant') return { error: 'Alegerea categoriilor e disponibilă doar pentru feed-urile 2Performant.' }

  // Retailerii existenti (dupa slug, ca workerul) si regulile „dupa denumire” — tabele mici,
  // le incarcam o data ca sa putem evalua fiecare produs din feed fara query-uri in bucla.
  const { rows: retailers } = await pool.query<{ id: number; name: string; slug: string }>('SELECT id, name, slug FROM retailers')
  const retailerBySlug = new Map(retailers.map((r) => [r.slug, r]))
  const allNameRules = await loadNameRulesForMatch(null)
  const nameRules = allNameRules.map((r) => ({ ...r, re: new RegExp(r.pattern) }))

  type Acc = { name: string; count: number; ignored: number; mapped: number }
  const byCategory = new Map<string, Acc>()
  const domainCounts = new Map<string, number>()
  // Denumirile produselor FARA <category> (doar ele — restul se mapeaza pe categorie): pentru
  // statisticile si previzualizarea regulilor „dupa denumire” din browser. Pastram doar
  // titlul (nu tot item-ul), cu plafon, ca un feed urias sa nu umple memoria / pagina.
  const uncategorizedTitles: string[] = []
  let uncategorizedTotal = 0
  let total = 0, bytes = 0
  try {
    const res = await scanTpFeed(feed.url, (item) => {
      // Workerul sare oricum produsele fara titlu sau fara magazin recunoscut
      const domain = extractDomain(item.campaignName)
      if (!item.title || !domain) return
      total++
      domainCounts.set(domain, (domainCounts.get(domain) ?? 0) + 1)
      const key = normalizeFeedCategory(item.category)
      const acc = byCategory.get(key) ?? { name: item.category.trim(), count: 0, ignored: 0, mapped: 0 }
      acc.count++
      const retailerId = retailerBySlug.get(retailerSlugForDomain(domain))?.id ?? null
      const byName = nameRules.length ? firstMatchingRule(nameRules, retailerId, item.title)?.action ?? null : null
      if (byName === 'ignore') acc.ignored++
      else if (byName === 'map') acc.mapped++
      if (!key) {
        uncategorizedTotal++
        if (uncategorizedTitles.length < UNCATEGORIZED_TITLES_CAP) uncategorizedTitles.push(item.title)
      }
      byCategory.set(key, acc)
    })
    bytes = res.bytes
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { error: /abort|timeout/i.test(msg) ? 'Descărcarea feed-ului a durat prea mult (peste 2 minute). Încearcă din nou.' : `Nu am putut descărca feed-ul: ${msg}` }
  }

  // Magazinul dominant din feed (de obicei unul singur) — maparea e per magazin
  const domain = [...domainCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  const retailerRow = domain ? retailerBySlug.get(retailerSlugForDomain(domain)) ?? null : null

  // Categoriile din filtrul salvat care nu mai apar in feed raman in lista (cu 0 produse),
  // ca o salvare noua sa nu le piarda pe tacute
  const filter = feed.category_filter
  const selectedKeys = new Set((filter ?? []).map(normalizeFeedCategory))
  for (const f of filter ?? []) {
    const key = normalizeFeedCategory(f)
    if (!byCategory.has(key)) byCategory.set(key, { name: f.trim(), count: 0, ignored: 0, mapped: 0 })
  }

  // Regulile feed_category_map: regula magazinului bate regula globala (ca loadFeedRules)
  const keys = [...byCategory.keys()].filter(Boolean)
  const { rows: rules } = await pool.query<{ key: string; category_id: number; retailer_id: number | null; label: string }>(`
    SELECT DISTINCT ON (lower(m.feed_category)) lower(m.feed_category) AS key, m.category_id, m.retailer_id,
           CASE WHEN p.name IS NOT NULL THEN p.name || ' › ' || c.name ELSE c.name END AS label
    FROM feed_category_map m
    JOIN categories c ON c.id = m.category_id
    LEFT JOIN categories p ON p.id = c.parent_id
    WHERE lower(m.feed_category) = ANY($1::text[]) AND (m.retailer_id = $2::int OR m.retailer_id IS NULL)
    ORDER BY lower(m.feed_category), m.retailer_id NULLS LAST
  `, [keys, retailerRow?.id ?? null])
  const ruleByKey = new Map(rules.map((r) => [r.key, r]))

  // Categoriile de site in care se pot pune produse (frunzele arborelui), pentru sugestie
  const { rows: siteCats } = await pool.query<SiteCategory>(`
    SELECT c.id, c.name, c.parent_id AS "parentId", p.name AS "parentName"
    FROM categories c LEFT JOIN categories p ON p.id = c.parent_id
    WHERE NOT EXISTS (SELECT 1 FROM categories ch WHERE ch.parent_id = c.id)
  `)

  const categories = [...byCategory.entries()].map(([key, acc]): FeedCategoryInfo => {
    const rule = ruleByKey.get(key)
    const sugg = rule || !key ? null : suggestSiteCategory(acc.name, siteCats)
    return {
      name: acc.name,
      count: acc.count,
      selected: filter == null ? true : selectedKeys.has(key),
      mapping: rule ? { categoryId: rule.category_id, label: rule.label, scope: rule.retailer_id == null ? 'global' : 'retailer' } : null,
      suggestion: sugg ? { categoryId: sugg.id, label: sugg.parentName ? `${sugg.parentName} › ${sugg.name}` : sugg.name, parentId: sugg.parentId } : null,
      ignoredByName: acc.ignored,
      mappedByName: acc.mapped,
    }
  }).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ro'))

  return {
    feedId: feed.id,
    feedLabel: feed.label,
    total,
    bytes,
    domain,
    retailer: retailerRow ? { id: retailerRow.id, name: retailerRow.name } : null,
    filterMode: filter == null ? 'all' : filter.length === 0 ? 'none' : 'list',
    categories,
    uncategorized: uncategorizedTotal
      ? { titles: uncategorizedTitles, total: uncategorizedTotal, capped: uncategorizedTotal > uncategorizedTitles.length }
      : null,
    // Doar regulile care conteaza pentru magazinul feed-ului (ale lui + globale)
    nameRules: allNameRules.filter((r) => r.retailerId == null || r.retailerId === (retailerRow?.id ?? -1)),
  }
}

// Plafonul de denumiri fara categorie trimise catre pagina (~1,5 MB la 20.000 de titluri)
const UNCATEGORIZED_TITLES_CAP = 20_000

// Regulile „dupa denumire” in ordinea in care le aplica workerul (priority, id), cu eticheta
// categoriei. retailerId null = toate; altfel doar ale magazinului + cele globale.
async function loadNameRulesForMatch(retailerId: number | null): Promise<NameRuleForMatch[]> {
  const { rows } = await pool.query<{
    id: number; retailer_id: number | null; terms: string; action: 'map' | 'ignore'
    category_id: number | null; label: string | null; priority: number
  }>(`
    SELECT n.id, n.retailer_id, n.terms, n.action, n.category_id, n.priority,
           CASE WHEN p.name IS NOT NULL THEN p.name || ' › ' || c.name ELSE c.name END AS label
    FROM name_category_rules n
    LEFT JOIN categories c ON c.id = n.category_id
    LEFT JOIN categories p ON p.id = c.parent_id
    WHERE $1::int IS NULL OR n.retailer_id IS NULL OR n.retailer_id = $1
    ORDER BY n.priority, n.id
  `, [retailerId]).catch(() => ({ rows: [] }))   // migratia 020 inca neaplicata → fara reguli
  return rows.flatMap((r) => {
    const pattern = termsPattern(r.terms)
    return pattern ? [{
      id: r.id, retailerId: r.retailer_id, action: r.action, categoryId: r.category_id,
      categoryLabel: r.label, priority: r.priority, pattern,
    }] : []
  })
}

// Regula „denumirea conține X → categorie existentă / ignoră” din randul „(fără categorie în
// feed)”. Salvarea trece prin createNameRuleAction (aceeasi ca in Admin → Mapare, aplicata
// imediat pe produsele nemapate) si intoarce regulile recitite in ACELASI apel: statisticile
// randului se recalculeaza in browser fara a descarca din nou feed-ul. (Un al doilea apel
// separat ramanea blocat in coada de server actions dupa refresh()-ul din prima.)
export async function createNameRuleFromFeedAction(input: {
  terms: string; action: 'map' | 'ignore'; categoryId: number | null; retailerId: number
}): Promise<{ rules: NameRuleForMatch[] } | { error: string }> {
  await requireAdmin()
  const terms = String(input.terms ?? '').trim().slice(0, 500)
  const action = input.action === 'ignore' ? 'ignore' : 'map'
  const retailerId = Number(input.retailerId) || null
  const categoryId = action === 'map' ? Number(input.categoryId) || null : null
  if (!termsPattern(terms)) return { error: 'Scrie cel puțin un termen.' }
  if (!retailerId) return { error: 'Magazin nou — maparea devine disponibilă după primul import.' }
  if (action === 'map' && !categoryId) return { error: 'Alege categoria site-ului.' }
  const fd = new FormData()
  fd.set('terme', terms)
  fd.set('actiune', action)
  fd.set('categorie', categoryId ? String(categoryId) : '')
  fd.set('retailer', String(retailerId))
  await createNameRuleAction(fd)   // include revalidateAll()
  revalidateFeedPages()
  return { rules: await loadNameRulesForMatch(retailerId) }
}

// mode 'all' → NULL (importa tot, inclusiv categoriile care vor aparea pe viitor);
// mode 'list' → doar categoriile trimise (lista goala = nu importa nimic).
// Debifarea nu sterge nimic: ofertele categoriilor scoase devin fara stoc dupa 3 zile.
export async function saveFeedCategoryFilterAction(
  feedId: number, mode: 'all' | 'list', categories: string[],
): Promise<{ ok: true } | { error: string }> {
  await requireAdmin()
  const id = Number(feedId)
  if (!id) return { error: 'Feed invalid.' }
  let value: string[] | null = null
  if (mode === 'list') {
    if (!Array.isArray(categories) || categories.length > 2000) return { error: 'Listă de categorii invalidă.' }
    // Fara dubluri care difera doar prin majuscule/spatii (la import se compara normalizat)
    const seen = new Map<string, string>()
    for (const c of categories) {
      const name = String(c).trim().slice(0, 300)
      if (!seen.has(normalizeFeedCategory(name))) seen.set(normalizeFeedCategory(name), name)
    }
    value = [...seen.values()]
  }
  const res = await pool.query(
    `UPDATE external_feeds SET category_filter = $2 WHERE id = $1 AND network = '2performant'`, [id, value]
  )
  if (!res.rowCount) return { error: 'Feed-ul nu mai există.' }
  revalidateFeedPages()
  return { ok: true }
}

// „Creează categorie nouă” pentru o categorie de feed nemapata: creeaza categoria de site
// (+ itemul de meniu, ca createCategoryAction) si apoi regula de mapare a magazinului prin
// createMappingRuleAction (aceeasi ca „Mapează”, cu aplicare pe produsele existente).
export async function createCategoryAndMapFeedAction(input: {
  feedCategory: string; retailerId: number; name: string; parentId: number | null
}): Promise<{ categoryId: number; label: string; existed: boolean } | { error: string }> {
  await requireAdmin()
  const feedCategory = String(input.feedCategory ?? '').trim()
  const name = String(input.name ?? '').trim().slice(0, 100)
  const retailerId = Number(input.retailerId) || null
  const parentId = input.parentId ? Number(input.parentId) : null
  if (!feedCategory) return { error: 'Produsele fără categorie în feed se mapează doar după denumire (Admin → Mapare).' }
  // Fara magazin nu putem face regula; nu cream nici categoria, ca sa nu ramana una goala in meniu
  if (!retailerId) return { error: 'Magazin nou — maparea devine disponibilă după primul import.' }
  const invalid = await validateNewCategory(name, parentId)
  if (invalid) return { error: invalid }

  const { id: categoryId, created } = await insertCategoryWithMenu(name, parentId, null)
  const fd = new FormData()
  fd.set('feed_category', feedCategory)
  fd.set('retailer_id', String(retailerId))
  fd.set('category_id', String(categoryId))
  await createMappingRuleAction(fd)   // include revalidateAll() (site + meniu + admin)

  revalidateFeedPages()
  return { categoryId, label: await categoryLabel(categoryId, name), existed: !created }
}

// Verificarile comune pentru „Creează categorie nouă” (din categoria de feed sau din regula
// dupa denumire). Intoarce mesajul de eroare sau null.
async function validateNewCategory(name: string, parentId: number | null): Promise<string | null> {
  if (!name || !toSlug(name)) return 'Scrie numele categoriei.'
  if (parentId) {
    // Parintele trebuie sa fie o categorie principala (meniul are 2 niveluri)
    const { rows } = await pool.query('SELECT 1 FROM categories WHERE id = $1 AND parent_id IS NULL', [parentId])
    if (!rows.length) return 'Părintele ales nu mai există (sau nu e categorie principală).'
  }
  return null
}

// „Părinte › Categorie”, ca in selecturile din admin
async function categoryLabel(categoryId: number, fallback: string): Promise<string> {
  const { rows } = await pool.query<{ label: string }>(`
    SELECT CASE WHEN p.name IS NOT NULL THEN p.name || ' › ' || c.name ELSE c.name END AS label
    FROM categories c LEFT JOIN categories p ON p.id = c.parent_id WHERE c.id = $1
  `, [categoryId])
  return rows[0]?.label ?? fallback
}

// Regula „denumirea conține X → categorie NOUĂ” din randul „(fără categorie în feed)”:
// creeaza categoria (+ meniu, ca createCategoryAction), apoi regula prin createNameRuleAction
// — aceeasi actiune ca in Admin → Mapare, care o aplica imediat pe produsele nemapate.
export async function createCategoryAndNameRuleAction(input: {
  terms: string; retailerId: number; name: string; parentId: number | null
}): Promise<{ categoryId: number; label: string; existed: boolean; rules: NameRuleForMatch[] } | { error: string }> {
  await requireAdmin()
  const terms = String(input.terms ?? '').trim().slice(0, 500)
  const name = String(input.name ?? '').trim().slice(0, 100)
  const retailerId = Number(input.retailerId) || null
  const parentId = input.parentId ? Number(input.parentId) : null
  if (!termsPattern(terms)) return { error: 'Scrie cel puțin un termen.' }
  if (!retailerId) return { error: 'Magazin nou — maparea devine disponibilă după primul import.' }
  const invalid = await validateNewCategory(name, parentId)
  if (invalid) return { error: invalid }

  const { id: categoryId, created } = await insertCategoryWithMenu(name, parentId, null)
  const fd = new FormData()
  fd.set('terme', terms)
  fd.set('actiune', 'map')
  fd.set('categorie', String(categoryId))
  fd.set('retailer', String(retailerId))
  await createNameRuleAction(fd)   // include revalidateAll()
  revalidateFeedPages()
  return {
    categoryId, label: await categoryLabel(categoryId, name), existed: !created,
    rules: await loadNameRulesForMatch(retailerId),
  }
}

// ---------- Bannere homepage ----------

function revalidateBanners() {
  revalidateTag('banners', 'max')
  refresh()
}

const BANNER_SLOTS = ['main', 'small_left', 'small_right']

export async function createBannerAction(formData: FormData) {
  await requireAdmin()
  const slot = String(formData.get('slot') ?? '')
  if (!BANNER_SLOTS.includes(slot)) return
  const type = formData.get('type') === 'html' ? 'html' : 'image'
  const title = String(formData.get('title') ?? '').trim() || null
  const html = String(formData.get('html') ?? '').trim() || null
  const imageUrl = String(formData.get('image_url') ?? '').trim() || null
  const linkUrl = String(formData.get('link_url') ?? '').trim() || null
  const alt = String(formData.get('alt') ?? '').trim() || null

  // Nevalid daca lipseste continutul potrivit tipului ales
  if (type === 'html' ? !html : !imageUrl) return

  await pool.query(`
    INSERT INTO banners (slot, type, title, image_url, link_url, alt, html, sort_order)
    VALUES ($1, $2, $3, $4, $5, $6, $7, (SELECT coalesce(max(sort_order), 0) + 1 FROM banners WHERE slot = $1))
  `, [slot, type, title, imageUrl, linkUrl, alt, html])
  revalidateBanners()
}

export async function toggleBannerAction(formData: FormData) {
  await requireAdmin()
  const id = Number(formData.get('id'))
  if (!id) return
  await pool.query('UPDATE banners SET is_active = NOT is_active, updated_at = now() WHERE id = $1', [id])
  revalidateBanners()
}

export async function deleteBannerAction(formData: FormData) {
  await requireAdmin()
  const id = Number(formData.get('id'))
  if (!id) return
  await pool.query('DELETE FROM banners WHERE id = $1', [id])
  revalidateBanners()
}

// ---------- Categorii scrapate eMAG (scraper_categories) ----------

// Adauga o categorie de scanat eMAG SI leaga produsele direct la o categorie de site:
// creeaza regula feed_category_map (retailer emag) pe un token stabil (feed_category), ca
// produsele scanate sa fie mapate automat la prima rulare, fara mapare manuala ulterioara.
export async function addScraperCategoryAction(formData: FormData) {
  await requireAdmin()
  const path = String(formData.get('path') ?? '').trim().replace(/^\/+|\/+$/g, '')
  const label = String(formData.get('label') ?? '').trim()
  const categoryId = Number(formData.get('category_id'))
  const maxPages = Math.max(1, Math.min(20, Number(formData.get('max_pages')) || 3))
  if (!path || !label || !categoryId) return

  const emag = await pool.query<{ id: number }>(`SELECT id FROM retailers WHERE slug = 'emag'`)
  const retailerId = emag.rows[0]?.id
  if (!retailerId) return

  // Token de feed determinist per categorie eMAG (path-ul), pe care se leaga regula de mapare.
  const feedCategory = `emag:${path}`

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(`
      INSERT INTO scraper_categories (retailer_id, path, label, feed_category, max_pages)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (retailer_id, path) DO UPDATE SET
        label = EXCLUDED.label, feed_category = EXCLUDED.feed_category,
        max_pages = EXCLUDED.max_pages, updated_at = now()
    `, [retailerId, path, label, feedCategory, maxPages])

    await client.query(`
      INSERT INTO feed_category_map (retailer_id, feed_category, category_id, tag_ids)
      VALUES ($1, $2, $3, '{}')
      ON CONFLICT (COALESCE(retailer_id, 0), lower(feed_category))
      DO UPDATE SET category_id = EXCLUDED.category_id
    `, [retailerId, feedCategory, categoryId])
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
  revalidateAll()
}

// Pune in coada worker-ului un refresh al catalogului de categorii disponibile (sitemap
// eMAG) — cererea catre eMAG o face worker-ul, nu containerul web. Rezultatul apare in
// pagina dupa cateva secunde (worker-ul trebuie sa ruleze).
export async function refreshEmagCatalogAction() {
  await requireAdmin()
  const { Queue } = await import('bullmq')
  const queue = new Queue('sync', {
    connection: { url: process.env.REDIS_URL || 'redis://localhost:6379', maxRetriesPerRequest: null },
  })
  await queue.add('catalog-refresh', { type: 'catalog-refresh' })
  await queue.close()
  refresh()
}

// „Actualizează acum” din /admin/statistici: pune in coada worker-ului jobul `ga4-sync`
// (acelasi care ruleaza zilnic la 06:15). Cererea catre Google o face worker-ul, nu containerul
// web — aici doar anuntam. Datele noi apar dupa ~1 minut, la reincarcarea paginii.
export async function refreshGa4StatsAction() {
  await requireAdmin()
  const { Queue } = await import('bullmq')
  const queue = new Queue('sync', {
    connection: { url: process.env.REDIS_URL || 'redis://localhost:6379', maxRetriesPerRequest: null },
  })
  await queue.add('ga4-sync', { type: 'ga4-sync' })
  await queue.close()
  refresh()
}

export async function toggleScraperCategoryAction(formData: FormData) {
  await requireAdmin()
  const id = Number(formData.get('id'))
  if (!id) return
  await pool.query('UPDATE scraper_categories SET enabled = NOT enabled, updated_at = now() WHERE id = $1', [id])
  refresh()
}

export async function updateScraperCategoryMaxPagesAction(formData: FormData) {
  await requireAdmin()
  const id = Number(formData.get('id'))
  const maxPages = Math.max(1, Math.min(20, Number(formData.get('max_pages')) || 3))
  if (!id) return
  await pool.query('UPDATE scraper_categories SET max_pages = $2, updated_at = now() WHERE id = $1', [id, maxPages])
  refresh()
}

export async function deleteScraperCategoryAction(formData: FormData) {
  await requireAdmin()
  const id = Number(formData.get('id'))
  if (!id) return
  // Sterge si regula de mapare creata pentru aceasta categorie (feed_category = token emag).
  await pool.query(`
    DELETE FROM feed_category_map m
    USING scraper_categories sc
    WHERE sc.id = $1 AND m.retailer_id = sc.retailer_id
      AND lower(m.feed_category) = lower(sc.feed_category)
  `, [id])
  await pool.query('DELETE FROM scraper_categories WHERE id = $1', [id])
  refresh()
}

// ---------- Magazine & surse (pauza / nota) ----------

// Pauza ascunde IMEDIAT toate ofertele magazinului de pe site (filtrul OFFER_AVAILABLE_SQL),
// fara sa stearga nimic; datele se actualizeaza in continuare din feed, deci la reactivare
// ofertele revin cu preturi proaspete.
export async function pauseRetailerAction(formData: FormData) {
  await requireAdmin()
  const id = Number(formData.get('id'))
  const reason = String(formData.get('reason') ?? '').trim().slice(0, 300) || 'Pus pe pauză din admin'
  if (!id) return
  await pool.query(
    `UPDATE retailers SET paused_at = now(), pause_reason = $2,
       source_state = 'paused', source_reason = $2, source_state_since = now()
     WHERE id = $1`,
    [id, reason]
  )
  revalidateTag('discounts', 'max')
  revalidateAll()
}

export async function resumeRetailerAction(formData: FormData) {
  await requireAdmin()
  const id = Number(formData.get('id'))
  if (!id) return
  // Starea reala se recalculeaza la urmatorul feed-sync; pana atunci „reactivat”
  await pool.query(
    `UPDATE retailers SET paused_at = NULL, pause_reason = NULL,
       source_state = NULL, source_reason = 'Reactivat — starea se recalculează la următoarea sincronizare',
       source_state_since = now()
     WHERE id = $1`,
    [id]
  )
  revalidateTag('discounts', 'max')
  revalidateAll()
}

export async function saveRetailerNoteAction(formData: FormData) {
  await requireAdmin()
  const id = Number(formData.get('id'))
  const note = String(formData.get('note') ?? '').trim().slice(0, 1000) || null
  if (!id) return
  await pool.query('UPDATE retailers SET admin_note = $2 WHERE id = $1', [id, note])
  refresh()
}

// ---------- Mapare dupa denumire (migratia 020) ----------

// Salveaza regula si o aplica imediat pe produsele NEMAPATE existente (nu atinge produsele
// care au deja categorie). La import, workerul o aplica automat (worker/src/lib/feedRules.ts).
//   map    → produsele primesc categoria aleasa
//   ignore → ofertele lor se ascund acum, iar la urmatoarele importuri nu se mai importa
export async function createNameRuleAction(formData: FormData) {
  await requireAdmin()
  const terms = String(formData.get('terme') ?? '').trim().slice(0, 500)
  const action = formData.get('actiune') === 'ignore' ? 'ignore' : 'map'
  const categoryId = action === 'map' ? Number(formData.get('categorie')) || null : null
  const retailerId = formData.get('toti') === '1' ? null : Number(formData.get('retailer')) || null
  const pattern = termsPattern(terms)
  if (!pattern || (action === 'map' && !categoryId)) return

  await pool.query(
    `INSERT INTO name_category_rules (retailer_id, terms, category_id, action) VALUES ($1, $2, $3, $4)`,
    [retailerId, terms, categoryId, action]
  )

  const scope = `EXISTS (SELECT 1 FROM offers o WHERE o.product_id = p.id AND ($1::int IS NULL OR o.retailer_id = $1))`
  if (action === 'map') {
    await pool.query(`
      UPDATE products p SET category_id = c.id, category = c.slug, updated_at = now()
      FROM categories c
      WHERE c.id = $3 AND p.category_id IS NULL AND ${NAME_NORMALIZED_SQL} ~ $2 AND ${scope}
    `, [retailerId, pattern, categoryId])
  } else {
    await pool.query(`
      UPDATE offers o SET in_stock = false
      FROM products p
      WHERE p.id = o.product_id AND p.category_id IS NULL AND ${NAME_NORMALIZED_SQL} ~ $2
        AND ($1::int IS NULL OR o.retailer_id = $1) AND ${OFFER_AVAILABLE_SQL}
    `, [retailerId, pattern])
  }
  revalidateTag('discounts', 'max')
  revalidateAll()
}

export async function deleteNameRuleAction(formData: FormData) {
  await requireAdmin()
  const id = Number(formData.get('id'))
  if (!id) return
  // Stergerea nu readuce automat produsele: cele mapate raman in categorie, cele ignorate
  // revin la urmatorul import al feed-ului.
  await pool.query('DELETE FROM name_category_rules WHERE id = $1', [id])
  refresh()
}
