'use server'

import { revalidateTag } from 'next/cache'
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

function revalidateAll() {
  revalidateTag('products', 'max')
  revalidateTag('categories', 'max')
  revalidateTag('menu', 'max')
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
  await pool.query(`
    INSERT INTO categories (name, slug, parent_id, icon, sort_order)
    VALUES ($1, $2, $3, $4, (SELECT coalesce(max(sort_order), 0) + 1 FROM categories))
    ON CONFLICT (slug) DO NOTHING
  `, [name, toSlug(name), parentId, icon])
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

export async function moveCategoryAction(formData: FormData) {
  await requireAdmin()
  const id = Number(formData.get('id'))
  const direction = String(formData.get('direction'))
  if (!id) return
  // Schimba sort_order cu vecinul (in cadrul aceluiasi parinte)
  await pool.query(`
    WITH current AS (SELECT id, parent_id, sort_order FROM categories WHERE id = $1),
    neighbor AS (
      SELECT c.id, c.sort_order FROM categories c, current cur
      WHERE c.parent_id IS NOT DISTINCT FROM cur.parent_id
        AND ${direction === 'up' ? 'c.sort_order < cur.sort_order' : 'c.sort_order > cur.sort_order'}
      ORDER BY c.sort_order ${direction === 'up' ? 'DESC' : 'ASC'} LIMIT 1
    )
    UPDATE categories c SET sort_order = CASE
      WHEN c.id = (SELECT id FROM current) THEN (SELECT sort_order FROM neighbor)
      ELSE (SELECT sort_order FROM current)
    END
    WHERE c.id IN ((SELECT id FROM current), (SELECT id FROM neighbor))
      AND EXISTS (SELECT 1 FROM neighbor)
  `, [id])
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
  const parentId = formData.get('parent_id') ? Number(formData.get('parent_id')) : null
  await pool.query(`
    INSERT INTO menu_items (label, category_id, url, parent_id, sort_order)
    VALUES ($1, $2, $3, $4, (SELECT coalesce(max(sort_order), 0) + 1 FROM menu_items))
  `, [label, categoryId, categoryId ? null : url, parentId])
  revalidateTag('menu', 'max')
}

export async function toggleMenuItemAction(formData: FormData) {
  await requireAdmin()
  const id = Number(formData.get('id'))
  if (!id) return
  await pool.query('UPDATE menu_items SET is_visible = NOT is_visible WHERE id = $1', [id])
  revalidateTag('menu', 'max')
}

export async function moveMenuItemAction(formData: FormData) {
  await requireAdmin()
  const id = Number(formData.get('id'))
  const direction = String(formData.get('direction'))
  if (!id) return
  await pool.query(`
    WITH current AS (SELECT id, parent_id, sort_order FROM menu_items WHERE id = $1),
    neighbor AS (
      SELECT m.id, m.sort_order FROM menu_items m, current cur
      WHERE m.parent_id IS NOT DISTINCT FROM cur.parent_id
        AND ${direction === 'up' ? 'm.sort_order < cur.sort_order' : 'm.sort_order > cur.sort_order'}
      ORDER BY m.sort_order ${direction === 'up' ? 'DESC' : 'ASC'} LIMIT 1
    )
    UPDATE menu_items m SET sort_order = CASE
      WHEN m.id = (SELECT id FROM current) THEN (SELECT sort_order FROM neighbor)
      ELSE (SELECT sort_order FROM current)
    END
    WHERE m.id IN ((SELECT id FROM current), (SELECT id FROM neighbor))
      AND EXISTS (SELECT 1 FROM neighbor)
  `, [id])
  revalidateTag('menu', 'max')
}

export async function deleteMenuItemAction(formData: FormData) {
  await requireAdmin()
  const id = Number(formData.get('id'))
  if (!id) return
  await pool.query('DELETE FROM menu_items WHERE id = $1', [id])
  revalidateTag('menu', 'max')
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
}

export async function toggleAdminUserAction(formData: FormData) {
  const current = await requireAdmin()
  const id = Number(formData.get('id'))
  if (!id || id === current.id) return  // nu te dezactivezi singur
  await pool.query('UPDATE admin_users SET is_active = NOT is_active WHERE id = $1', [id])
}
