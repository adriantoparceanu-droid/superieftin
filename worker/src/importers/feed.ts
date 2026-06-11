import axios from 'axios'
import { createReadStream, createWriteStream } from 'fs'
import { parse } from 'csv-parse'
import { toSlug } from '../lib/slug.js'
import type { ImportedProduct } from '../lib/types.js'

// Un rand de feed Profitshare, normalizat. CSV si XML au exact aceleasi campuri
// (verificat pe feed-uri reale: CSV foloseste antete in engleza, XML taguri snake_case).
export interface FeedRow {
  advertiserName: string
  category: string
  manufacturer: string
  productCode: string
  productName: string
  affLink: string
  link: string
  picture: string
  priceVat: string
  priceDiscountedVat: string
  availability: string
}

// Antetele CSV asa cum apar in feed (primul camp poate avea BOM — csv-parse il elimina).
const CSV_COLUMNS: Record<string, keyof FeedRow> = {
  'Advertiser name': 'advertiserName',
  'Category': 'category',
  'Manufacturer': 'manufacturer',
  'Product code': 'productCode',
  'Product name': 'productName',
  'Product affiliate link': 'affLink',
  'Product link': 'link',
  'Product picture': 'picture',
  'Price with VAT': 'priceVat',
  'Price with discount, with VAT': 'priceDiscountedVat',
  'Availability': 'availability',
}

const XML_TAGS: Record<string, keyof FeedRow> = {
  adv_name: 'advertiserName',
  category: 'category',
  manufacturer: 'manufacturer',
  product_code: 'productCode',
  product_name: 'productName',
  product_aff_link: 'affLink',
  link: 'link',
  product_pic: 'picture',
  price_vat: 'priceVat',
  price_discounted: 'priceDiscountedVat',
  availability: 'availability',
}

export async function downloadFeed(url: string, destPath: string): Promise<void> {
  const response = await axios.get(url, { responseType: 'stream', timeout: 300000, maxRedirects: 5 })
  await new Promise<void>((resolve, reject) => {
    const out = createWriteStream(destPath)
    response.data.pipe(out)
    out.on('finish', resolve)
    out.on('error', reject)
    response.data.on('error', reject)
  })
}

export async function* parseCsvFeed(filePath: string): AsyncGenerator<FeedRow> {
  const parser = createReadStream(filePath).pipe(parse({
    bom: true,
    columns: true,
    relax_quotes: true,
    relax_column_count: true,
    skip_empty_lines: true,
    trim: true,
  }))
  for await (const record of parser) {
    const row = {} as FeedRow
    for (const [header, key] of Object.entries(CSV_COLUMNS)) {
      row[key] = (record[header] ?? '').toString().trim()
    }
    yield row
  }
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&amp;/g, '&')
}

// Parser XML in streaming: feed-urile sunt generate de masina, cu structura plata si
// previzibila (<product>...campuri...</product>), deci extragem blocurile complete
// din buffer pe masura ce sosesc — fara sa incarcam fisierul intreg in memorie.
export async function* parseXmlFeed(filePath: string): AsyncGenerator<FeedRow> {
  const stream = createReadStream(filePath, { encoding: 'utf-8' })
  let buffer = ''
  for await (const chunk of stream) {
    buffer += chunk
    let start: number
    while ((start = buffer.indexOf('<product>')) !== -1) {
      const end = buffer.indexOf('</product>', start)
      if (end === -1) break
      const block = buffer.slice(start + 9, end)
      buffer = buffer.slice(end + 10)
      yield parseXmlProductBlock(block)
    }
    // Pastreaza doar coada (un bloc incomplet nu poate incepe inaintea ultimului <product>)
    if (buffer.length > 1_000_000) buffer = buffer.slice(-500_000)
  }
}

function parseXmlProductBlock(block: string): FeedRow {
  const row = {} as FeedRow
  for (const [tag, key] of Object.entries(XML_TAGS)) {
    const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`))
    row[key] = m ? decodeXmlEntities(m[1]).trim() : ''
  }
  return row
}

export function parseFeedFile(filePath: string, type: string): AsyncGenerator<FeedRow> {
  return type === 'xml' ? parseXmlFeed(filePath) : parseCsvFeed(filePath)
}

function parseFeedPrice(raw: string): number | null {
  if (!raw) return null
  const val = parseFloat(raw.replace(',', '.'))
  return isNaN(val) || val <= 0 ? null : val
}

// Transforma un rand de feed in produs normalizat. Returneaza null pentru randuri inutilizabile.
export function mapFeedRow(row: FeedRow, categoryMap: Map<string, string>): ImportedProduct | null {
  const name = row.productName
  const url = row.link
  if (!name || !url) return null

  const psCategory = row.category.toLowerCase().trim()
  const category = categoryMap.get(psCategory) || toSlug(psCategory || 'diverse')

  // Linkul afiliat din feed e protocol-relative (//profitshare.ro/...)
  const affiliateUrl = row.affLink.startsWith('//') ? 'https:' + row.affLink : row.affLink

  const price = parseFeedPrice(row.priceDiscountedVat) ?? parseFeedPrice(row.priceVat)

  return {
    name,
    slug: toSlug(name),
    brand: row.manufacturer || null,
    category,
    partNo: row.productCode || null,
    imageUrl: row.picture || null,
    url,
    affiliateUrl: affiliateUrl || url,
    price,
    inStock: row.availability === 'in_stock',
  }
}
