import type { ReportResponse } from './client.js'

// Transformarile pure (fara retea / DB) dintre raspunsurile GA4 si randurile din tabele —
// separate ca sa poata fi testate (transform.test.ts).

export const AFFILIATE_EVENT = 'click_affiliate_link'
export const TOP_PER_DAY = 50

// Filtrul GA4 care pastreaza doar evenimentele de click spre magazin
export const affiliateFilter = {
  filter: { fieldName: 'eventName', stringFilter: { matchType: 'EXACT', value: AFFILIATE_EVENT } },
}

export type BreakdownKind = 'source' | 'landing' | 'page' | 'device' | 'retailer' | 'product' | 'category'

// Pentru fiecare defalcare: dimensiunea GA4, metricile de trafic (sau niciuna — doar clickuri)
// si metrica dupa care alegem top 50 pe zi.
export interface KindSpec {
  kind: BreakdownKind
  dimension: string
  trafficMetrics: ('sessions' | 'totalUsers' | 'screenPageViews')[]
  rankBy: 'sessions' | 'page_views' | 'affiliate_clicks'
}

export const KINDS: KindSpec[] = [
  { kind: 'source', dimension: 'sessionSourceMedium', trafficMetrics: ['sessions', 'totalUsers'], rankBy: 'sessions' },
  { kind: 'landing', dimension: 'landingPage', trafficMetrics: ['sessions', 'totalUsers'], rankBy: 'sessions' },
  { kind: 'page', dimension: 'pagePath', trafficMetrics: ['screenPageViews', 'totalUsers'], rankBy: 'page_views' },
  { kind: 'device', dimension: 'deviceCategory', trafficMetrics: ['sessions', 'totalUsers'], rankBy: 'sessions' },
  // Parametrii evenimentului click_affiliate_link — apar in API doar daca proprietarul i-a
  // inregistrat in GA4 ca dimensiuni personalizate (Admin → Definitii personalizate, vezi
  // docs/ads-program/ghid-setari-ga4.md, Pasul 2). Produsul e dupa product_id (numele lung nu e
  // inregistrat) — adminul afiseaza denumirea din tabela products.
  { kind: 'retailer', dimension: 'customEvent:merchant_name', trafficMetrics: [], rankBy: 'affiliate_clicks' },
  { kind: 'product', dimension: 'customEvent:product_id', trafficMetrics: [], rankBy: 'affiliate_clicks' },
  { kind: 'category', dimension: 'customEvent:category', trafficMetrics: [], rankBy: 'affiliate_clicks' },
]

export const DAILY_METRICS = ['totalUsers', 'newUsers', 'sessions', 'engagedSessions', 'screenPageViews', 'userEngagementDuration'] as const

// GA4 da data ca „20260927” → „2026-09-27”
export function gaDate(v: string): string {
  if (!/^\d{8}$/.test(v)) throw new Error(`Dată GA4 neașteptată: ${v}`)
  return `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`
}

// Randurile unui raport → { dimensiuni, metrici dupa nume }. Metricile vin ca text din API.
export function readRows(resp: ReportResponse): { dims: string[]; m: Record<string, number> }[] {
  const names = (resp.metricHeaders ?? []).map((h) => h.name)
  return (resp.rows ?? []).map((r) => ({
    dims: r.dimensionValues.map((d) => d.value),
    m: Object.fromEntries(names.map((n, i) => [n, Number(r.metricValues[i]?.value ?? 0) || 0])),
  }))
}

export interface DailyRow {
  day: string; users: number; new_users: number; sessions: number; engaged_sessions: number
  page_views: number; avg_engagement_seconds: number; affiliate_clicks: number
}

// Raportul pe zile (trafic) + raportul pe zile cu clickuri afiliate → cate un rand pe zi
export function buildDaily(traffic: ReportResponse, affiliate: ReportResponse): DailyRow[] {
  const clicks = new Map(readRows(affiliate).map((r) => [gaDate(r.dims[0]), r.m.eventCount ?? 0]))
  const rows = readRows(traffic).map(({ dims, m }): DailyRow => {
    const day = gaDate(dims[0])
    const users = Math.round(m.totalUsers ?? 0)
    return {
      day,
      users,
      new_users: Math.round(m.newUsers ?? 0),
      sessions: Math.round(m.sessions ?? 0),
      engaged_sessions: Math.round(m.engagedSessions ?? 0),
      page_views: Math.round(m.screenPageViews ?? 0),
      // timpul total de implicare / utilizatori = cat sta in medie un vizitator activ pe site
      avg_engagement_seconds: users > 0 ? Math.round(((m.userEngagementDuration ?? 0) / users) * 100) / 100 : 0,
      affiliate_clicks: Math.round(clicks.get(day) ?? 0),
    }
  })
  // Zile cu clickuri dar fara rand de trafic (improbabil, dar sa nu pierdem clickurile)
  const seen = new Set(rows.map((r) => r.day))
  for (const [day, n] of clicks) {
    if (!seen.has(day)) rows.push({ day, users: 0, new_users: 0, sessions: 0, engaged_sessions: 0, page_views: 0, avg_engagement_seconds: 0, affiliate_clicks: Math.round(n) })
  }
  return rows.sort((a, b) => a.day.localeCompare(b.day))
}

export interface BreakdownRow {
  day: string; kind: BreakdownKind; key: string
  sessions: number; users: number; page_views: number; affiliate_clicks: number
}

// Raportul de trafic (zi × dimensiune) + raportul de clickuri (zi × dimensiune) → randuri
// combinate, apoi DOAR top `top` pe zi dupa metrica de clasament a tipului.
export function buildBreakdown(spec: KindSpec, traffic: ReportResponse | null, affiliate: ReportResponse, top = TOP_PER_DAY): BreakdownRow[] {
  const byKey = new Map<string, BreakdownRow>()
  const get = (day: string, key: string) => {
    const k = `${day}\u0000${key}`
    let row = byKey.get(k)
    if (!row) byKey.set(k, row = { day, kind: spec.kind, key, sessions: 0, users: 0, page_views: 0, affiliate_clicks: 0 })
    return row
  }
  for (const { dims, m } of traffic ? readRows(traffic) : []) {
    const row = get(gaDate(dims[0]), dims[1] || '(not set)')
    row.sessions += Math.round(m.sessions ?? 0)
    row.users += Math.round(m.totalUsers ?? 0)
    row.page_views += Math.round(m.screenPageViews ?? 0)
  }
  for (const { dims, m } of readRows(affiliate)) {
    get(gaDate(dims[0]), dims[1] || '(not set)').affiliate_clicks += Math.round(m.eventCount ?? 0)
  }
  return topPerDay([...byKey.values()], spec.rankBy, top)
}

export function topPerDay(rows: BreakdownRow[], rankBy: KindSpec['rankBy'], top: number): BreakdownRow[] {
  const days = new Map<string, BreakdownRow[]>()
  for (const r of rows) {
    const list = days.get(r.day) ?? []
    list.push(r)
    days.set(r.day, list)
  }
  const out: BreakdownRow[] = []
  for (const list of days.values()) {
    // la egalitate: clickurile afiliate, apoi cheia (ordine stabila intre rulari)
    list.sort((a, b) => b[rankBy] - a[rankBy] || b.affiliate_clicks - a.affiliate_clicks || a.key.localeCompare(b.key))
    out.push(...list.slice(0, top))
  }
  return out
}

// Datele „YYYY-MM-DD” ale intervalului, in fusul orar al site-ului (Romania). Trimitem GA4
// date explicite (nu „3daysAgo”) ca sa stim exact ce zile rescriem in DB.
export function dayRange(daysBack: number, now = new Date(), timeZone = 'Europe/Bucharest'): { start: string; end: string } {
  const fmt = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
  const today = fmt(now)
  const shift = (iso: string, n: number) => {
    const d = new Date(`${iso}T12:00:00Z`)
    d.setUTCDate(d.getUTCDate() + n)
    return d.toISOString().slice(0, 10)
  }
  // pana ieri inclusiv: ziua de azi e incompleta
  return { start: shift(today, -daysBack), end: shift(today, -1) }
}
