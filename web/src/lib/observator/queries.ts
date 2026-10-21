import { unstable_cache } from 'next/cache'
import pool from '../db'
import { timingEligible, type Edition, type IndexRow, type TimingWeek } from './observator'

// Citirile paginilor /indice și /cand-sa-cumperi: DOAR din tabelele precalculate de worker
// (migrația 037, worker/src/lib/price-index.ts) — nicio agregare pe price_history aici.
// Cache o oră (tag „price-index”); datele se schimbă oricum doar lunar / săptămânal.
//
// Vizibilitatea categoriilor se verifică la citire (categoria și părintele ei vizibile, ca pe /c/):
// o categorie ascunsă din admin dispare și din „Când să cumperi”. Edițiile lunare rămân însă
// arhivă — rândurile lor se afișează, doar fără link spre o categorie ascunsă.

const num = (v: unknown): number | null => (v == null ? null : Number(v))

const VISIBLE_SQL = `(c.is_visible AND (pc.id IS NULL OR pc.is_visible))`

export const getPublishedEditions = unstable_cache(
  async (): Promise<Edition[]> => {
    const { rows } = await pool.query(`
      SELECT to_char(month, 'YYYY-MM-DD') AS month, basket_size, median_change_pct, categories, retailers,
             real_discounts, retroactive, correction_note, computed_at
      FROM price_index_editions
      WHERE published
      ORDER BY month DESC
    `)
    return rows.map((r) => ({
      month: r.month,
      basket_size: r.basket_size,
      median_change_pct: num(r.median_change_pct),
      categories: r.categories,
      retailers: r.retailers,
      real_discounts: r.real_discounts,
      retroactive: r.retroactive,
      correction_note: r.correction_note,
      computed_at: new Date(r.computed_at).toISOString(),
    }))
  },
  ['observator-editions'],
  { revalidate: 3600, tags: ['price-index'] }
)

export interface IndexRowView extends IndexRow {
  linkable: boolean                 // categoria există și e vizibilă acum (link spre /c/)
  live_slugs: Record<string, string> // product_id → slug actual, doar pentru produsele care mai există
}

export const getEditionRows = unstable_cache(
  async (month: string): Promise<IndexRowView[]> => {
    const { rows } = await pool.query(`
      SELECT m.category_slug, m.category_name, m.parent_slug, m.basket_size, m.median_change_pct, m.share_down_pct,
             m.real_discounts, m.retailers, m.cheapest_retailer_name, m.cheapest_wins, m.compared_products, m.top_drops,
             COALESCE(${VISIBLE_SQL}, false) AS linkable
      FROM price_index_monthly m
      LEFT JOIN categories c ON c.id = m.category_id
      LEFT JOIN categories pc ON pc.id = c.parent_id
      WHERE m.month = $1::date AND m.published
    `, [month])
    // Produsele din „cele mai mari scăderi” pot fi șterse între timp: linkăm doar ce mai există
    const ids = [...new Set(rows.flatMap((r) => (r.top_drops as { product_id: number }[]).map((d) => d.product_id)))]
    const live = new Map<string, string>()
    if (ids.length) {
      const res = await pool.query<{ id: string; slug: string }>('SELECT id::text, slug FROM products WHERE id = ANY($1::bigint[])', [ids])
      for (const p of res.rows) live.set(p.id, p.slug)
    }
    return rows.map((r) => {
      const drops = (r.top_drops as IndexRow['top_drops']) ?? []
      return {
        category_slug: r.category_slug,
        category_name: r.category_name,
        parent_slug: r.parent_slug,
        basket_size: r.basket_size,
        median_change_pct: num(r.median_change_pct),
        share_down_pct: num(r.share_down_pct),
        real_discounts: r.real_discounts,
        retailers: r.retailers,
        cheapest_retailer_name: r.cheapest_retailer_name,
        cheapest_wins: r.cheapest_wins,
        compared_products: r.compared_products,
        top_drops: drops,
        linkable: r.linkable,
        live_slugs: Object.fromEntries(drops.filter((d) => live.has(String(d.product_id))).map((d) => [String(d.product_id), live.get(String(d.product_id))!])),
      }
    })
  },
  ['observator-edition-rows'],
  { revalidate: 3600, tags: ['price-index'] }
)

export interface TimingCategory {
  slug: string
  name: string
  parent_slug: string | null
  tracked_since: string             // YYYY-MM-DD
  computed_at: string               // ISO
  weeks: TimingWeek[]
}

// Toate seriile, grupate pe categorie (tabela e mică: categorii × săptămâni), DOAR categoriile
// vizibile. Filtrul de prag (timingEligible) îl aplică cine citește.
export const getTimingCategories = unstable_cache(
  async (): Promise<TimingCategory[]> => {
    const { rows } = await pool.query(`
      SELECT t.category_slug, t.category_name, t.parent_slug, to_char(t.tracked_since, 'YYYY-MM-DD') AS tracked_since,
             to_char(t.week, 'YYYY-MM-DD') AS week, t.products, t.basket_median, t.real_discount_share, t.product_days,
             t.real_days, t.avg_real_streak_days, t.real_streaks, t.computed_at
      FROM category_buy_timing t
      JOIN categories c ON c.id = t.category_id
      LEFT JOIN categories pc ON pc.id = c.parent_id
      WHERE ${VISIBLE_SQL}
      ORDER BY t.category_slug, t.week
    `)
    const out = new Map<string, TimingCategory>()
    for (const r of rows) {
      let c = out.get(r.category_slug)
      if (!c) {
        c = { slug: r.category_slug, name: r.category_name, parent_slug: r.parent_slug, tracked_since: r.tracked_since, computed_at: new Date(r.computed_at).toISOString(), weeks: [] }
        out.set(r.category_slug, c)
      }
      c.weeks.push({
        week: r.week,
        products: r.products,
        basket_median: num(r.basket_median),
        real_discount_share: num(r.real_discount_share),
        product_days: r.product_days,
        real_days: r.real_days,
        avg_real_streak_days: num(r.avg_real_streak_days),
        real_streaks: r.real_streaks,
      })
    }
    return [...out.values()]
  },
  ['observator-timing'],
  { revalidate: 3600, tags: ['price-index'] }
)

// Categoriile care AU pagină „Când să cumperi” (legături din /c/, sitemap, llms.txt)
export async function getTimingEligible(): Promise<TimingCategory[]> {
  return (await getTimingCategories()).filter((c) => timingEligible(c.weeks))
}
