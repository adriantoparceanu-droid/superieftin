// Client API 2Performant pentru afiliati (api.2performant.com).
// Autentificare: POST /users/sign_in.json cu email+parola -> headerele de sesiune
// (access-token, client, uid), reutilizate la cererile urmatoare. devise-token-auth
// poate roti access-token-ul la fiecare raspuns, deci il actualizam din fiecare raspuns.

const BASE = 'https://api.2performant.com'
// Timeout pe cererile catre API-ul 2P. fetch din Node nu are timeout implicit, deci fara
// el o cerere blocata ar tine sincronizarea (syncAffiliateAdvertisers) agatata la infinit.
const TP_TIMEOUT_MS = parseInt(process.env.TWOPERFORMANT_TIMEOUT_MS || '30000')

interface TpAuth { accessToken: string; client: string; uid: string; expiresAt: number }
let auth: TpAuth | null = null
// Reinnoim sesiunea cu o zi inainte de expirare (tokenul 2Performant tine ~2 saptamani)
const RENEW_BEFORE_MS = 24 * 3600 * 1000

async function signIn(): Promise<TpAuth> {
  const email = process.env.TWOPERFORMANT_EMAIL
  const password = process.env.TWOPERFORMANT_PASSWORD
  if (!email || !password) throw new Error('TWOPERFORMANT_EMAIL / TWOPERFORMANT_PASSWORD lipsesc din .env')
  const res = await fetch(`${BASE}/users/sign_in.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ user: { email, password } }),
    signal: AbortSignal.timeout(TP_TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`2Performant sign_in esuat: ${res.status}`)
  const expiry = Number(res.headers.get('expiry'))   // secunde Unix
  const a = {
    accessToken: res.headers.get('access-token') || '',
    client: res.headers.get('client') || '',
    uid: res.headers.get('uid') || '',
    expiresAt: expiry > 0 ? expiry * 1000 : Date.now() + 7 * 24 * 3600 * 1000,
  }
  if (!a.accessToken) throw new Error('2Performant: nu am primit access-token la sign_in')
  return a
}

// Workerul ruleaza luni intregi: sesiunea tinuta in memorie expira (~2 saptamani), iar fara
// re-login fiecare cerere dadea 401 (sincronizarea advertiserilor a esuat zilnic ~2 luni).
// Acum: reinnoire inainte de expirare + la un 401 facem login din nou si reincercam o data.
async function tpGet<T>(path: string, retried = false): Promise<T> {
  if (!auth || auth.expiresAt - Date.now() < RENEW_BEFORE_MS) auth = await signIn()
  const res = await fetch(BASE + path, {
    headers: { 'access-token': auth.accessToken, 'client': auth.client, 'uid': auth.uid, 'Accept': 'application/json' },
    signal: AbortSignal.timeout(TP_TIMEOUT_MS),
  })
  if (res.status === 401 && !retried) {
    auth = null
    return tpGet<T>(path, true)
  }
  // Roteste tokenul daca serverul intoarce unul nou (altfel urmatoarea cerere ar da 401)
  const newAt = res.headers.get('access-token')
  if (newAt) {
    const expiry = Number(res.headers.get('expiry'))
    auth = {
      accessToken: newAt,
      client: res.headers.get('client') || auth.client,
      uid: res.headers.get('uid') || auth.uid,
      expiresAt: expiry > 0 ? expiry * 1000 : auth.expiresAt,
    }
  }
  if (!res.ok) throw new Error(`2Performant GET ${path} -> ${res.status}`)
  return res.json() as Promise<T>
}

export interface TpProgram {
  id: number
  name: string
  base_url: string
  main_url: string
  unique_code: string
  status: string
  currency: string
  affrequest?: { status: string; commission_sale_rate?: string | null }
  default_sale_commission_rate?: string | null
}

interface ProgramsResponse {
  programs: TpProgram[]
  metadata?: { pagination?: { current_page?: number; total_pages?: number } }
}

// Programele la care esti acceptat (filter[relation]=accepted), paginat.
export async function getAcceptedPrograms(): Promise<TpProgram[]> {
  const all: TpProgram[] = []
  let page = 1
  for (;;) {
    const j = await tpGet<ProgramsResponse>(`/affiliate/programs.json?page=${page}&perpage=100&filter[relation]=accepted`)
    const arr = j.programs ?? []
    all.push(...arr)
    const totalPages = j.metadata?.pagination?.total_pages
    if (!arr.length || arr.length < 100 || (totalPages && page >= totalPages)) break
    page++
    if (page > 50) break // plasa de siguranta
  }
  return all
}

// Comisionul de vanzare (rata negociata din affrequest, altfel cea default), ca procent.
export function programCommission(p: TpProgram): number | null {
  const raw = p.affrequest?.commission_sale_rate ?? p.default_sale_commission_rate
  if (raw == null) return null
  const n = parseFloat(String(raw).replace(',', '.'))
  return isNaN(n) ? null : n
}

// Quicklink 2Performant: aff_code = codul tau de marketer, unique = unique_code-ul programului.
export function buildQuicklink(productUrl: string, programUniqueCode: string, affCode: string): string {
  return `https://event.2performant.com/events/click?ad_type=quicklink&aff_code=${affCode}&unique=${programUniqueCode}&redirect_to=${encodeURIComponent(productUrl)}`
}

// --- Comisioane (tracking conversii → Google Ads) --------------------------------------------
//
// GET /affiliate/commissions.json (documentatia oficiala: doc.2performant.com, grupul
// „Affiliate Commissions”, „01. GET Commissions”). Verificat live pe 2026-10-03 (doar citire):
//   - subtag-ul `st` de pe quicklink (click_id-ul nostru, pus de /go) se intoarce in campul
//     `stats_tags` al comisionului — documentat ca „array”, dar API-ul real trimite un TEXT
//     ("" cand linkul n-a avut st). Mai multe taguri = separate prin virgula (st=tag1,tag2 —
//     articolul de suport 2Performant „How to add TAGs in affiliate links”). Acelasi text apare
//     si in public_click_data.stats_tags. Tratam defensiv ambele forme (text sau lista).
//   - statusuri: pending | accepted | rejected | paid;
//   - `amount` e in moneda contului de afiliat (la noi EUR!), `amount_in_working_currency` in
//     moneda programului (`working_currency_code`, RON la evomag). La Google trimitem RON.
//   - paginare: metadata.pagination.pages (0 cand nu sunt rezultate); filtrele start_date /
//     end_date selecteaza dupa data CREARII comisionului (aprobarea nu o muta).
//   - public_action_data.source_ip / public_click_data.source_ip = IP-ul cumparatorului → NU
//     il pastram (sanitizeTpCommission), regula „fara date personale”.
export interface TpCommissionRaw {
  id: number | string
  status: string
  amount?: string | number | null
  currency?: string | null
  amount_in_working_currency?: string | number | null
  working_currency_code?: string | null
  created_at: string                       // ISO UTC, ex. 2026-07-01T10:00:00Z
  updated_at?: string
  stats_tags?: string | string[] | null
  program_id?: number | string | null
  type?: string                            // sale | lostorder
  transaction_id?: string | null           // documentat, absent in raspunsul real
  program?: { name?: string; slug?: string } | null
  public_action_data?: { created_at?: string; source_ip?: string; [k: string]: unknown } | null
  public_click_data?: { created_at?: string; source_ip?: string; stats_tags?: string | string[] | null; [k: string]: unknown } | null
  [k: string]: unknown
}

export type TpStatus = 'pending' | 'approved' | 'rejected'

export interface TpParsedCommission {
  externalId: string                       // id-ul comisionului 2P (unic); la Google: `2p-<id>`
  clickId: string | null
  advertiserId: string                     // program_id
  status: TpStatus
  amount: number                           // RON, rotunjit la 2 zecimale
  orderTime: Date
  unknownStatus?: string                   // status necunoscut (tratat ca pending) — de logat
  currencyIssue?: string                   // nicio suma in RON → amount = 0 (nu se trimite)
}

const TP_STATUS_MAP: Record<string, TpStatus> = {
  pending: 'pending',
  accepted: 'approved',
  paid: 'approved',          // „platit” = aprobat si deja incasat
  rejected: 'rejected',
}

// Acelasi format ca click_id-ul generat de /go (web/src/lib/subid.ts: 12 × [a-z0-9]); acceptam
// 6–32 ca la Profitshare, ca o schimbare de lungime sa nu rupa potrivirea.
const CLICK_ID_RE = /^[a-z0-9]{6,32}$/i

// Extrage click_id-ul din stats_tags: text "abc,def" sau lista ["abc","def"]; ignoram
// parantezele/ghilimelele (in caz ca serverul serializeaza lista ca text) si tagurile care nu
// arata ca un click_id (ex. un tag manual „PPC campaign” — spatiul face parte din tag, deci
// impartim DOAR dupa virgula). Primul tag valid castiga.
export function clickIdFromStatsTags(v: unknown): string | null {
  if (v == null) return null
  const text = Array.isArray(v) ? v.map(String).join(',') : String(v)
  for (const tok of text.replace(/[[\]"']/g, '').split(',')) {
    const t = tok.trim()
    if (CLICK_ID_RE.test(t)) return t.toLowerCase()
  }
  return null
}

function num(v: unknown): number {
  const n = parseFloat(String(v ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : NaN
}

// Suma in RON: din moneda programului daca e RON, altfel din moneda contului daca e RON.
// Nu convertim noi cursul — fara o suma in RON nu trimitem nimic (amount = 0 + avertisment).
function ronAmount(raw: TpCommissionRaw): { amount: number; issue?: string } {
  const wc = String(raw.working_currency_code ?? '').toUpperCase()
  const cur = String(raw.currency ?? '').toUpperCase()
  if (wc === 'RON' && Number.isFinite(num(raw.amount_in_working_currency))) return { amount: num(raw.amount_in_working_currency) }
  if (cur === 'RON' && Number.isFinite(num(raw.amount))) return { amount: num(raw.amount) }
  return { amount: 0, issue: `${cur || '?'}/${wc || '?'}` }
}

export function parseTpCommission(raw: TpCommissionRaw): TpParsedCommission {
  const st = String(raw.status ?? '').toLowerCase().trim()
  const { amount, issue } = ronAmount(raw)
  // Momentul vanzarii: crearea actiunii (vanzarea), altfel crearea comisionului
  const when = raw.public_action_data?.created_at || raw.created_at
  const orderTime = new Date(when)
  if (Number.isNaN(orderTime.getTime())) throw new Error(`Dată 2Performant nerecunoscută: „${when}”`)
  return {
    externalId: String(raw.id),
    clickId: clickIdFromStatsTags(raw.stats_tags) ?? clickIdFromStatsTags(raw.public_click_data?.stats_tags),
    advertiserId: String(raw.program_id ?? ''),
    status: TP_STATUS_MAP[st] ?? 'pending',
    amount: Math.round(amount * 100) / 100,
    orderTime,
    ...(TP_STATUS_MAP[st] ? {} : { unknownStatus: st || '(gol)' }),
    ...(issue ? { currencyIssue: issue } : {}),
  }
}

// Copia pastrata in affiliate_conversions.raw_payload: fara IP-ul cumparatorului.
export function sanitizeTpCommission(raw: TpCommissionRaw): TpCommissionRaw {
  const c = structuredClone(raw)
  if (c.public_action_data) delete c.public_action_data.source_ip
  if (c.public_click_data) delete c.public_click_data.source_ip
  return c
}

interface CommissionsResponse {
  commissions?: TpCommissionRaw[]
  metadata?: { pagination?: { pages?: number; current_page?: number; results?: number } }
}

// Comisioanele create in ultimele `days` zile, toate paginile. Endpoint „throttled”
// (max 100 cereri/minut, apoi 5 minute de 429) — la 100/pagina suntem departe de limita.
export async function getTpCommissions(days = 90, now = new Date()): Promise<TpCommissionRaw[]> {
  const ymd = (d: Date) => d.toISOString().slice(0, 10)
  const from = new Date(now.getTime() - days * 86400_000)
  const all: TpCommissionRaw[] = []
  for (let page = 1; page <= 100; page++) {   // 100 pagini × 100 = plasa de siguranta
    const j = await tpGet<CommissionsResponse>(
      `/affiliate/commissions.json?page=${page}&perpage=100&filter[start_date]=${ymd(from)}&filter[end_date]=${ymd(now)}`)
    const arr = j.commissions ?? []
    all.push(...arr)
    const pages = j.metadata?.pagination?.pages ?? 1
    if (!arr.length || page >= pages) break
  }
  return all
}

// 2Performant e optional: fara credentiale, sync-ul il sare (ca la syncAdvertisers).
export function twoPerformantConfigured(): boolean {
  return !!(process.env.TWOPERFORMANT_EMAIL && process.env.TWOPERFORMANT_PASSWORD)
}
