import axios from 'axios'
import * as cheerio from 'cheerio'
import { buildAffiliateUrl } from '../lib/profitshare.js'

export interface ScrapedProduct {
  name: string
  slug: string
  brand: string | null
  category: string
  imageUrl: string | null
  url: string
  affiliateUrl: string
  price: number | null
  inStock: boolean
}

const BASE_URL = 'https://www.emag.ro'
const RATE_LIMIT_MS = parseInt(process.env.SCRAPE_RATE_LIMIT_MS || '2000')

const httpClient = axios.create({
  timeout: 20000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'ro-RO,ro;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate',
  },
  decompress: true,
})

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
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

function parsePrice(raw: string): number | null {
  // "639&#44;84 Lei" sau "639,84 Lei" sau "1.299,00 Lei"
  const decoded = raw.replace(/&#44;/g, ',').replace(/&#46;/g, '.')
  const cleaned = decoded.replace(/[^\d,.]/g, '')
  // Formatul romanesc: punct = separator mii, virgula = zecimal
  const normalized = cleaned.replace(/\.(?=\d{3})/g, '').replace(',', '.')
  const val = parseFloat(normalized)
  return isNaN(val) ? null : val
}

function extractProducts($: cheerio.CheerioAPI, category: string): ScrapedProduct[] {
  const products: ScrapedProduct[] = []

  // Fiecare card de produs pe pagina de listing eMAG
  $('.card-item.js-product-data').each((_, el) => {
    const $el = $(el)

    const name = $el.attr('data-name')?.trim()
    if (!name) return

    const url = $el.attr('data-url')?.trim()
    if (!url || !url.includes('emag.ro')) return

    // Pretul curent
    const priceRaw = $el.find('.product-new-price').first().text().trim()
    const price = priceRaw ? parsePrice(priceRaw) : null

    // Imaginea principala (CDN eMAG)
    const imageUrl = $el.find('img[src*="emagst.akamaized"], img[src*="emag.ro"]').first().attr('src')
      || $el.find('img').first().attr('src') || null

    // Stock: availability-id 1=in stoc, 3=limitat, 0=epuizat
    const availId = $el.attr('data-availability-id')
    const inStock = availId !== '0'

    // Brand din nume (primele cuvinte) sau din data atribute
    const brand = extractBrand(name)

    const slug = toSlug(name)
    const affiliateUrl = buildAffiliateUrl(url)

    products.push({ name, slug, brand, category, imageUrl: imageUrl || null, url, affiliateUrl, price, inStock })
  })

  return products
}

function extractBrand(name: string): string | null {
  // Telefoane eMAG incep de obicei cu marca: "Telefon mobil Samsung ...", "Apple iPhone ..."
  const knownBrands = ['Samsung', 'Apple', 'Xiaomi', 'Huawei', 'OnePlus', 'Google', 'Oppo', 'Vivo',
    'Motorola', 'Nokia', 'Sony', 'Realme', 'Honor', 'Nothing', 'Asus', 'LG']
  for (const brand of knownBrands) {
    if (name.includes(brand)) return brand
  }
  return null
}

export async function scrapeEmagCategory(categoryPath: string, maxPages = 5): Promise<ScrapedProduct[]> {
  const all: ScrapedProduct[] = []
  let errorCount = 0

  for (let page = 1; page <= maxPages; page++) {
    const url = `${BASE_URL}/${categoryPath}/p${page}/c`
    try {
      await sleep(RATE_LIMIT_MS)

      const resp = await httpClient.get<string>(url, {
        maxRedirects: 3,
        validateStatus: (s) => s < 500,
      })

      if (resp.status === 404) break
      if (resp.status !== 200) {
        errorCount++
        continue
      }

      const $ = cheerio.load(resp.data)
      const products = extractProducts($, categoryPath)

      if (products.length === 0) {
        // Verifica daca pagina a returnat HTML valid cu produse (nu pagina goala/blocat)
        const hasContainer = $('.js-products-container, .card-collection').length > 0
        if (!hasContainer || page > 1) break
        // Prima pagina goala poate insemna blocat
        errorCount++
        break
      }

      all.push(...products)

      // Verifica paginatia
      const hasNextPage = $(`[data-page="${page + 1}"], a[href*="p${page + 1}/c"]`).length > 0
      if (!hasNextPage) break

    } catch (err: unknown) {
      errorCount++
      const msg = err instanceof Error ? err.message : String(err)
      if (errorCount > 3) throw new Error(`Prea multe erori scraping eMAG (${errorPath(url)}): ${msg}`)
    }
  }

  return all
}

function errorPath(url: string) {
  try { return new URL(url).pathname } catch { return url }
}
