import crypto from 'crypto'
import https from 'https'

// Client API Profitshare pentru afiliati (api.profitshare.ro).
// Autentificare HMAC-SHA1: semnatura = HMAC(API_KEY, "{VERB}{path}/?{query}/{api_user}{date}").
// Data foloseste sufixul "UTC" (echivalentul PHP gmdate('T')) — verificat pe API-ul live;
// cu "GMT" serverul raspunde InvalidSignature. Toleranta de ceas: ±20 secunde.

const API_HOST = 'api.profitshare.ro'
// Limita documentata: 60 cereri / 60 secunde pe endpoint-urile GET.
const MIN_CALL_SPACING_MS = 1100

export interface PsAdvertiser {
  id: string
  name: string
  logo: string
  category: string
  url: string
  advertiser_identifier: string  // hash advertiser pentru linkuri l.profitshare.ro
  affiliate_identifier: string   // hash-ul tau de afiliat
}

export interface PsFeed {
  link: string
  type: string  // 'csv' | 'xml'
  name: string
  created_at: string
  updated_at: string
  status: string
  advertisers: { id: string; name: string }[]
}

export interface PsProduct {
  link: string
  name: string
  image: string
  price_vat: number
  price: number
  advertiser_id: number
  advertiser_name: string
  category_name: string
}

interface Paginated<K extends string, T> {
  result: { current_page: number; total_pages: number; records_per_page: number } & Record<K, T[]>
}

let lastCallAt = 0

async function throttle(): Promise<void> {
  const wait = lastCallAt + MIN_CALL_SPACING_MS - Date.now()
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  lastCallAt = Date.now()
}

export class PsApiError extends Error {
  constructor(public code: string, message: string, public httpStatus?: number) {
    super(`Profitshare API ${code}: ${message}`)
  }
}

export async function psRequest<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
  const user = process.env.PROFITSHARE_API_USER
  const key = process.env.PROFITSHARE_API_KEY
  if (!user || !key) throw new Error('PROFITSHARE_API_USER / PROFITSHARE_API_KEY lipsesc din .env')

  await throttle()

  // Semnatura se calculeaza peste query string-ul DECODAT, dar URL-ul trimite valorile
  // encodate (serverul decodeaza inainte sa-si recalculeze semnatura — verificat live).
  const entries = Object.entries(params)
  const sigQs = entries.map(([k, v]) => `${k}=${v}`).join('&')
  const urlQs = entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&')
  const date = new Date().toUTCString().replace('GMT', 'UTC')
  const sigData = 'GET' + path + '/?' + sigQs + '/' + user + date
  const sig = crypto.createHmac('sha1', key).update(sigData).digest('hex')

  return new Promise((resolve, reject) => {
    const req = https.get({
      hostname: API_HOST,
      path: '/' + path + '/?' + urlQs,
      headers: { 'Date': date, 'X-PS-Client': user, 'X-PS-Auth': sig, 'X-PS-Accept': 'json' },
      timeout: 30000,
    }, (res) => {
      let data = ''
      res.on('data', (d) => (data += d))
      res.on('end', () => {
        let parsed: any
        try { parsed = JSON.parse(data) } catch {
          return reject(new PsApiError('InvalidJSON', data.slice(0, 200), res.statusCode))
        }
        if (parsed?.error) {
          return reject(new PsApiError(parsed.error.code || 'Unknown', parsed.error.message || '', res.statusCode))
        }
        resolve(parsed as T)
      })
    })
    req.on('timeout', () => req.destroy(new Error('Profitshare API timeout')))
    req.on('error', reject)
  })
}

// Construieste stringul semnaturii — exportat pentru teste.
export function buildSignatureString(verb: string, path: string, qs: string, user: string, date: string): string {
  return verb + path + '/?' + qs + '/' + user + date
}

export async function getAdvertisers(): Promise<PsAdvertiser[]> {
  const res = await psRequest<{ result: Record<string, PsAdvertiser> }>('affiliate-advertisers')
  return Object.values(res.result)
}

export async function getFeeds(): Promise<PsFeed[]> {
  const all: PsFeed[] = []
  let page = 1
  for (;;) {
    const res = await psRequest<Paginated<'feeds', PsFeed>>('affiliate-feeds', { page })
    all.push(...res.result.feeds)
    if (page >= res.result.total_pages) break
    page++
  }
  return all
}

// Cauta produse dupa cod (part number / SKU) — returneaza ofertele tuturor advertiserilor.
export async function getProductsByPartNo(partNo: string, page = 1): Promise<{ products: PsProduct[]; totalPages: number }> {
  const res = await psRequest<Paginated<'products', PsProduct>>('affiliate-products', {
    'filters[part_no]': partNo,
    page,
  })
  return { products: res.result.products, totalPages: res.result.total_pages }
}

// Link de afiliere construit local (fara apel API): l.profitshare.ro/lps/{advHash}/{affHash}/?redirect=
export function buildAffiliateUrl(productUrl: string, affiliateHash: string, advertiserHash: string): string {
  return `https://l.profitshare.ro/lps/${advertiserHash}/${affiliateHash}/?redirect=${encodeURIComponent(productUrl)}`
}
