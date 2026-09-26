// Campanii ca si cod: structura fisierelor ads/campaigns/*.yaml si citirea lor.
//
// De ce YAML: proprietarul (si policy-reviewer) citesc campania ca pe un document, iar
// ads:plan / ads:apply o compara cu contul Google Ads. Parserul e pachetul `yaml` (fara
// dependente) pentru ca pastreaza comentariile cand ads:apply scrie inapoi ID-urile.

import { readFileSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse, parseDocument } from 'yaml'

// Radacina repo-ului (worker/src/ads/campaigns → ../../../..)
export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
export const CAMPAIGNS_DIR = path.join(REPO_ROOT, 'ads/campaigns')
export const GUARDRAILS_FILE = path.join(REPO_ROOT, 'ads/config/guardrails.yaml')
export const REVIEW_DIR = path.join(CAMPAIGNS_DIR, '.review')

export type MatchType = 'EXACT' | 'PHRASE' | 'BROAD'

export interface Keyword { text: string; matchType: MatchType }

export interface RsaAd {
  type: 'RSA'
  id: string | null
  final_url?: string            // implicit: final_url al grupului
  headlines: string[]
  descriptions: string[]
  path1?: string
  path2?: string
}

export interface AdGroup {
  name: string
  id: string | null
  final_url: string
  max_cpc?: number              // implicit: campaign.bidding.max_cpc
  keywords: { exact?: string[]; phrase?: string[]; broad?: string[] }
  negative_keywords?: string[]
  ads: RsaAd[]
}

export interface Sitelink { text: string; url: string; description1?: string; description2?: string }
export interface StructuredSnippet { header: string; values: string[] }

export interface Campaign {
  name: string
  id: string | null
  budget_id?: string | null
  status: string
  daily_budget: number
  bidding: { strategy: string; max_cpc: number }
  exact_only?: boolean          // true = refuza orice cuvant cheie care nu e exact
  conversion_goal?: { name: string; conversion_action_id: string }
  targeting?: {
    countries?: string[]
    languages?: string[]
    location_mode?: string      // PRESENCE = doar persoane aflate in tara
    networks?: { search?: boolean; search_partners?: boolean; display?: boolean }
  }
  source_research?: string
  negative_keywords?: string[]
  ad_groups: AdGroup[]
  extensions?: {
    sitelinks?: Sitelink[]
    callouts?: string[]
    structured_snippets?: StructuredSnippet[]
  }
}

export interface CampaignFile {
  file: string                  // cale absoluta
  rel: string                   // cale relativa la repo (pentru afisare)
  slug: string                  // numele fisierului fara .yaml (= numele fisierului .pass)
  raw: string
  campaign: Campaign
}

export interface Guardrails {
  currency: string
  budget: { max_daily_per_campaign: number; max_daily_total: number; max_monthly_total: number }
  bidding: { max_cpc: number; allowed_strategies: string[] }
  targeting: { countries: string[]; languages: string[]; networks: { search: boolean; search_partners: boolean; display: boolean } }
  excluded_categories: string[]
  safety: { new_entities_status: string; require_policy_pass: boolean; default_env: string }
}

export function loadGuardrails(file = GUARDRAILS_FILE): Guardrails {
  return parse(readFileSync(file, 'utf8')) as Guardrails
}

// Fisierele care incep cu „_” (ex. _template.yaml) NU sunt campanii.
export function listCampaignFiles(dir = CAMPAIGNS_DIR): string[] {
  return readdirSync(dir)
    .filter((f) => /\.ya?ml$/.test(f) && !f.startsWith('_') && !f.startsWith('.'))
    .sort()
    .map((f) => path.join(dir, f))
}

export function loadCampaignFile(file: string): CampaignFile {
  const raw = readFileSync(file, 'utf8')
  const doc = parse(raw) as { campaign?: Campaign }
  if (!doc?.campaign) throw new Error(`${file}: lipsește cheia „campaign:”`)
  return {
    file,
    rel: path.relative(REPO_ROOT, file),
    slug: path.basename(file).replace(/\.ya?ml$/, ''),
    raw,
    campaign: doc.campaign,
  }
}

export function loadAllCampaigns(dir = CAMPAIGNS_DIR): CampaignFile[] {
  return listCampaignFiles(dir).map(loadCampaignFile)
}

// --- Cuvinte cheie ------------------------------------------------------------------------------

// Normalizare pentru comparatii: litere mici, spatii simple. Diacriticele raman (Google le
// trateaza ca variante apropiate, dar in cont textul se pastreaza asa cum l-am trimis).
export function normKw(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function positiveKeywords(g: AdGroup): Keyword[] {
  const out: Keyword[] = []
  for (const t of g.keywords?.exact ?? []) out.push({ text: normKw(t), matchType: 'EXACT' })
  for (const t of g.keywords?.phrase ?? []) out.push({ text: normKw(t), matchType: 'PHRASE' })
  for (const t of g.keywords?.broad ?? []) out.push({ text: normKw(t), matchType: 'BROAD' })
  return out
}

// Negativele se scriu ca in Google Ads: [text] = exact, "text" = phrase, text = broad.
// (Un negativ „broad” blocheaza orice cautare care contine TOATE cuvintele lui, in orice ordine.)
export function parseNegative(s: string): Keyword {
  const t = String(s).trim()
  if (t.startsWith('[') && t.endsWith(']')) return { text: normKw(t.slice(1, -1)), matchType: 'EXACT' }
  if (t.startsWith('"') && t.endsWith('"')) return { text: normKw(t.slice(1, -1)), matchType: 'PHRASE' }
  return { text: normKw(t), matchType: 'BROAD' }
}

export function kwKey(k: Keyword): string {
  return `${k.matchType}:${k.text}`
}

export function formatKw(k: Keyword): string {
  return k.matchType === 'EXACT' ? `[${k.text}]` : k.matchType === 'PHRASE' ? `"${k.text}"` : k.text
}

// --- Hash pentru verdictul policy-reviewer --------------------------------------------------------

// Hash-ul CONTINUTULUI campaniei, fara campurile `id` / `budget_id`. Motiv: dupa creare
// ads:apply scrie ID-urile in YAML; asta nu schimba nimic din ce a verificat policy-reviewer,
// deci nu trebuie sa invalideze PASS-ul. Orice alta modificare (text, URL, buget, cuvinte) il
// invalideaza. Comentariile si formatarea nu conteaza (se hash-uieste structura parsata).
export function contentHash(raw: string): string {
  const data = parse(raw)
  const strip = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(strip)
    if (v && typeof v === 'object') {
      const o: Record<string, unknown> = {}
      for (const k of Object.keys(v as object).sort()) {
        if (k === 'id' || k === 'budget_id') continue
        o[k] = strip((v as Record<string, unknown>)[k])
      }
      return o
    }
    return v
  }
  return createHash('sha256').update(JSON.stringify(strip(data))).digest('hex')
}

// --- Scriere ID-uri inapoi in YAML (dupa creare reala) ----------------------------------------------

export type IdPath = (string | number)[]

// Pastreaza comentariile si ordinea cheilor (Document API din `yaml`).
export function writeIds(raw: string, ids: { path: IdPath; value: string }[]): string {
  const doc = parseDocument(raw)
  for (const { path: p, value } of ids) doc.setIn(p, value)
  return doc.toString({ lineWidth: 0 })
}
