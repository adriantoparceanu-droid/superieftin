'use server'

import { revalidateTag, refresh } from 'next/cache'
import { redirect } from 'next/navigation'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import pool from '../db'
import { verifyPassword, hashPassword } from './password'
import { createSession, destroySession, requireAdmin } from './session'

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

export async function createCategoryAction(formData: FormData) {
  await requireAdmin()
  const name = String(formData.get('name') ?? '').trim()
  if (!name) return
  const parentId = formData.get('parent_id') ? Number(formData.get('parent_id')) : null
  const icon = String(formData.get('icon') ?? '').trim() || null
  const inserted = await pool.query<{ id: number }>(`
    INSERT INTO categories (name, slug, parent_id, icon, sort_order)
    VALUES ($1, $2, $3, $4, (SELECT coalesce(max(sort_order), 0) + 1 FROM categories))
    ON CONFLICT (slug) DO NOTHING
    RETURNING id
  `, [name, toSlug(name), parentId, icon])

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
  }
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
  await pool.query(
    `INSERT INTO external_feeds (url, network, label) VALUES ($1, $2, $3)
     ON CONFLICT (url) DO UPDATE SET network = EXCLUDED.network, label = EXCLUDED.label, is_active = true`,
    [url, network, label]
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
