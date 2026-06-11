import pool from '../db'

// Query-uri pentru paginile admin — fara cache, adminul vede mereu starea reala.

export interface RetailerStats {
  id: number
  name: string
  slug: string
  is_active: boolean
  products: number
  offers: number
}

export async function getRetailerStats(): Promise<RetailerStats[]> {
  const { rows } = await pool.query<RetailerStats>(`
    SELECT r.id, r.name, r.slug, r.is_active,
           count(DISTINCT o.product_id)::int AS products,
           count(o.id)::int AS offers
    FROM retailers r LEFT JOIN offers o ON o.retailer_id = r.id
    GROUP BY r.id ORDER BY offers DESC
  `)
  return rows
}

export async function getUnmappedCount(): Promise<number> {
  const { rows } = await pool.query<{ count: number }>(
    'SELECT count(*)::int AS count FROM products WHERE category_id IS NULL'
  )
  return rows[0].count
}

export interface FeedSyncRow {
  id: number
  feed_name: string | null
  source: string
  filename: string | null
  products_count: number | null
  unmapped_count: number | null
  status: string
  synced_at: Date
}

export async function getRecentSyncs(limit = 20): Promise<FeedSyncRow[]> {
  const { rows } = await pool.query<FeedSyncRow>(`
    SELECT id, feed_name, source, filename, products_count, unmapped_count, status, synced_at
    FROM feed_syncs ORDER BY synced_at DESC LIMIT $1
  `, [limit])
  return rows
}

export interface UnmappedGroup {
  feed_category: string
  retailer_id: number | null
  retailer_name: string | null
  product_count: number
}

export async function getUnmappedGroups(): Promise<UnmappedGroup[]> {
  const { rows } = await pool.query<UnmappedGroup>(`
    SELECT coalesce(p.feed_category, '(fără categorie)') AS feed_category,
           r.id AS retailer_id, r.name AS retailer_name,
           count(DISTINCT p.id)::int AS product_count
    FROM products p
    LEFT JOIN offers o ON o.product_id = p.id
    LEFT JOIN retailers r ON r.id = o.retailer_id
    WHERE p.category_id IS NULL
    GROUP BY 1, 2, 3
    ORDER BY product_count DESC
  `)
  return rows
}

export interface AdminCategory {
  id: number
  name: string
  slug: string
  parent_id: number | null
  icon: string | null
  sort_order: number
  is_visible: boolean
  product_count: number
}

export async function getCategoriesTree(): Promise<AdminCategory[]> {
  const { rows } = await pool.query<AdminCategory>(`
    SELECT c.id, c.name, c.slug, c.parent_id, c.icon, c.sort_order, c.is_visible,
           (SELECT count(*) FROM products p WHERE p.category_id = c.id)::int AS product_count
    FROM categories c
    ORDER BY c.parent_id NULLS FIRST, c.sort_order, c.id
  `)
  return rows
}

export interface MappingRule {
  id: number
  retailer_id: number | null
  retailer_name: string | null
  feed_category: string
  category_name: string
  tag_names: string[]
}

export async function getMappingRules(): Promise<MappingRule[]> {
  const { rows } = await pool.query<MappingRule>(`
    SELECT m.id, m.retailer_id, r.name AS retailer_name, m.feed_category,
           c.name AS category_name,
           coalesce(array_agg(t.name) FILTER (WHERE t.id IS NOT NULL), '{}') AS tag_names
    FROM feed_category_map m
    JOIN categories c ON c.id = m.category_id
    LEFT JOIN retailers r ON r.id = m.retailer_id
    LEFT JOIN tags t ON t.id = ANY(m.tag_ids)
    GROUP BY m.id, r.name, c.name
    ORDER BY m.created_at DESC
  `)
  return rows
}

export interface AdminTag {
  id: number
  name: string
  slug: string
  product_count: number
}

export async function getTagsWithCounts(): Promise<AdminTag[]> {
  const { rows } = await pool.query<AdminTag>(`
    SELECT t.id, t.name, t.slug,
           (SELECT count(*) FROM product_tags pt WHERE pt.tag_id = t.id)::int AS product_count
    FROM tags t ORDER BY t.name
  `)
  return rows
}

export interface AdminMenuItem {
  id: number
  label: string
  category_id: number | null
  category_slug: string | null
  url: string | null
  parent_id: number | null
  sort_order: number
  is_visible: boolean
}

export async function getMenuItemsAdmin(): Promise<AdminMenuItem[]> {
  const { rows } = await pool.query<AdminMenuItem>(`
    SELECT m.id, m.label, m.category_id, c.slug AS category_slug, m.url,
           m.parent_id, m.sort_order, m.is_visible
    FROM menu_items m LEFT JOIN categories c ON c.id = m.category_id
    ORDER BY m.parent_id NULLS FIRST, m.sort_order, m.id
  `)
  return rows
}

export interface AdminUserRow {
  id: number
  email: string
  name: string
  is_active: boolean
  last_login_at: Date | null
}

export async function getAdminUsers(): Promise<AdminUserRow[]> {
  const { rows } = await pool.query<AdminUserRow>(
    'SELECT id, email, name, is_active, last_login_at FROM admin_users ORDER BY id'
  )
  return rows
}

export async function getActiveRetailersList(): Promise<{ id: number; name: string; slug: string }[]> {
  const { rows } = await pool.query('SELECT id, name, slug FROM retailers ORDER BY name')
  return rows
}
