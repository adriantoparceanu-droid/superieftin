import pool from '../db'

// Query-urile paginii /admin/statistici (si ale cardului mic din dashboard).
//
// De ce citim DOAR din Postgres: workerul (job `ga4-sync`, worker/src/lib/ga4/sync.ts) trage zilnic
// rapoartele din GA4 si le salveaza in ga4_daily / ga4_daily_breakdown (migratia 025). Pagina ramane
// rapida si merge si cand Google e jos. Clickurile reale vin din click_events (complete, fara
// consimtamant), pe aceleasi zile.
//
// Perioada = ultimele N zile INCHEIATE (pana ieri inclusiv), in ora Romaniei: ziua de azi nu e
// completa in GA4 (si oricum e adusa abia maine dimineata). Perioada anterioara = cele N zile de
// dinainte, ca sa comparam „mere cu mere”.

export const PERIODS = [7, 30, 90] as const
export type PeriodDays = (typeof PERIODS)[number]

// ?zile=… din URL → una din valorile permise (orice altceva = 30, implicit)
export function parsePeriod(v: string | string[] | undefined): PeriodDays {
  const n = Number(Array.isArray(v) ? v[0] : v)
  return (PERIODS as readonly number[]).includes(n) ? (n as PeriodDays) : 30
}

// Fragment SQL comun: ieri, in ora Romaniei. `now()` e UTC in container → convertim explicit,
// altfel intre 00:00 si 03:00 ora Romaniei „ieri” ar fi alaltaieri.
const YESTERDAY_SQL = `((now() AT TIME ZONE 'Europe/Bucharest')::date - 1)`

// ---------- Starea sincronizarii ----------

export interface Ga4SyncState {
  last_success_at: Date | null
  last_error: string | null
  last_error_at: Date | null
  consecutive_failures: number
  warnings: string[]
}

export async function getGa4SyncState(): Promise<Ga4SyncState | null> {
  const { rows } = await pool.query<Ga4SyncState>(
    `SELECT last_success_at, last_error, last_error_at, consecutive_failures, warnings
     FROM ga4_sync_state WHERE id = 1`
  )
  return rows[0] ?? null
}

// „Neconfigurat” = nicio zi salvata si nicio rulare reusita. Atunci pagina arata pasii de
// configurare in loc de carduri goale.
export async function hasGa4Data(): Promise<boolean> {
  const { rows } = await pool.query<{ has: boolean }>(`SELECT EXISTS (SELECT 1 FROM ga4_daily) AS has`)
  return rows[0].has
}

// ---------- Totaluri pe perioada (carduri) ----------

export interface Ga4Totals {
  days_with_data: number   // cate zile din perioada au rand in ga4_daily (0 = fara date → „—”)
  users: number            // SUMA utilizatorilor zilnici (GA4 nu deduplica intre zile)
  new_users: number
  sessions: number
  page_views: number
  affiliate_clicks: number // evenimente click_affiliate_link (doar vizitatori cu acord de analiza)
  db_clicks: number        // clickuri reale din click_events (toti vizitatorii)
}

export interface Ga4Overview {
  start: string   // prima zi a perioadei curente (YYYY-MM-DD)
  end: string     // ultima zi (ieri)
  current: Ga4Totals
  previous: Ga4Totals
}

// O singura interogare pentru ambele perioade: `p` = 0 (curenta) sau 1 (anterioara).
export async function getGa4Overview(days: number): Promise<Ga4Overview> {
  const { rows } = await pool.query<Ga4Totals & { p: number; start: string; end: string }>(`
    WITH periods AS (
      SELECT p,
             (${YESTERDAY_SQL} - ($1::int * (p + 1)) + 1) AS start_day,
             (${YESTERDAY_SQL} - ($1::int * p))           AS end_day
      FROM (VALUES (0), (1)) AS v(p)
    )
    SELECT pr.p, pr.start_day::text AS start, pr.end_day::text AS end,
      (SELECT count(*) FROM ga4_daily d WHERE d.day BETWEEN pr.start_day AND pr.end_day)::int AS days_with_data,
      (SELECT COALESCE(SUM(users), 0) FROM ga4_daily d WHERE d.day BETWEEN pr.start_day AND pr.end_day)::int AS users,
      (SELECT COALESCE(SUM(new_users), 0) FROM ga4_daily d WHERE d.day BETWEEN pr.start_day AND pr.end_day)::int AS new_users,
      (SELECT COALESCE(SUM(sessions), 0) FROM ga4_daily d WHERE d.day BETWEEN pr.start_day AND pr.end_day)::int AS sessions,
      (SELECT COALESCE(SUM(page_views), 0) FROM ga4_daily d WHERE d.day BETWEEN pr.start_day AND pr.end_day)::int AS page_views,
      (SELECT COALESCE(SUM(affiliate_clicks), 0) FROM ga4_daily d WHERE d.day BETWEEN pr.start_day AND pr.end_day)::int AS affiliate_clicks,
      -- intervalul exact al zilelor in ora Romaniei (comparam momente, nu convertim fiecare rand)
      (SELECT count(*) FROM click_events ce
        WHERE ce.clicked_at >= (pr.start_day::timestamp AT TIME ZONE 'Europe/Bucharest')
          AND ce.clicked_at <  ((pr.end_day + 1)::timestamp AT TIME ZONE 'Europe/Bucharest'))::int AS db_clicks
    FROM periods pr
    ORDER BY pr.p
  `, [days])
  const [cur, prev] = rows
  // doar cifrele (fara coloanele ajutatoare p/start/end)
  const strip = (r: (typeof rows)[number]): Ga4Totals => ({
    days_with_data: r.days_with_data, users: r.users, new_users: r.new_users, sessions: r.sessions,
    page_views: r.page_views, affiliate_clicks: r.affiliate_clicks, db_clicks: r.db_clicks,
  })
  return { start: cur.start, end: cur.end, current: strip(cur), previous: strip(prev) }
}

// ---------- Seria pe zile (grafic) ----------

export interface Ga4DayPoint {
  day: string            // YYYY-MM-DD
  sessions: number | null        // null = zi fara date GA4 (nu 0 — sa nu para o prabusire)
  affiliate_clicks: number | null
}

export async function getGa4Series(days: number): Promise<Ga4DayPoint[]> {
  const { rows } = await pool.query<Ga4DayPoint>(`
    SELECT g.day::date::text AS day, d.sessions, d.affiliate_clicks
    FROM generate_series(${YESTERDAY_SQL} - $1::int + 1, ${YESTERDAY_SQL}, interval '1 day') AS g(day)
    LEFT JOIN ga4_daily d ON d.day = g.day::date
    ORDER BY g.day
  `, [days])
  return rows
}

// ---------- Defalcari (tabele top 10 + „restul”) ----------

export type BreakdownKind = 'source' | 'landing' | 'page' | 'device' | 'retailer' | 'product' | 'category'

// Dupa ce metrica ordonam fiecare tabel (aceeasi ca in worker, transform.ts → KINDS.rankBy).
// Lista alba: numele coloanei ajunge in SQL, deci NU vine niciodata din input.
const RANK_BY: Record<BreakdownKind, 'sessions' | 'page_views' | 'affiliate_clicks'> = {
  source: 'sessions',
  landing: 'sessions',
  page: 'page_views',
  device: 'sessions',
  retailer: 'affiliate_clicks',
  product: 'affiliate_clicks',
  category: 'affiliate_clicks',
}

export interface BreakdownRow {
  key: string | null     // null = randul „restul”
  rest_count: number     // pe randul „restul”: cate chei contine
  sessions: number
  users: number
  page_views: number
  affiliate_clicks: number
}

export interface Breakdown {
  rows: BreakdownRow[]   // top N, apoi (optional) randul „restul” cu key = null
  total: BreakdownRow    // suma tuturor randurilor (pentru procente)
}

// Suma pe perioada pentru un tip de defalcare. Atentie: „restul” = restul din ce am SALVAT
// (workerul pastreaza doar top 50 pe zi), nu tot traficul din GA4.
export async function getGa4Breakdown(kind: BreakdownKind, days: number, limit = 10): Promise<Breakdown> {
  const rank = RANK_BY[kind]
  const { rows } = await pool.query<BreakdownRow & { rn: number }>(`
    WITH agg AS (
      SELECT key,
             SUM(sessions)::int AS sessions, SUM(users)::int AS users,
             SUM(page_views)::int AS page_views, SUM(affiliate_clicks)::int AS affiliate_clicks
      FROM ga4_daily_breakdown
      WHERE kind = $1 AND day BETWEEN ${YESTERDAY_SQL} - $2::int + 1 AND ${YESTERDAY_SQL}
      GROUP BY key
    ), ranked AS (
      SELECT agg.*, row_number() OVER (ORDER BY ${rank} DESC, key) AS rn FROM agg
    )
    -- primele $3 chei raman separate; toate celelalte se strang intr-un singur rand (key NULL)
    SELECT CASE WHEN rn <= $3 THEN key END AS key,
           MIN(rn)::int AS rn,
           count(*)::int AS rest_count,
           SUM(sessions)::int AS sessions, SUM(users)::int AS users,
           SUM(page_views)::int AS page_views, SUM(affiliate_clicks)::int AS affiliate_clicks
    FROM ranked
    GROUP BY 1
    ORDER BY MIN(rn)
  `, [kind, days, limit])

  // rn a servit doar la ordonare; rest_count are sens doar pe randul „restul”
  const clean: BreakdownRow[] = rows.map((r) => ({
    key: r.key, rest_count: r.key === null ? r.rest_count : 0,
    sessions: r.sessions, users: r.users, page_views: r.page_views, affiliate_clicks: r.affiliate_clicks,
  }))
  const total = clean.reduce<BreakdownRow>(
    (t, r) => ({
      key: null, rest_count: 0,
      sessions: t.sessions + r.sessions, users: t.users + r.users,
      page_views: t.page_views + r.page_views, affiliate_clicks: t.affiliate_clicks + r.affiliate_clicks,
    }),
    { key: null, rest_count: 0, sessions: 0, users: 0, page_views: 0, affiliate_clicks: 0 }
  )
  return { rows: clean, total }
}

// ---------- Produse: cheia din GA4 e product_id-ul intern → denumirea din `products` ----------

export interface ProductLabel { name: string; slug: string }

export async function getProductLabels(keys: (string | null)[]): Promise<Map<string, ProductLabel>> {
  // Doar chei numerice (un „(not set)” sau o valoare ciudata nu ajunge in cast-ul ::bigint)
  const ids = keys.filter((k): k is string => !!k && /^\d{1,18}$/.test(k))
  if (!ids.length) return new Map()
  const { rows } = await pool.query<{ id: string; name: string; slug: string }>(
    `SELECT id::text, name, slug FROM products WHERE id = ANY($1::bigint[])`,
    [ids]
  )
  return new Map(rows.map((r) => [r.id, { name: r.name, slug: r.slug }]))
}

// ---------- Categorii: cheia e slug-ul categoriei din eveniment → numele din `categories` ----------

export async function getCategoryLabels(keys: (string | null)[]): Promise<Map<string, string>> {
  const slugs = keys.filter((k): k is string => !!k)
  if (!slugs.length) return new Map()
  const { rows } = await pool.query<{ slug: string; name: string }>(
    `SELECT slug, name FROM categories WHERE slug = ANY($1::text[])`,
    [slugs]
  )
  return new Map(rows.map((r) => [r.slug, r.name]))
}

// ---------- Magazine: clickuri GA4 (merchant_name) vs. clickuri reale din DB ----------

// Comparam numele fara diacritice, majuscule, spatii sau puncte („CITGrup.ro” = „citgrup.ro”).
// GA4 primeste exact retailers.name (AffiliateLink → merchant_name), deci de obicei se potrivesc 1:1.
export function normalizeName(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

export interface RetailerClicksRow {
  name: string
  ga4: number | null   // null = magazinul nu apare in GA4 (sau dimensiunea lipseste)
  db: number | null    // null = numele din GA4 nu se potriveste cu niciun magazin din DB
}

// Clickurile reale pe magazin in perioada curenta — TOTI magazinii (si cei cu 0 clickuri), ca un
// nume din GA4 care nu se potriveste sa insemne chiar „magazin necunoscut”, nu „fara clickuri”.
// Nota: click_events se sterge in cascada cu oferta, deci clickurile spre oferte sterse intre timp
// nu mai apar aici.
async function getDbClicksByRetailer(days: number): Promise<{ name: string; clicks: number }[]> {
  const { rows } = await pool.query<{ name: string; clicks: number }>(`
    SELECT r.name, COALESCE(c.clicks, 0)::int AS clicks
    FROM retailers r
    LEFT JOIN (
      SELECT o.retailer_id, count(*) AS clicks
      FROM click_events ce
      JOIN offers o ON o.id = ce.offer_id
      WHERE ce.clicked_at >= ((${YESTERDAY_SQL} - $1::int + 1)::timestamp AT TIME ZONE 'Europe/Bucharest')
        AND ce.clicked_at <  ((${YESTERDAY_SQL} + 1)::timestamp AT TIME ZONE 'Europe/Bucharest')
      GROUP BY o.retailer_id
    ) c ON c.retailer_id = r.id
  `, [days])
  return rows
}

export async function getRetailerClicks(days: number): Promise<RetailerClicksRow[]> {
  // Magazinele sunt putine (sub 50) → le luam pe toate din GA4 si le unim in JS.
  const [ga4, db] = await Promise.all([getGa4Breakdown('retailer', days, 1000), getDbClicksByRetailer(days)])
  const merged = new Map<string, RetailerClicksRow>()
  for (const r of db) merged.set(normalizeName(r.name), { name: r.name, ga4: null, db: r.clicks })
  for (const r of ga4.rows) {
    if (r.key === null) continue
    const k = normalizeName(r.key)
    const row = merged.get(k)
    if (row) row.ga4 = (row.ga4 ?? 0) + r.affiliate_clicks
    else merged.set(k, { name: r.key, ga4: r.affiliate_clicks, db: null })
  }
  // Ascundem magazinele fara niciun click (nici GA4, nici DB) — doar zgomot in tabel.
  // Ordonam dupa cel mai mare dintre cele doua numere (DB e de obicei cel complet).
  return [...merged.values()].filter((r) => (r.ga4 ?? 0) > 0 || (r.db ?? 0) > 0).sort((a, b) => Math.max(b.db ?? 0, b.ga4 ?? 0) - Math.max(a.db ?? 0, a.ga4 ?? 0))
}

// ---------- Cardul mic din dashboard ----------

export interface Ga4DashboardSummary { users: number; affiliate_clicks: number; days_with_data: number }

export async function getGa4DashboardSummary(): Promise<Ga4DashboardSummary> {
  const { rows } = await pool.query<Ga4DashboardSummary>(`
    SELECT COALESCE(SUM(users), 0)::int AS users,
           COALESCE(SUM(affiliate_clicks), 0)::int AS affiliate_clicks,
           count(*)::int AS days_with_data
    FROM ga4_daily
    WHERE day BETWEEN ${YESTERDAY_SQL} - 6 AND ${YESTERDAY_SQL}
  `)
  return rows[0]
}
