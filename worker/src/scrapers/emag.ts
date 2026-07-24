import os from 'os'
import path from 'path'
import axios from 'axios'
import * as cheerio from 'cheerio'
import pino from 'pino'
import pool from '../lib/db.js'
import { toSlug } from '../lib/slug.js'
import { scrapedProduct } from './types.js'
import { syncEmagCategoryCatalog } from './emag-catalog.js'
import type { Scraper } from './types.js'
import type { ImportedProduct } from '../lib/types.js'

// Scraper eMAG: eMAG nu ofera feed de produse prin Profitshare, doar scanare directa.
// Scaneaza EXCLUSIV categoriile active din scraper_categories (nu tot site-ul) —
// controlate din admin (/admin/scraper-categorii).
//
// Unificare cu produsele existente (alti retaileri): pagina de listare eMAG nu are cod
// de producator (MPN), dar pagina de PRODUS il expune intr-un JSON schema.org
// ("mpn": "SM-..."). Cerem pagina de produs SUPLIMENTAR doar cand brandul extras din
// titlu exista deja in catalog (candidat real de unificare) — pentru restul, produsul
// se salveaza fara part_no (ramane oferta separata, fara cost suplimentar de cereri).

const BASE_URL = 'https://www.emag.ro'
const LISTING_DELAY_MS = parseInt(process.env.EMAG_LISTING_DELAY_MS || '3500')
const DETAIL_DELAY_MS = parseInt(process.env.EMAG_DETAIL_DELAY_MS || '4000')
// Plasa de siguranta: chiar daca brandurile se suprapun masiv, nu lasam o rulare sa
// devina nemarginita in cereri (categorie neasteptat de mare, brand foarte comun).
const MAX_DETAIL_FETCHES = parseInt(process.env.EMAG_MAX_DETAIL_FETCHES || '300')
// Ordinea produselor in listare. Scanam doar cateva pagini/categorie, deci vrem primele
// pagini sa contina cele mai bune produse. Gol = ordinea nativa eMAG ("Recomandate"),
// deja ponderata dupa popularitate. Poate fi fortata (ex. best-sellers) printr-un query
// string brut in EMAG_SORT_QUERY (ex. "ref=..."), confirmat din dropdown-ul "Sorteaza dupa".
const SORT_QUERY = (process.env.EMAG_SORT_QUERY || '').replace(/^\?/, '')
const MAX_ERRORS_PER_CATEGORY = 3

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'

const httpClient = axios.create({
  timeout: 20000,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'ro-RO,ro;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate',
  },
  decompress: true,
})

const log = pino({ level: 'info' }).child({ scraper: 'emag' })

// --- Strategie de fetch --------------------------------------------------------
// eMAG e scanabil DOAR local (IP rezidential); pe IP de datacenter (VPS) WAF-ul AWS da
// 511 indiferent de unealta. 'http' (axios) trece intermitent de pe IP rezidential dar
// e prins de challenge-ul JS; 'playwright' porneste un browser real care rezolva automat
// challenge-ul (obtine cookie-ul aws-waf-token) — recomandat pentru rulare locala.
// Se seteaza in .env local: EMAG_FETCH=playwright. Necesita `npx playwright install chromium`.
const FETCH_MODE = (process.env.EMAG_FETCH || 'http').toLowerCase()

interface FetchResult { status: number; html: string }
interface PageFetcher {
  get(url: string, readySelector?: string): Promise<FetchResult>
  close(): Promise<void>
}

function createHttpFetcher(): PageFetcher {
  return {
    async get(url) {
      const resp = await httpClient.get(url, { maxRedirects: 3, validateStatus: (s) => s < 500 })
      return { status: resp.status, html: typeof resp.data === 'string' ? resp.data : '' }
    },
    async close() {},
  }
}

// Browser real (Playwright). Import dinamic cu specifier indirect: playwright e dependinta
// de DEZVOLTARE (doar local), deci nu vrem ca tsc / imaginea de productie s-o ceara.
async function createPlaywrightFetcher(): Promise<PageFetcher> {
  const mod = 'playwright'
  const pw: any = await import(mod)
  const headed = process.env.EMAG_PW_HEADED === '1'
  // Profil persistent: cookie-ul aws-waf-token supravietuieste intre rulari (challenge
  // rezolvat o data, refolosit) — pune EMAG_PW_HEADED=1 la prima rulare daca apare captcha.
  const profileDir = process.env.EMAG_PW_PROFILE || path.join(os.tmpdir(), 'emag-pw-profile')
  const ctx = await pw.chromium.launchPersistentContext(profileDir, {
    headless: !headed,
    locale: 'ro-RO',
    viewport: { width: 1366, height: 900 },
    userAgent: USER_AGENT,
  })
  const page = ctx.pages()[0] ?? (await ctx.newPage())
  const onChallenge = () =>
    page
      .evaluate(() => /captcha/i.test(document.title) || !!document.querySelector('script[src*="captcha-sdk.awswaf.com"]'))
      .catch(() => false)

  return {
    async get(url, readySelector) {
      const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => null)
      // Challenge-ul AWS WAF se auto-rezolva: JS-ul calculeaza tokenul si face redirect.
      if (await onChallenge()) {
        await page
          .waitForFunction(
            () => !/captcha/i.test(document.title) && !document.querySelector('script[src*="captcha-sdk.awswaf.com"]'),
            { timeout: 30000 },
          )
          .catch(() => {})
      }
      if (readySelector) await page.waitForSelector(readySelector, { timeout: 12000 }).catch(() => {})
      const html: string = await page.content()
      const status = (await onChallenge()) ? 511 : (resp?.status?.() ?? 200)
      return { status, html }
    },
    async close() {
      await ctx.close().catch(() => {})
    },
  }
}

async function createFetcher(): Promise<PageFetcher> {
  if (FETCH_MODE === 'playwright') {
    try {
      const f = await createPlaywrightFetcher()
      log.info('Fetch prin Playwright (browser real, trece de WAF)')
      return f
    } catch (err) {
      log.error({ err }, 'Playwright indisponibil — revin la http (axios). Ruleaza `npx playwright install chromium`.')
    }
  }
  return createHttpFetcher()
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

// +0-40% jitter — evita un tipar de cereri perfect regulat.
function withJitter(ms: number): number {
  return ms + Math.floor(Math.random() * ms * 0.4)
}

function parsePrice(raw: string): number | null {
  // "639&#44;84 Lei" / "639,84 Lei" / "1.299,00 Lei" — punct = mii, virgula = zecimal (RO)
  const decoded = raw.replace(/&#44;/g, ',').replace(/&#46;/g, '.')
  const cleaned = decoded.replace(/[^\d,.]/g, '')
  const normalized = cleaned.replace(/\.(?=\d{3})/g, '').replace(',', '.')
  const val = parseFloat(normalized)
  return isNaN(val) ? null : val
}

const KNOWN_BRANDS = [
  'Samsung', 'Apple', 'Xiaomi', 'Huawei', 'OnePlus', 'Google', 'Oppo', 'Vivo',
  'Motorola', 'Nokia', 'Sony', 'Realme', 'Honor', 'Nothing', 'Asus', 'LG',
  'Lenovo', 'HP', 'Dell', 'Acer', 'MSI', 'Microsoft', 'Razer', 'Toshiba',
  'Philips', 'TCL', 'Hisense', 'Panasonic', 'Sharp', 'Gigabyte', 'Vivax',
  'Thomson', 'Tesla', 'Kruger&Matz', 'Allview', 'Nubia',
]

function extractBrand(name: string): string | null {
  for (const brand of KNOWN_BRANDS) {
    if (name.includes(brand)) return brand
  }
  return null
}

interface ListingProduct {
  name: string
  url: string
  price: number | null
  imageUrl: string | null
  inStock: boolean
  brand: string | null
}

function extractListingProducts($: cheerio.CheerioAPI): ListingProduct[] {
  const products: ListingProduct[] = []
  $('.card-item.js-product-data').each((_, el) => {
    const $el = $(el)
    const name = $el.attr('data-name')?.trim()
    if (!name) return
    const url = $el.attr('data-url')?.trim()
    if (!url || !url.includes('emag.ro')) return

    const priceRaw = $el.find('.product-new-price').first().text().trim()
    const price = priceRaw ? parsePrice(priceRaw) : null

    const imageUrl = $el.find('img[src*="emagst.akamaized"], img[src*="emag.ro"]').first().attr('src')
      || $el.find('img').first().attr('src') || null

    // availability-id: 1=in stoc, 3=limitat, 0=epuizat
    const availId = $el.attr('data-availability-id')
    const inStock = availId !== '0'

    products.push({ name, url, price, imageUrl: imageUrl || null, inStock, brand: extractBrand(name) })
  })
  return products
}

// Codul de producator (MPN) e expus in JSON schema.org pe pagina de produs, nu pe listare.
async function fetchMpn(fetcher: PageFetcher, url: string): Promise<string | null> {
  try {
    const resp = await fetcher.get(url)
    if (resp.status !== 200 || !resp.html) return null
    const match = /"mpn"\s*:\s*"([^"]+)"/.exec(resp.html)
    return match ? match[1] : null
  } catch {
    return null
  }
}

interface CategoryConfig {
  path: string
  maxPages: number
  feedCategory: string
}

async function* scrapeCategory(
  fetcher: PageFetcher,
  cfg: CategoryConfig,
  existingBrands: Set<string>,
  detailBudget: { remaining: number },
): AsyncGenerator<ListingProduct & { feedCategory: string; mpn: string | null }> {
  let errorCount = 0

  for (let page = 1; page <= cfg.maxPages; page++) {
    const base = page === 1 ? `${BASE_URL}/${cfg.path}/c` : `${BASE_URL}/${cfg.path}/p${page}/c`
    const url = SORT_QUERY ? `${base}?${SORT_QUERY}` : base

    let resp: FetchResult
    try {
      await sleep(withJitter(LISTING_DELAY_MS))
      resp = await fetcher.get(url, '.card-item.js-product-data')
    } catch {
      errorCount++
      if (errorCount > MAX_ERRORS_PER_CATEGORY) break
      continue
    }

    if (resp.status === 404) break
    if (resp.status === 511 || resp.status === 429) break // rate-limit/captcha — ne retragem, nu insistam
    if (resp.status !== 200) {
      errorCount++
      if (errorCount > MAX_ERRORS_PER_CATEGORY) break
      continue
    }

    const $ = cheerio.load(resp.html)
    const products = extractListingProducts($)
    if (products.length === 0) break

    for (const p of products) {
      let mpn: string | null = null
      if (p.brand && existingBrands.has(p.brand.toLowerCase()) && detailBudget.remaining > 0) {
        detailBudget.remaining--
        await sleep(withJitter(DETAIL_DELAY_MS))
        mpn = await fetchMpn(fetcher, p.url)
      }
      yield { ...p, feedCategory: cfg.feedCategory, mpn }
    }

    const hasNextPage = $(`[data-page="${page + 1}"], a[href*="p${page + 1}/c"]`).length > 0
    if (!hasNextPage) break
  }
}

export class EmagScraper implements Scraper {
  readonly name = 'emag'
  readonly domain = 'emag.ro'

  async *run(): AsyncGenerator<ImportedProduct> {
    // Improspateaza catalogul de categorii disponibile (pentru selectorul din admin) —
    // best-effort: daca sitemap-ul nu raspunde, scanarea continua cu catalogul existent.
    await syncEmagCategoryCatalog().catch(() => {})

    const { rows: retailerRows } = await pool.query<{ id: number }>(
      `SELECT id FROM retailers WHERE slug = 'emag'`
    )
    const retailerId = retailerRows[0]?.id
    if (!retailerId) return

    const { rows: categories } = await pool.query<{ path: string; max_pages: number; feed_category: string }>(`
      SELECT path, max_pages, feed_category FROM scraper_categories
      WHERE retailer_id = $1 AND enabled = true
    `, [retailerId])
    if (!categories.length) return

    // Branduri deja prezente in catalog — doar pentru acestea justificam costul unui
    // request suplimentar pe pagina de produs (candidati reali de unificare).
    const { rows: brandRows } = await pool.query<{ brand: string }>(
      `SELECT DISTINCT brand FROM products WHERE brand IS NOT NULL`
    )
    const existingBrands = new Set(brandRows.map((r) => r.brand.toLowerCase()))
    const detailBudget = { remaining: MAX_DETAIL_FETCHES }

    const fetcher = await createFetcher()
    try {
      for (const cat of categories) {
        const cfg: CategoryConfig = { path: cat.path, maxPages: cat.max_pages, feedCategory: cat.feed_category }
        for await (const p of scrapeCategory(fetcher, cfg, existingBrands, detailBudget)) {
          yield scrapedProduct({
            name: p.name,
            slug: toSlug(p.name),
            brand: p.brand,
            category: toSlug(p.feedCategory),
            feedCategory: p.feedCategory,
            partNo: p.mpn,
            imageUrl: p.imageUrl,
            url: p.url,
            price: p.price,
            inStock: p.inStock,
          })
        }
      }
    } finally {
      await fetcher.close()
    }
  }
}
