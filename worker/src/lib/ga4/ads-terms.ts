import { configFromEnv, searchAll } from '../../ads/google-ads.js'

// Termenii cautati care au declansat reclamele (Google Ads → search_term_view), cu cost.
// DOAR citire GAQL (permisa si in ADS_ENV=test, REGULI.md regula 4) — nu trimite nimic la Google.

export interface AdsTermRow {
  day: string; campaign: string; ad_group: string; search_term: string; status: string
  impressions: number; clicks: number; cost_micros: number; conversions: number
}

// null = Google Ads neconfigurat in .env → sarim peste (avertisment, nu eroare)
export function adsConfigOrNull() {
  try { return configFromEnv() } catch { return null }
}

export async function fetchAdsSearchTerms(start: string, end: string): Promise<AdsTermRow[] | null> {
  const cfg = adsConfigOrNull()
  if (!cfg) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) throw new Error('Interval de date invalid')
  const rows = await searchAll<any>(cfg, `
    SELECT segments.date, campaign.name, ad_group.name, search_term_view.search_term, search_term_view.status,
           metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions
    FROM search_term_view
    WHERE segments.date BETWEEN '${start}' AND '${end}'`)
  return rows.map(mapAdsTerm)
}

// Un rand GAQL (camelCase, numerele mari ca text) → randul din tabel
export function mapAdsTerm(r: any): AdsTermRow {
  return {
    day: r.segments.date,
    campaign: r.campaign?.name ?? '',
    ad_group: r.adGroup?.name ?? '',
    search_term: r.searchTermView?.searchTerm ?? '',
    // ADDED / EXCLUDED / ADDED_EXCLUDED / NONE — daca termenul e deja cuvant cheie sau negativ
    status: r.searchTermView?.status ?? 'NONE',
    impressions: Number(r.metrics?.impressions ?? 0),
    clicks: Number(r.metrics?.clicks ?? 0),
    cost_micros: Number(r.metrics?.costMicros ?? 0),
    conversions: Number(r.metrics?.conversions ?? 0),
  }
}
