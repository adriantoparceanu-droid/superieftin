import { accessToken, Ga4Error, type Ga4Config } from './client.js'

// Cuvintele cheie ORGANICE din Google Search Console (Search Analytics API, doar citire).
// GA4 nu le expune prin API (legatura GA4 ↔ Search Console e doar in interfata GA4), de aceea
// le citim direct, cu acelasi cont de serviciu ca GA4.
//
// Configurare (o data): Cloud → activeaza „Google Search Console API”; Search Console →
// Setari → Utilizatori si permisiuni → adauga emailul contului de serviciu cu „Restricționat”.
// Proprietatea se alege singura dintre cele la care contul are acces (sau GSC_SITE_URL din .env).

const API = 'https://www.googleapis.com/webmasters/v3'
// Search Console intoarce max. 25.000 de randuri pe cerere; paginam cu startRow
const PAGE = 25000
export const GSC_TOP_PER_DAY = 500

export interface GscRow { day: string; query: string; page: string; clicks: number; impressions: number; position: number }

async function gscFetch<T>(cfg: Ga4Config, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${await accessToken(cfg)}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(60000),
  })
  const data = await res.json().catch(() => ({})) as T & { error?: { message?: string; status?: string } }
  if (!res.ok) throw new Ga4Error(`Search Console ${res.status} ${data.error?.status ?? ''}: ${data.error?.message ?? ''}`.trim(), res.status)
  return data
}

// Proprietatile Search Console la care contul are acces (ex. „sc-domain:superieftin.ro”)
export async function listSites(cfg: Ga4Config): Promise<{ siteUrl: string; permissionLevel: string }[]> {
  const data = await gscFetch<{ siteEntry?: { siteUrl: string; permissionLevel: string }[] }>(cfg, '/sites')
  return (data.siteEntry ?? []).filter((s) => s.permissionLevel !== 'siteUnverifiedUser')
}

// Alegem proprietatea: GSC_SITE_URL daca e setat, altfel cea de domeniu (acopera www + fara www,
// http + https), apoi prefixul https://www. Nicio potrivire → null.
export function pickSite(sites: string[], preferred?: string): string | null {
  if (preferred) return sites.includes(preferred) ? preferred : null
  return sites.find((s) => s === 'sc-domain:superieftin.ro')
    ?? sites.find((s) => /^https:\/\/www\.superieftin\.ro\/?$/.test(s))
    ?? sites.find((s) => s.includes('superieftin.ro'))
    ?? null
}

// Toate randurile zi × cautare × pagina din interval (cu paginare)
export async function fetchSearchAnalytics(cfg: Ga4Config, siteUrl: string, start: string, end: string): Promise<GscRow[]> {
  const out: GscRow[] = []
  for (let startRow = 0; ; startRow += PAGE) {
    const data = await gscFetch<{ rows?: { keys: string[]; clicks: number; impressions: number; position: number }[] }>(
      cfg, `/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
      { startDate: start, endDate: end, dimensions: ['date', 'query', 'page'], type: 'web', rowLimit: PAGE, startRow },
    )
    const rows = data.rows ?? []
    for (const r of rows) {
      out.push({ day: r.keys[0], query: r.keys[1], page: r.keys[2], clicks: r.clicks, impressions: r.impressions, position: r.position })
    }
    if (rows.length < PAGE) break
  }
  return out
}

// Top N pe zi dupa clickuri, apoi afisari (cautarile care aduc vizite conteaza cel mai mult;
// la un site mic, restul sunt afisari rare, fara click).
export function topGscPerDay(rows: GscRow[], top = GSC_TOP_PER_DAY): GscRow[] {
  const days = new Map<string, GscRow[]>()
  for (const r of rows) days.set(r.day, [...(days.get(r.day) ?? []), r])
  const out: GscRow[] = []
  for (const list of days.values()) {
    list.sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions || a.query.localeCompare(b.query) || a.page.localeCompare(b.page))
    out.push(...list.slice(0, top))
  }
  return out
}
