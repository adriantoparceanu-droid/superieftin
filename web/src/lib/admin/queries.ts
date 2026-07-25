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

export interface ExternalFeedRow {
  id: number
  url: string
  network: string
  label: string | null
  is_active: boolean
  created_at: Date
}

export async function getExternalFeeds(): Promise<ExternalFeedRow[]> {
  const { rows } = await pool.query<ExternalFeedRow>(
    'SELECT id, url, network, label, is_active, created_at FROM external_feeds ORDER BY network, label, id'
  )
  return rows
}

export interface AdminBanner {
  id: number
  slot: string
  type: 'image' | 'html'
  title: string | null
  image_url: string | null
  link_url: string | null
  alt: string | null
  html: string | null
  is_active: boolean
  sort_order: number
}

export async function getAdminBanners(): Promise<AdminBanner[]> {
  const { rows } = await pool.query<AdminBanner>(`
    SELECT id, slot, type, title, image_url, link_url, alt, html, is_active, sort_order
    FROM banners ORDER BY slot, sort_order, id
  `)
  return rows
}

export async function getActiveRetailersList(): Promise<{ id: number; name: string; slug: string }[]> {
  const { rows } = await pool.query('SELECT id, name, slug FROM retailers ORDER BY name')
  return rows
}

// --- Rapoarte dashboard ------------------------------------------------------

export interface AffiliateAdvertiserRow {
  network: string
  name: string | null
  domain: string | null
  commission: number | null
  status: string
  updated_at: Date
}

export async function getAffiliateAdvertisers(): Promise<AffiliateAdvertiserRow[]> {
  const { rows } = await pool.query<AffiliateAdvertiserRow>(`
    SELECT network, name, domain, commission::float AS commission, status, updated_at
    FROM affiliate_advertisers
    ORDER BY status = 'active' DESC, commission DESC NULLS LAST, name
  `)
  return rows
}

export interface PlatformStats {
  advertisers_active: number
  advertisers_total: number
  offers_total: number
  offers_affiliate: number
  affiliate_coverage: number   // 0..1
  clicks_7d: number
  clicks_30d: number
}

export async function getPlatformStats(): Promise<PlatformStats> {
  const { rows } = await pool.query<PlatformStats>(`
    SELECT
      (SELECT count(*) FROM affiliate_advertisers WHERE status = 'active')::int AS advertisers_active,
      (SELECT count(*) FROM affiliate_advertisers)::int AS advertisers_total,
      (SELECT count(*) FROM offers)::int AS offers_total,
      (SELECT count(*) FROM offers WHERE affiliate_url IS NOT NULL)::int AS offers_affiliate,
      COALESCE(
        (SELECT count(*) FILTER (WHERE affiliate_url IS NOT NULL)::float / NULLIF(count(*), 0) FROM offers),
        0
      ) AS affiliate_coverage,
      (SELECT count(*) FROM click_events WHERE clicked_at > now() - interval '7 days')::int AS clicks_7d,
      (SELECT count(*) FROM click_events WHERE clicked_at > now() - interval '30 days')::int AS clicks_30d
  `)
  return rows[0]
}

export interface TopProduct {
  id: number
  name: string
  slug: string
  image_url: string | null
  clicks: number
}

export async function getTopClickedProducts(days = 30, limit = 20): Promise<TopProduct[]> {
  const { rows } = await pool.query<TopProduct>(`
    SELECT p.id, p.name, p.slug, p.image_url, count(ce.id)::int AS clicks
    FROM click_events ce
    JOIN offers o ON o.id = ce.offer_id
    JOIN products p ON p.id = o.product_id
    WHERE ce.clicked_at > now() - make_interval(days => $1)
    GROUP BY p.id ORDER BY clicks DESC LIMIT $2
  `, [days, limit])
  return rows
}

export interface TopSearch {
  term: string
  searches: number
  avg_results: number | null
}

export async function getTopSearches(days = 30, limit = 20): Promise<TopSearch[]> {
  const { rows } = await pool.query<TopSearch>(`
    SELECT lower(term) AS term, count(*)::int AS searches,
           round(avg(results_count))::int AS avg_results
    FROM search_queries
    WHERE created_at > now() - make_interval(days => $1)
    GROUP BY lower(term) ORDER BY searches DESC LIMIT $2
  `, [days, limit])
  return rows
}

export interface FeedFreshnessRow {
  feed_link: string
  feed_name: string | null
  source: string
  status: string
  products_count: number | null
  synced_at: Date
  age_seconds: number   // varsta verificarii, calculata in DB (now()) ca sa ramana pura in render
}

// Ultima verificare per feed/scraper (cel mai recent rand din feed_syncs pentru fiecare sursa).
export async function getFeedFreshness(): Promise<FeedFreshnessRow[]> {
  const { rows } = await pool.query<FeedFreshnessRow>(`
    SELECT DISTINCT ON (feed_link) feed_link, feed_name, source, status, products_count, synced_at,
           EXTRACT(EPOCH FROM (now() - synced_at))::int AS age_seconds
    FROM feed_syncs
    ORDER BY feed_link, synced_at DESC
  `)
  // Cele mai vechi verificari primele (atrag atentia asupra surselor stagnante).
  return rows.sort((a, b) => b.age_seconds - a.age_seconds)
}

// ---------- Categorii scrapate (retaileri fara feed, ex. eMAG) ----------

export interface ScraperCategoryRow {
  id: number
  retailer_id: number
  retailer_name: string
  path: string
  label: string
  feed_category: string
  category_name: string | null   // categoria de site tinta (din feed_category_map)
  max_pages: number
  enabled: boolean
}

// Optiuni pentru selectorul de categorie-tinta: doar categoriile-frunza (fara copii),
// etichetate „Parinte › Copil" ca sa fie clare in dropdown.
export interface CategoryOption {
  id: number
  label: string
}

export async function getCategoryOptions(): Promise<CategoryOption[]> {
  const { rows } = await pool.query<CategoryOption>(`
    SELECT c.id,
           CASE WHEN p.name IS NOT NULL THEN p.name || ' › ' || c.name ELSE c.name END AS label
    FROM categories c
    LEFT JOIN categories p ON p.id = c.parent_id
    WHERE NOT EXISTS (SELECT 1 FROM categories ch WHERE ch.parent_id = c.id)
    ORDER BY label
  `)
  return rows
}

export interface AvailableCategory {
  path: string
  label: string
  taken: boolean   // exista deja in scraper_categories — nu se re-selecteaza
}

export interface AvailableCatalog {
  categories: AvailableCategory[]
  lastSyncedAt: Date | null
}

// Catalogul categoriilor disponibile pe eMAG (populat de worker din sitemap-ul oficial),
// din care adminul alege ce se scaneaza — vezi available_scraper_categories (migratia 014).
export async function getAvailableEmagCategories(): Promise<AvailableCatalog> {
  const { rows } = await pool.query<AvailableCategory & { last_seen_at: Date }>(`
    SELECT ac.path, ac.label, ac.last_seen_at,
           EXISTS (
             SELECT 1 FROM scraper_categories sc
             WHERE sc.retailer_id = ac.retailer_id AND sc.path = ac.path
           ) AS taken
    FROM available_scraper_categories ac
    JOIN retailers r ON r.id = ac.retailer_id
    WHERE r.slug = 'emag'
    ORDER BY ac.label
  `)
  const lastSyncedAt = rows.length
    ? rows.reduce((max, r) => (r.last_seen_at > max ? r.last_seen_at : max), rows[0].last_seen_at)
    : null
  return {
    categories: rows.map(({ path, label, taken }) => ({ path, label, taken })),
    lastSyncedAt,
  }
}

// Categoriile scrapate momentan tin doar de eMAG (singurul scraper inregistrat
// in worker/src/scrapers/ingest.ts) — nu e un selector generic de retaileri.
export async function getScraperCategories(): Promise<ScraperCategoryRow[]> {
  const { rows } = await pool.query<ScraperCategoryRow>(`
    SELECT sc.id, sc.retailer_id, r.name AS retailer_name, sc.path, sc.label,
           sc.feed_category, sc.max_pages, sc.enabled,
           cat.name AS category_name
    FROM scraper_categories sc
    JOIN retailers r ON r.id = sc.retailer_id
    -- Regula de mapare aplicata: cea specifica retailerului are prioritate fata de cea globala.
    LEFT JOIN LATERAL (
      SELECT m.category_id FROM feed_category_map m
      WHERE lower(m.feed_category) = lower(sc.feed_category)
        AND (m.retailer_id = sc.retailer_id OR m.retailer_id IS NULL)
      ORDER BY (m.retailer_id IS NOT NULL) DESC LIMIT 1
    ) m ON true
    LEFT JOIN categories cat ON cat.id = m.category_id
    WHERE r.slug = 'emag'
    ORDER BY sc.label
  `)
  return rows
}

export interface EmagSyncStatusRow {
  category_name: string
  product_count: number
  last_synced: Date | null   // cand a ajuns pe acest server (updated_at la ultimul sync)
  last_scraped: Date | null  // cand a fost scanat de la eMAG (last_checked al ofertei)
}

// Stare sincronizare eMAG pe ACEST server (pe prod = ce e live). Grupat pe categoria
// de site a produsului. eMAG se scaneaza local si se urca prin sync-emag-to-live.sh.
export async function getEmagSyncStatus(): Promise<EmagSyncStatusRow[]> {
  const { rows } = await pool.query<EmagSyncStatusRow>(`
    SELECT COALESCE(c.name, p.category, '(nemapat)') AS category_name,
           COUNT(*)::int    AS product_count,
           MAX(p.updated_at) AS last_synced,
           MAX(o.last_checked) AS last_scraped
    FROM offers o
    JOIN retailers r ON r.id = o.retailer_id
    JOIN products  p ON p.id = o.product_id
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE r.slug = 'emag'
    GROUP BY COALESCE(c.name, p.category, '(nemapat)')
    ORDER BY product_count DESC
  `)
  return rows
}
