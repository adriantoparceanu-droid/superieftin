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
  // Forma reala: obiect cu intrari numerotate { type, value: '1.00% - 20.00%' } plus o
  // cheie 'affiliate_statuses' { active, approved }. Citit defensiv.
  commissions?: Record<string, unknown>
}

// Comisionul reprezentativ al unui advertiser (maximul procentelor cunoscute), sau null.
export function advertiserCommission(adv: PsAdvertiser): number | null {
  const values: number[] = []
  for (const [key, entry] of Object.entries(adv.commissions ?? {})) {
    if (key === 'affiliate_statuses' || !entry || typeof entry !== 'object') continue
    const value = (entry as { value?: unknown }).value
    if (typeof value !== 'string') continue
    for (const m of value.matchAll(/([\d.,]+)\s*%/g)) {
      const n = parseFloat(m[1].replace(',', '.'))
      if (!isNaN(n)) values.push(n)
    }
  }
  return values.length ? Math.max(...values) : null
}

// 'active' doar daca esti aprobat in programul advertiserului (altfel linkul nu aduce
// comision). Advertiserii neaprobati raman, dar nu produc link afiliat.
export function advertiserStatus(adv: PsAdvertiser): string {
  const st = adv.commissions?.affiliate_statuses as { active?: string; approved?: string } | undefined
  return st?.approved === 'yes' && st?.active === 'yes' ? 'active' : 'inactive'
}

// Statusul din API NU e stabil: serverele Profitshare raspund diferit pentru `affiliate_statuses`
// (vezi lib/affiliate/profitshare-deeplink.ts). Un singur apel a marcat eMAG „inactive” pe
// 10 oct. 2026 → alerta falsa „Nu mai esti aprobat” pe Telegram, desi 6 apeluri imediat dupa
// spuneau „aprobat + activ”. De aceea citim lista de mai multe ori si e suficient UN raspuns
// „aprobat + activ” ca advertiserul sa fie activ. Functie pura (testata): ID-urile active.
export function activeAdvertiserIds(reads: PsAdvertiser[][]): Set<string> {
  const ids = new Set<string>()
  for (const list of reads) {
    for (const adv of list) if (advertiserStatus(adv) === 'active') ids.add(String(adv.id))
  }
  return ids
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

// Creeaza un link OFICIAL in contul Profitshare (POST affiliate-links) → l.profitshare.ro/l/{id}.
// E o SCRIERE in cont (apare in panou) — se foloseste rar, manual (scripts/create-profitshare-link.ts).
// Semnatura: ca la GET, dar cu verbul POST si query string gol; corpul e form-urlencoded
// `0[name]=…&0[url]=…` (verificat live 2026-10-04).
export interface PsCreatedLink {
  name: string
  url: string
  ps_url: string             // https://l.profitshare.ro/l/<id>
  final_url?: string
  tracking_template?: string
  [k: string]: unknown
}

export async function createAffiliateLink(name: string, url: string): Promise<PsCreatedLink> {
  const user = process.env.PROFITSHARE_API_USER
  const key = process.env.PROFITSHARE_API_KEY
  if (!user || !key) throw new Error('PROFITSHARE_API_USER / PROFITSHARE_API_KEY lipsesc din .env')

  await throttle()
  const path = 'affiliate-links'
  const date = new Date().toUTCString().replace('GMT', 'UTC')
  const sig = crypto.createHmac('sha1', key).update(buildSignatureString('POST', path, '', user, date)).digest('hex')
  const body = `0[name]=${encodeURIComponent(name)}&0[url]=${encodeURIComponent(url)}`

  return new Promise((resolve, reject) => {
    const req = https.request({
      method: 'POST',
      hostname: API_HOST,
      path: '/' + path + '/?',
      headers: {
        'Date': date, 'X-PS-Client': user, 'X-PS-Auth': sig, 'X-PS-Accept': 'json',
        'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body),
      },
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
        // Raspunsul: { result: [ { name, url, ps_url, ... } ] } (sau obiect cu cheia „0”)
        const first = Array.isArray(parsed?.result) ? parsed.result[0] : parsed?.result?.[0] ?? parsed?.result?.['0']
        if (!first?.ps_url) return reject(new PsApiError('NoLink', JSON.stringify(parsed).slice(0, 300), res.statusCode))
        resolve(first as PsCreatedLink)
      })
    })
    req.on('timeout', () => req.destroy(new Error('Profitshare API timeout')))
    req.on('error', reject)
    req.end(body)
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

// --- Comisioane (Faza 2 — tracking conversii) -----------------------------------------------

// Un rand din `affiliate-commissions`, asa cum vine de la API (structura verificata live pe
// 2026-09-26). Sumele vin ca text; pe comenzi cu mai multe produse, campurile items_* au cate o
// valoare per produs, separate prin `|` (ex. items_commision = "12.50|3.10").
export interface PsCommissionRaw {
  order_id: number | string
  order_status: string              // pending | approved | canceled (verificat live)
  advertiser_id: number | string
  hash: string | null               // subID-ul trimis pe link = click_id-ul nostru (sau null)
  order_date: string                // "YYYY-MM-DD HH:MM:SS", ora Romaniei (vezi parseRoDateTime)
  order_updated?: string
  items_status?: string
  items_commision?: string          // SUMA comisionului per produs (RON)
  items_commision_value?: string    // PROCENTUL per produs — nu il folosim ca valoare
  advertiser_name?: string
  [k: string]: unknown
}

export type CommissionStatus = 'pending' | 'approved' | 'rejected'

export interface ParsedCommission {
  externalId: string                // order_id → orderId / transactionId la Google (idempotent)
  clickId: string | null
  advertiserId: string
  status: CommissionStatus
  amount: number                    // RON, rotunjit la 2 zecimale
  orderTime: Date
  unknownStatus?: string            // status necunoscut (tratat ca pending) — de logat
}

// Profitshare scrie data fara fus orar, in ora Romaniei. Calculam offset-ul real al zilei
// (EET +02:00 iarna / EEST +03:00 vara) cu Intl, ca sa nu depindem de fusul serverului.
export function parseRoDateTime(s: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/.exec(s.trim())
  if (!m) throw new Error(`Dată Profitshare nerecunoscută: „${s}”`)
  const [y, mo, d, h, mi, se] = m.slice(1).map(Number)
  const asUtc = Date.UTC(y, mo - 1, d, h, mi, se)
  // Offset-ul Bucurestiului la acel moment (aproximat intai ca UTC, apoi corectat)
  const offsetAt = (t: number) => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Bucharest', hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(new Date(t))
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
    return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')) - t
  }
  let t = asUtc - offsetAt(asUtc)
  t = asUtc - offsetAt(t)   // a doua trecere corecteaza zilele de schimbare a orei
  return new Date(t)
}

const STATUS_MAP: Record<string, CommissionStatus> = {
  pending: 'pending',
  approved: 'approved',
  paid: 'approved',        // nevazut inca in date reale; „platit” = aprobat
  canceled: 'rejected',
  cancelled: 'rejected',
  rejected: 'rejected',
}

// Transforma un rand API in forma noastra. Suma = comisioanele produselor NEanulate; daca
// toata comanda e anulata, pastram suma totala (doar informativ — nu se mai trimite nimic).
export function parseCommission(raw: PsCommissionRaw): ParsedCommission {
  const orderStatus = String(raw.order_status ?? '').toLowerCase().trim()
  const status = STATUS_MAP[orderStatus] ?? 'pending'
  const amounts = String(raw.items_commision ?? '').split('|').map((x) => parseFloat(x.replace(',', '.')))
  const statuses = String(raw.items_status ?? '').split('|').map((x) => x.toLowerCase().trim())
  let total = 0
  let active = 0
  amounts.forEach((a, i) => {
    if (!Number.isFinite(a)) return
    total += a
    if (STATUS_MAP[statuses[i] ?? orderStatus] !== 'rejected') active += a
  })
  const amount = Math.round((status === 'rejected' ? total : active) * 100) / 100
  // hash gol / null = link fara subID (comenzi dinainte de /go cu click_id)
  const hash = typeof raw.hash === 'string' && /^[a-z0-9]{6,32}$/i.test(raw.hash.trim()) ? raw.hash.trim() : null
  return {
    externalId: String(raw.order_id),
    clickId: hash,
    advertiserId: String(raw.advertiser_id),
    status,
    amount,
    orderTime: parseRoDateTime(raw.order_date),
    ...(STATUS_MAP[orderStatus] ? {} : { unknownStatus: orderStatus || '(gol)' }),
  }
}

// Comisioanele din ultimele `days` zile (dupa data comenzii), toate paginile.
// Filtrul `filters[click_hash]` e ignorat de server (verificat live) → potrivirea cu click_id
// se face local, in tracking-sync.
export async function getCommissions(days = 90, now = new Date()): Promise<PsCommissionRaw[]> {
  const ymd = (d: Date) => d.toISOString().slice(0, 10)
  const from = new Date(now.getTime() - days * 86400_000)
  const all: PsCommissionRaw[] = []
  let page = 1
  for (;;) {
    const res = await psRequest<Paginated<'commissions', PsCommissionRaw>>('affiliate-commissions', {
      'filters[date_from]': ymd(from),
      'filters[date_to]': ymd(now),
      page,
    })
    // Fara comisioane API-ul poate intoarce lista goala sau lipsa → tratam defensiv
    all.push(...(res.result?.commissions ?? []))
    if (!res.result || page >= (res.result.total_pages ?? 1)) break
    page++
  }
  return all
}
