import axios from 'axios'
import pino from 'pino'
import pool from '../lib/db.js'

// Catalogul categoriilor disponibile pe eMAG, din sitemap-ul oficial (robots.txt →
// categories-index.xml → categories-N.xml). Alimenteaza available_scraper_categories,
// din care adminul alege categoriile de scanat fara sa tasteze path-ul manual.

const SITEMAP_INDEX_URL = 'https://www.emag.ro/sitemaps/categories-index.xml'

const logger = pino({ level: 'info' })

// Aceeasi configuratie de headere ca scraper-ul de produse (emag.ts) — dovedita
// functionala cu WAF-ul eMAG; alt fingerprint (ex. Accept-Encoding cu br) atrage captcha.
const httpClient = axios.create({
  timeout: 30000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'ro-RO,ro;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate',
  },
  decompress: true,
})

// 'masini-de-spalat-rufe' -> 'Masini de spalat rufe'
export function labelFromPath(path: string): string {
  const text = path.replace(/-/g, ' ').trim()
  return text.charAt(0).toUpperCase() + text.slice(1)
}

// Extrage sub-sitemap-urile din index: <loc>https://www.emag.ro/sitemaps/categories-0.xml</loc>
export function parseSitemapIndex(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*(https:\/\/www\.emag\.ro\/sitemaps\/categories-\d+\.xml)\s*<\/loc>/g)]
    .map((m) => m[1])
}

// Extrage path-urile de categorie: <loc>https://www.emag.ro/telefoane-mobile/c</loc> -> 'telefoane-mobile'
export function parseCategoryPaths(xml: string): string[] {
  const paths = new Set<string>()
  for (const m of xml.matchAll(/<loc>\s*https:\/\/www\.emag\.ro\/([a-z0-9-]+)\/c\s*<\/loc>/g)) {
    paths.add(m[1])
  }
  return [...paths]
}

export async function syncEmagCategoryCatalog(): Promise<{ found: number }> {
  const { rows } = await pool.query<{ id: number }>(`SELECT id FROM retailers WHERE slug = 'emag'`)
  const retailerId = rows[0]?.id
  if (!retailerId) {
    logger.warn('Retailerul emag nu exista in DB — catalogul de categorii nu se poate salva')
    return { found: 0 }
  }

  const indexResp = await httpClient.get(SITEMAP_INDEX_URL)
  const sitemapUrls = parseSitemapIndex(String(indexResp.data))
  if (!sitemapUrls.length) throw new Error('Sitemap index fara sub-sitemap-uri de categorii')

  const paths: string[] = []
  for (const url of sitemapUrls) {
    const resp = await httpClient.get(url)
    paths.push(...parseCategoryPaths(String(resp.data)))
  }
  if (!paths.length) throw new Error('Sitemap-urile de categorii nu contin niciun path')

  await pool.query(`
    INSERT INTO available_scraper_categories (retailer_id, path, label, last_seen_at)
    SELECT $1, u.path, u.label, now()
    FROM unnest($2::text[], $3::text[]) AS u(path, label)
    ON CONFLICT (retailer_id, path) DO UPDATE SET label = EXCLUDED.label, last_seen_at = now()
  `, [retailerId, paths, paths.map(labelFromPath)])

  logger.info({ found: paths.length }, 'Catalog categorii eMAG actualizat')
  return { found: paths.length }
}
