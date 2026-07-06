import { createReadStream } from 'fs'
import { toSlug } from '../lib/slug.js'
import { isBlockedImageHost } from '../lib/images.js'
import type { ImportedProduct } from '../lib/types.js'

// Feed de produse 2Performant: <items><item>...</item></items>.
// <aff_code> contine deja linkul afiliat (tip product_store), deci produsele sunt afiliate
// din start. Nu exista SKU/categorie/stoc in feed.
export interface TpFeedRow {
  title: string
  affLink: string
  price: string
  category: string
  productId: string
  brand: string
  productActive: string
  gtin: string
  campaignName: string
  imageUrl: string
}

const TAGS: Record<string, keyof TpFeedRow> = {
  title: 'title',
  aff_code: 'affLink',
  price: 'price',
  category: 'category',
  product_id: 'productId',
  brand: 'brand',
  product_active: 'productActive',
  gtin: 'gtin',
  campaign_name: 'campaignName',
  image_urls: 'imageUrl',
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&amp;/g, '&')
}

// Parser XML in streaming: extrage blocurile <item> pe masura ce sosesc (feed mare).
export async function* parseTpFeed(filePath: string): AsyncGenerator<TpFeedRow> {
  const stream = createReadStream(filePath, { encoding: 'utf-8' })
  let buffer = ''
  for await (const chunk of stream) {
    buffer += chunk
    let start: number
    while ((start = buffer.indexOf('<item>')) !== -1) {
      const end = buffer.indexOf('</item>', start)
      if (end === -1) break
      const block = buffer.slice(start + 6, end)
      buffer = buffer.slice(end + 7)
      const row = {} as TpFeedRow
      for (const [tag, key] of Object.entries(TAGS)) {
        const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`))
        row[key] = m ? decodeXmlEntities(m[1]).trim() : ''
      }
      yield row
    }
    if (buffer.length > 1_000_000) buffer = buffer.slice(-500_000)
  }
}

export function mapTpFeedRow(row: TpFeedRow): ImportedProduct | null {
  const name = row.title.trim()
  const affiliateUrl = row.affLink.trim()
  if (!name || !affiliateUrl) return null

  const price = parseFloat(row.price.replace(',', '.'))

  // GTIN = cod universal de produs -> cheie de unificare intre magazine (cand exista).
  const gtin = row.gtin.trim() || null
  // product_id (id-ul magazinului) — pentru unicitatea slug-ului la nume lungi.
  const productId = row.productId.trim() || null

  let slug = toSlug(name)
  const wasTruncated = name.replace(/[^a-zA-Z0-9]+/g, '-').length > 120
  if (wasTruncated && productId) {
    slug = (slug.slice(0, 90).replace(/-+$/, '') + '-' + toSlug(productId)).slice(0, 120)
  }

  const feedCategory = row.category.trim()

  return {
    name,
    slug,
    brand: row.brand.trim() || null,
    category: toSlug(feedCategory.toLowerCase() || 'diverse'),
    feedCategory,                     // categoria din feed -> mapabila in admin (ca la Profitshare)
    partNo: gtin,                     // GTIN pentru unificare cross-retailer (null daca lipseste)
    imageUrl: row.imageUrl && !isBlockedImageHost(row.imageUrl) ? row.imageUrl : null,
    url: affiliateUrl,                // nu exista URL brut; folosim linkul afiliat
    affiliateUrl,                     // link afiliat product_store din feed
    affiliateNetwork: '2performant',
    price: isNaN(price) || price <= 0 ? null : price,
    inStock: row.productActive.trim().toLowerCase() !== 'false',  // product_active=false -> fara stoc
  }
}
