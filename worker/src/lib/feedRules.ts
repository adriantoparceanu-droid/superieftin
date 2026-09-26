import pool from './db.js'
import { matchNameRule, termsPattern, type NameRule } from './nameRules.js'

// Regula de mapare rezolvata: categoria site + taguri pentru o categorie de feed.
export interface FeedRule {
  categoryId: number
  categorySlug: string
  tagIds: number[]
}

// 'ignore' = o regula „dupa denumire” spune ca produsul nu se importa (Admin → Mapare)
export const IGNORE = 'ignore' as const
export type RuleLookup = (retailerId: number, feedCategory: string, productName?: string) => FeedRule | typeof IGNORE | null

// Incarca toate regulile din feed_category_map. Regula specifica retailerului
// are prioritate fata de cea globala (retailer_id NULL). Daca niciuna nu se potriveste,
// se incearca regulile dupa denumire (name_category_rules) — pentru feed-uri fara categorie.
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

  const { rows: nameRows } = await pool.query<{
    id: number; retailer_id: number | null; terms: string; action: 'map' | 'ignore'
    category_id: number | null; category_slug: string | null; priority: number
  }>(`
    SELECT n.id, n.retailer_id, n.terms, n.action, n.category_id, c.slug AS category_slug, n.priority
    FROM name_category_rules n LEFT JOIN categories c ON c.id = n.category_id
    ORDER BY n.priority, n.id
  `).catch(() => ({ rows: [] }))   // migratia 020 inca neaplicata → fara reguli dupa denumire
  const nameRules: NameRule[] = []
  for (const r of nameRows) {
    const pattern = termsPattern(r.terms)
    if (!pattern) continue
    nameRules.push({
      id: r.id, retailerId: r.retailer_id, action: r.action, categoryId: r.category_id,
      categorySlug: r.category_slug, priority: r.priority, re: new RegExp(pattern),
    })
  }

  return (retailerId, feedCategory, productName) => {
    const cat = feedCategory.toLowerCase().trim()
    const byFeed = rules.get(`${retailerId}:${cat}`) ?? rules.get(`g:${cat}`) ?? null
    if (byFeed || !productName || !nameRules.length) return byFeed
    const byName = matchNameRule(nameRules, retailerId, productName)
    if (!byName) return null
    if (byName.action === 'ignore') return IGNORE
    return byName.categoryId && byName.categorySlug
      ? { categoryId: byName.categoryId, categorySlug: byName.categorySlug, tagIds: [] }
      : null
  }
}
