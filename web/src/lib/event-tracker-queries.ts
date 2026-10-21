import { unstable_cache } from 'next/cache'
import pool from './db'
import { OFFER_AVAILABLE_SQL } from './availability'
import { EVENT_PAGES, type DailyStat, type OfferEventStatus, type PriceEvent } from './event-tracker'
import type { ProductWithDiscount } from './queries'

// Query-urile trackerului de evenimente (/black-friday-2026, rândul „umflat” de pe /p/).
// DOAR citiri din tabelele precalculate de worker (migrația 036) — fără agregări pe price_history.
// Datele se schimbă o dată pe zi (după snapshot), deci cache de o oră (ca ISR-ul paginii).
// Momentele (timestamptz) ies ca Date din pg, dar ca string ISO din cache (unstable_cache
// serializează JSON) — de aceea tipurile acceptă ambele și se citesc mereu cu new Date(...).

export const getPriceEvent = unstable_cache(
  async (slug: string): Promise<PriceEvent | null> => {
    const { rows } = await pool.query<PriceEvent>(`
      SELECT slug, name, freeze_at, starts_at, ends_at, reference_computed_at
      FROM price_events WHERE slug = $1
    `, [slug])
    return rows[0] ?? null
  },
  ['price-event'],
  { revalidate: 3600, tags: ['event-tracker'] }
)

export const getEventDailyStats = unstable_cache(
  async (slug: string): Promise<DailyStat[]> => {
    const { rows } = await pool.query<DailyStat>(`
      SELECT to_char(day, 'YYYY-MM-DD') AS day, category_id, level, parent_id, category_slug, category_name,
             tracked, reduse, reale, reduse_reale, umflate,
             real_discount_median_pct::float AS real_discount_median_pct, stores, computed_at
      FROM event_daily_stats
      WHERE event_slug = $1
      ORDER BY day, category_id
    `, [slug])
    return rows
  },
  ['event-daily-stats'],
  { revalidate: 3600, tags: ['event-tracker'] }
)

export interface EventDeal extends ProductWithDiscount {
  root_id: number
  event_discount_pct: number     // reducerea față de referința înghețată (ordinea listei)
}

// Topul reducerilor reale pe vertical, din starea de azi (event_offer_status) a ofertelor
// clasificate „reale”. Re-verificat LIVE: oferta trebuie să fie încă disponibilă, cu link afiliat
// și cu prețul de acum tot ≤ referință × 0,95 (prețul se poate schimba după calcul).
// Cardurile primesc mediana mobilă proprie (offer_price_stats), ca insigna lor să rămână adevărată.
export const getEventTopDeals = unstable_cache(
  async (slug: string, day: string, perRoot = 4): Promise<EventDeal[]> => {
    const { rows } = await pool.query<EventDeal>(`
      WITH cand AS (
        SELECT DISTINCT ON (p.id)
          p.id::text, p.name, p.slug, p.category, p.brand, p.image_url,
          o.id::text AS offer_id,
          o.current_price::float AS current_price,
          o.affiliate_url, o.in_stock,
          r.name AS retailer_name, r.slug AS retailer_slug,
          st.median_30d::float AS median_price,
          st.min_30d::float AS min_30d, st.max_30d::float AS max_30d,
          COALESCE(c.parent_id, c.id) AS root_id,
          ROUND(((1 - o.current_price / s.reference_median) * 100)::numeric, 1)::float AS event_discount_pct
        FROM event_offer_status s
        JOIN offers o ON o.id = s.offer_id
        JOIN retailers r ON r.id = o.retailer_id
        JOIN products p ON p.id = o.product_id
        JOIN categories c ON c.id = p.category_id
        LEFT JOIN offer_price_stats st ON st.offer_id = o.id AND st.points_30d >= 2
        WHERE s.event_slug = $1 AND s.day = $2::date AND s.is_real
          AND o.current_price IS NOT NULL
          AND o.affiliate_url IS NOT NULL
          AND ${OFFER_AVAILABLE_SQL}
          AND o.current_price <= s.reference_median * 0.95
        ORDER BY p.id, o.current_price ASC
      ),
      ranked AS (
        SELECT cand.*, ROW_NUMBER() OVER (PARTITION BY root_id ORDER BY event_discount_pct DESC, id) AS rn
        FROM cand
      )
      SELECT *,
        CASE WHEN median_price IS NOT NULL AND current_price < median_price * 0.95
          THEN ROUND(((1 - current_price / median_price) * 100)::numeric, 1)::float
          ELSE NULL END AS discount_pct
      FROM ranked WHERE rn <= $3
      ORDER BY root_id, rn
    `, [slug, day, perRoot])
    return rows
  },
  ['event-top-deals'],
  { revalidate: 3600, tags: ['event-tracker', 'products'] }
)

// Starea ofertei în evenimentul activ ACUM (pentru rândul „umflat” de pe /p/): o citire pe cheie.
// Fără eveniment activ → null; verificările de prospețime și de preț sunt în inflationFact().
export const getOfferEventStatus = unstable_cache(
  async (offerId: string): Promise<OfferEventStatus | null> => {
    const { rows } = await pool.query<OfferEventStatus>(`
      SELECT e.slug AS event_slug, e.starts_at, e.ends_at, e.freeze_at,
             to_char(s.day, 'YYYY-MM-DD') AS day, s.price::float AS price, s.max_14d::float AS max_14d,
             s.reference_median::float AS reference_median, s.inflated
      FROM price_events e
      JOIN event_offer_status s ON s.event_slug = e.slug AND s.offer_id = $1
      WHERE now() >= e.starts_at AND now() < e.ends_at
      -- doua evenimente suprapuse (rar): conteaza calculul cel mai proaspat
      ORDER BY s.day DESC, e.starts_at DESC
      LIMIT 1
    `, [offerId])
    return rows[0] ?? null
  },
  ['offer-event-status'],
  { revalidate: 3600, tags: ['event-tracker'] }
)

// Evenimentul activ acum (linkul mic spre tracker de pe /p/). Doar cele cu pagină proprie.
export const getActiveEvent = unstable_cache(
  async (): Promise<Pick<PriceEvent, 'slug' | 'name'> | null> => {
    const { rows } = await pool.query<Pick<PriceEvent, 'slug' | 'name'>>(`
      SELECT slug, name FROM price_events
      WHERE now() >= starts_at AND now() < ends_at AND slug = ANY($1::text[])
      ORDER BY starts_at DESC LIMIT 1
    `, [EVENT_PAGES])
    return rows[0] ?? null
  },
  ['active-price-event'],
  { revalidate: 3600, tags: ['event-tracker'] }
)
