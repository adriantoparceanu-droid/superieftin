// „Alege categoriile” pentru feed-urile 2Performant (Admin → Surse feed, migratia 028).
// Aici sta logica fara UI: descarcarea in streaming a feed-ului (doar <category>,
// <campaign_name> si <title>), normalizarea categoriilor si sugestia de categorie de site.
//
// ATENTIE — dubluri intentionate cu workerul (web-ul si workerul nu impart cod):
//   normalizeFeedCategory  ↔ worker/src/lib/feed-category-filter.ts (filtrul la import)
//   extractDomain          ↔ worker/src/lib/affiliate/domain.ts (retailerul din campaign_name)
//   toSlug                 ↔ worker/src/lib/slug.ts (slug-ul retailerului, ca upsertRetailerByDomain)
// Modifica-le impreuna, altfel ce bifezi aici n-ar mai corespunde cu ce importa workerul.

import { normalizeName, type NameRuleForMatch } from './nameMatch'

// Comparatie fara diferenta de majuscule si fara spatiile de la capete — exact ca la import
export function normalizeFeedCategory(s: string | null | undefined): string {
  return (s ?? '').trim().toLowerCase()
}

const MULTI_LEVEL_TLDS = new Set([
  'com.ro', 'co.uk', 'org.uk', 'com.tr', 'co.nz', 'com.au', 'co.jp', 'com.br',
])

// 'evomag.ro ' / 'https://www.evomag.ro/x' → 'evomag.ro'
export function extractDomain(input: string): string | null {
  if (!input) return null
  let s = input.trim().toLowerCase()
  s = s.replace(/^[a-z]+:\/\//, '').replace(/^\/\//, '')
  s = s.split('/')[0].split('?')[0].split('@').pop()!.split(':')[0]
  s = s.replace(/^www\./, '').replace(/\.$/, '')
  if (!s || !s.includes('.')) return null
  const parts = s.split('.').filter(Boolean)
  if (parts.length <= 2) return parts.join('.')
  const lastTwo = parts.slice(-2).join('.')
  return MULTI_LEVEL_TLDS.has(lastTwo) ? parts.slice(-3).join('.') : lastTwo
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[șțăî]/g, (c) => ({ ș: 's', ț: 't', ă: 'a', î: 'i' }[c] || c))
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120)
}

// Slug-ul pe care workerul il da magazinului la primul import (upsertRetailerByDomain):
// 'evomag.ro' → 'evomag'. Asa gasim retailerul existent fara sa-l cream noi.
export function retailerSlugForDomain(domain: string): string {
  return toSlug(domain.split('.')[0] || domain)
}

// ---------- Sugestia de categorie de site ----------

// Cuvinte de legatura care nu spun nimic despre tipul produsului
const STOP = new Set(['si', 'de', 'cu', 'pentru', 'la', 'din', 'pe', 'in', 'sau', 'and', 'or', 'the', 'for', 'with'])

function words(s: string): string[] {
  return normalizeName(s).split(/[^a-z0-9]+/).filter((w) => w.length >= 2 && !STOP.has(w))
}

export interface SiteCategory {
  id: number
  name: string
  parentId: number | null
  parentName: string | null
}

// Doua cuvinte „se potrivesc” daca sunt identice sau daca unul e inceputul celuilalt si au
// cel putin 5 litere (pluralul romanesc: „suport” ~ „suporturi”, „laptop” ~ „laptopuri”).
// Pragul de 5 litere tine departe potrivirile false de tip „pc” ~ „pcie”.
function sameWord(a: string, b: string): boolean {
  if (a === b) return true
  return Math.min(a.length, b.length) >= 5 && (a.startsWith(b) || b.startsWith(a))
}

// Cea mai potrivita categorie de site pentru o categorie din feed, dupa cuvinte INTREGI
// comune (fara diacritice): „Huse Telefoane” → „Huse Telefoane”, „Telefoane” → „Telefoane
// Mobile”, „Casti bluetooth, wireless…” → „Căști”, „Suporturi TV” → „Suport TV”.
// In romana substantivul principal e PRIMUL cuvant („Huse telefoane” = huse), deci cerem ca
// primul cuvant din feed sa se regaseasca in categorie SAU sa fie cel putin 2 cuvinte comune;
// altfel nu sugeram nimic („Acumulatori telefoane” nu e „Telefoane mobile” — mai bine nicio
// sugestie decat una gresita). La egalitate: categoria care incepe cu acelasi cuvant, apoi
// subcategoriile (produsele stau in subcategorii), apoi numele mai scurt.
export function suggestSiteCategory(feedCategory: string, categories: SiteCategory[]): SiteCategory | null {
  const feedWords = words(feedCategory)
  if (!feedWords.length) return null
  let best: { cat: SiteCategory; score: number } | null = null
  for (const cat of categories) {
    const catWords = words(cat.name)
    const common = feedWords.filter((fw) => catWords.some((cw) => sameWord(fw, cw))).length
    const headMatch = catWords.some((cw) => sameWord(feedWords[0], cw))
    if (!common || (!headMatch && common < 2)) continue
    const score = common
      + (catWords[0] && sameWord(catWords[0], feedWords[0]) ? 0.5 : 0)
      + (cat.parentId != null ? 0.1 : 0)
      - catWords.length * 0.01
    if (!best || score > best.score) best = { cat, score }
  }
  return best?.cat ?? null
}

// ---------- Descarcarea feed-ului (streaming) ----------

function decodeXmlEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&amp;/g, '&')
}

function tag(block: string, name: string): string {
  const m = block.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))
  return m ? decodeXmlEntities(m[1]).trim() : ''
}

export interface ScannedItem {
  category: string        // <category> asa cum vine (trim); '' daca lipseste
  campaignName: string
  title: string
}

const TIMEOUT_MS = 120_000             // feed-urile mari (zeci de MB) se descarca in ~10–60 s
const MAX_BYTES = 300 * 1024 * 1024    // plasa de siguranta: nu citim la nesfarsit un URL gresit
const MAX_ITEM_CHARS = 5_000_000       // un <item> nu are niciodata 5 MB — altfel XML-ul e stricat

// Citeste feed-ul bucata cu bucata si apeleaza onItem pentru fiecare <item>. In memorie
// sta doar bucata curenta (nu tot XML-ul), ca la parserul din worker (parseTpFeed).
export async function scanTpFeed(url: string, onItem: (item: ScannedItem) => void): Promise<{ bytes: number }> {
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: 'no-store' })
  if (!res.ok || !res.body) throw new Error(`Feed-ul a răspuns cu HTTP ${res.status}`)

  const reader = res.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  let bytes = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (value) {
        bytes += value.byteLength
        if (bytes > MAX_BYTES) throw new Error('Feed-ul depășește 300 MB — oprit')
        buffer += decoder.decode(value, { stream: true })
      }
      if (done) buffer += decoder.decode()

      let start: number
      while ((start = buffer.indexOf('<item>')) !== -1) {
        const end = buffer.indexOf('</item>', start)
        if (end === -1) break
        const block = buffer.slice(start + 6, end)
        buffer = buffer.slice(end + 7)
        onItem({ category: tag(block, 'category'), campaignName: tag(block, 'campaign_name'), title: tag(block, 'title') })
      }
      // Pastram doar ce poate fi inceputul urmatorului <item> (restul s-a procesat deja)
      const pending = buffer.indexOf('<item>')
      buffer = pending === -1 ? buffer.slice(-16) : buffer.slice(pending)
      if (buffer.length > MAX_ITEM_CHARS) buffer = ''
      if (done) break
    }
  } finally {
    reader.releaseLock()
  }
  return { bytes }
}

// ---------- Rezultatul trimis catre pagina de admin ----------

export interface FeedCategoryInfo {
  name: string                    // categoria din feed ('' = produse fara <category>)
  count: number                   // produse in feed acum (0 = e in filtru, dar nu mai apare in feed)
  selected: boolean               // bifata acum (filtrul salvat)
  mapping: { categoryId: number; label: string; scope: 'retailer' | 'global' } | null
  suggestion: { categoryId: number; label: string; parentId: number | null } | null
  ignoredByName: number           // cate produse ar sari regulile „ignoră” dupa denumire
  mappedByName: number            // cate produse ar mapa regulile dupa denumire (cand nu e mapata)
}

export interface FeedScanResult {
  feedId: number
  feedLabel: string | null
  total: number
  bytes: number
  domain: string | null
  retailer: { id: number; name: string } | null    // null = magazin nou (nu e inca in retailers)
  filterMode: 'all' | 'none' | 'list'
  categories: FeedCategoryInfo[]
  // Produsele fara <category>: denumirile lor (plafonate) pentru regulile „dupa denumire”
  uncategorized: { titles: string[]; total: number; capped: boolean } | null
  // Regulile „dupa denumire” ale magazinului + cele globale, in ordinea aplicarii la import
  nameRules: NameRuleForMatch[]
}
