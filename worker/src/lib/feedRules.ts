import pool from './db.js'

// Regula de mapare rezolvata: categoria site + taguri pentru o categorie de feed.
export interface FeedRule {
  categoryId: number
  categorySlug: string
  tagIds: number[]
}

export type RuleLookup = (retailerId: number, feedCategory: string) => FeedRule | null

// Incarca toate regulile din feed_category_map. Regula specifica retailerului
// are prioritate fata de cea globala (retailer_id NULL).
export async function loadFeedRules(): Promise<RuleLookup> {
  const { rows } = await pool.query<{
    retailer_id: number | null
    feed_category: string
    category_id: number
    category_slug: string
    tag_ids: number[]
  }>(`
    SELECT m.retailer_id, m.feed_category, m.category_id, c.slug AS category_slug, m.tag_ids
    FROM feed_category_map m
    JOIN categories c ON c.id = m.category_id
  `)

  const rules = new Map<string, FeedRule>()
  for (const r of rows) {
    const key = `${r.retailer_id ?? 'g'}:${r.feed_category.toLowerCase()}`
    rules.set(key, { categoryId: r.category_id, categorySlug: r.category_slug, tagIds: r.tag_ids })
  }

  return (retailerId, feedCategory) => {
    const cat = feedCategory.toLowerCase().trim()
    return rules.get(`${retailerId}:${cat}`) ?? rules.get(`g:${cat}`) ?? null
  }
}
