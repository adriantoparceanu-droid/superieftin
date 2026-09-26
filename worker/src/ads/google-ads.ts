// Client REST minimal pentru Google Ads API (fara librarie — alegerea finala a librariei
// ramane deschisa, vezi raport-faza-0.md §6). Doar ce ne trebuie: token de acces, GAQL
// (citire) si mutate-uri cu validate_only.
//
// REGULI.md regula 4: ADS_ENV=test → orice scriere pleaca cu validate_only (Google verifica,
// nu aplica). Scrierea reala cere ADS_ENV=prod — iar scripturile care scriu cer in plus
// --prod si --confirm (regula 3).

export const API_VERSION = 'v25'   // cea mai noua versiune la 2026-09-26
const BASE = `https://googleads.googleapis.com/${API_VERSION}`

export interface AdsConfig {
  clientId: string
  clientSecret: string
  refreshToken: string
  customerId: string            // contul de reclame, fara liniute
  loginCustomerId?: string      // doar daca se lucreaza printr-un MCC (la noi: gol)
  developerToken?: string       // din 9 sep 2026 nu ar mai trebui; se trimite doar daca exista
  env: 'test' | 'prod'
}

export function configFromEnv(): AdsConfig {
  const need = (k: string) => {
    const v = process.env[k]?.trim()
    if (!v) throw new Error(`Lipsește ${k} din .env`)
    return v
  }
  const env = (process.env.ADS_ENV || 'test').trim()
  if (env !== 'test' && env !== 'prod') throw new Error(`ADS_ENV trebuie să fie test sau prod, nu „${env}”`)
  return {
    clientId: need('GOOGLE_ADS_CLIENT_ID'),
    clientSecret: need('GOOGLE_ADS_CLIENT_SECRET'),
    refreshToken: need('GOOGLE_ADS_REFRESH_TOKEN'),
    customerId: need('GOOGLE_ADS_CUSTOMER_ID_PROD').replace(/-/g, ''),
    loginCustomerId: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID?.trim().replace(/-/g, '') || undefined,
    developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim() || undefined,
    env,
  }
}

// Eroare Google Ads cu detaliile utile (coduri), fara date sensibile
export class AdsApiError extends Error {
  constructor(public httpStatus: number, public codes: string[], message: string, public raw: unknown) {
    super(message)
  }
}

let cachedToken: { value: string; expiresAt: number } | null = null

export async function accessToken(cfg: AdsConfig): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: cfg.clientId, client_secret: cfg.clientSecret,
      refresh_token: cfg.refreshToken, grant_type: 'refresh_token',
    }),
  })
  const data = await res.json() as { access_token?: string; expires_in?: number; error?: string; error_description?: string }
  if (!res.ok || !data.access_token) {
    throw new AdsApiError(res.status, [data.error ?? 'oauth_error'], `Refresh token respins: ${data.error} ${data.error_description ?? ''}`.trim(), data)
  }
  cachedToken = { value: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 }
  return data.access_token
}

// Extrage codurile de eroare utile dintr-un raspuns de eroare Google (Ads API sau Data Manager).
// Formate: Ads → details[].errors[].errorCode {cheie: VALOARE}; API-uri Google generice →
// details[].reason (ErrorInfo) si details[].fieldViolations[] (BadRequest).
export function errorCodes(data: any): string[] {
  const codes: string[] = []
  for (const d of data?.error?.details ?? data?.details ?? []) {
    for (const e of d?.errors ?? []) codes.push(...Object.entries(e.errorCode ?? {}).map(([k, v]) => `${k}.${v}`))
    if (d?.reason) codes.push(d.reason)
    for (const v of d?.fieldViolations ?? []) codes.push(`${v.field ?? '?'}: ${v.reason ?? v.description ?? ''}`.trim())
  }
  if (!codes.length && data?.error?.status) codes.push(data.error.status)
  return codes
}

async function call<T>(cfg: AdsConfig, method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${await accessToken(cfg)}`,
    'Content-Type': 'application/json',
  }
  if (cfg.developerToken) headers['developer-token'] = cfg.developerToken
  if (cfg.loginCustomerId) headers['login-customer-id'] = cfg.loginCustomerId

  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined })
  const text = await res.text()
  let data: any
  try { data = text ? JSON.parse(text) : {} } catch { data = { raw: text.slice(0, 300) } }
  if (!res.ok) {
    // Codurile specifice Google Ads stau in error.details[].errors[].errorCode
    const codes = errorCodes(data)
    const msg = data?.error?.details?.[0]?.errors?.[0]?.message ?? data?.error?.message ?? `HTTP ${res.status}`
    throw new AdsApiError(res.status, codes, msg, data)
  }
  return data as T
}

export function listAccessibleCustomers(cfg: AdsConfig) {
  return call<{ resourceNames?: string[] }>(cfg, 'GET', '/customers:listAccessibleCustomers')
}

// Citire GAQL (permisa in ambele moduri)
export function search<T = any>(cfg: AdsConfig, query: string) {
  return call<{ results?: T[] }>(cfg, 'POST', `/customers/${cfg.customerId}/googleAds:search`, { query })
}

// Citire GAQL cu toate paginile (search intoarce max. 10.000 de randuri pe pagina)
export async function searchAll<T = any>(cfg: AdsConfig, query: string): Promise<T[]> {
  const out: T[] = []
  let pageToken: string | undefined
  do {
    const r = await call<{ results?: T[]; nextPageToken?: string }>(cfg, 'POST',
      `/customers/${cfg.customerId}/googleAds:search`, pageToken ? { query, pageToken } : { query })
    out.push(...(r.results ?? []))
    pageToken = r.nextPageToken
  } while (pageToken)
  return out
}

// Scriere. In ADS_ENV=test pleaca OBLIGATORIU cu validateOnly (regula 4) — nu se poate ocoli
// din apelant. In prod, apelantul trebuie sa fi verificat deja --prod + --confirm.
export function mutate<T = any>(cfg: AdsConfig, resource: string, operations: unknown[], opts: { validateOnly?: boolean } = {}) {
  const validateOnly = cfg.env === 'test' ? true : opts.validateOnly ?? false
  return call<T>(cfg, 'POST', `/customers/${cfg.customerId}/${resource}:mutate`, { operations, validateOnly })
}

// Scriere „la gramada” (GoogleAdsService.Mutate): mai multe tipuri de resurse intr-o singura
// cerere, ATOMIC (ori se aplica toate, ori niciuna) si cu ID-uri temporare (negative) ca o
// campanie noua sa poata fi legata de bugetul/grupurile create in aceeasi cerere.
// Aceeasi regula 4: in ADS_ENV=test pleaca OBLIGATORIU cu validateOnly.
export function mutateAll<T = any>(cfg: AdsConfig, mutateOperations: unknown[], opts: { validateOnly?: boolean } = {}) {
  const validateOnly = cfg.env === 'test' ? true : opts.validateOnly ?? false
  return call<T>(cfg, 'POST', `/customers/${cfg.customerId}/googleAds:mutate`, { mutateOperations, validateOnly })
}

// --- Pauza de siguranta (garda zilnica ads-guard) ------------------------------------------------
//
// EXCEPTIE INGUSTA SI EXPLICITA de la regula 4. Garda (campaigns/guard.ts) pune pe pauza un grup
// de anunturi al carui landing nu mai e bun (pagina 404, produs indisponibil, reducere disparuta).
// Pe productie ADS_ENV=test, deci mutate()/mutateAll() ar trimite validate_only si pauza n-ar avea
// loc. Nu ocolim regula in tacere: pauseOnly() accepta EXCLUSIV operatii `update` care pun
// status=PAUSED (campanie / grup / anunt), cu updateMask exact „status”. Orice altceva (create,
// remove, alt camp, alt status, alt cont) → eroare INAINTE de orice cerere.
//
// Cand e reala:
//  - ADS_ENV=prod → da (acolo orice scriere e oricum reala);
//  - ADS_ENV=test → DOAR daca ADS_GUARD_REAL_PAUSE=1 (implicit oprit; il porneste proprietarul).
//    Fara flag, pauza pleaca tot cu validate_only (Google confirma ca ar merge), iar garda doar
//    alerteaza pe Telegram.
// Regula 11: pauza e permisa automat; activarea NICIODATA (nu exista cod care trimite ENABLED).

const PAUSABLE: Record<string, RegExp> = {
  campaignOperation: /^customers\/(\d+)\/campaigns\/\d+$/,
  adGroupOperation: /^customers\/(\d+)\/adGroups\/\d+$/,
  adGroupAdOperation: /^customers\/(\d+)\/adGroupAds\/\d+~\d+$/,
}

// Arunca eroare daca vreo operatie nu e o pauza curata. Functie pura (testata in guard.test.ts).
export function assertPauseOnly(customerId: string, mutateOperations: unknown[]): void {
  if (!Array.isArray(mutateOperations) || !mutateOperations.length) throw new Error('pauseOnly: nicio operație')
  mutateOperations.forEach((raw, i) => {
    const bad = (why: string) => { throw new Error(`pauseOnly: operația #${i} refuzată — ${why}`) }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) bad('nu e un obiect')
    const keys = Object.keys(raw as object)
    if (keys.length !== 1) bad(`trebuie exact un tip de operație, nu ${keys.join(', ') || 'niciunul'}`)
    const kind = keys[0]
    const re = PAUSABLE[kind]
    if (!re) bad(`tipul „${kind}” nu e permis (doar ${Object.keys(PAUSABLE).join(', ')})`)
    const op = (raw as Record<string, any>)[kind]
    if (!op || typeof op !== 'object') bad('operație goală')
    const opKeys = Object.keys(op).sort().join(',')
    if (opKeys !== 'update,updateMask') bad(`doar { update, updateMask } e permis, nu { ${Object.keys(op).join(', ')} }`)
    if (op.updateMask !== 'status') bad(`updateMask trebuie să fie exact „status”, nu „${op.updateMask}”`)
    const u = op.update
    if (!u || typeof u !== 'object' || Array.isArray(u)) bad('update lipsă')
    const uKeys = Object.keys(u).sort().join(',')
    if (uKeys !== 'resourceName,status') bad(`update poate conține doar resourceName și status, nu ${Object.keys(u).join(', ')}`)
    if (u.status !== 'PAUSED') bad(`status „${u.status}” — pauseOnly trimite DOAR PAUSED (activarea o face proprietarul)`)
    const m = typeof u.resourceName === 'string' ? u.resourceName.match(re!) : null
    if (!m) bad(`resourceName invalid pentru ${kind}: ${u.resourceName}`)
    if (m![1] !== customerId) bad(`resourceName e din alt cont (${m![1]}), nu ${customerId}`)
  })
}

// Pauza e reala? (vezi comentariul de mai sus). Functie pura, testata.
export function guardPauseIsReal(adsEnv: AdsConfig['env'], env: Record<string, string | undefined> = process.env): boolean {
  return adsEnv === 'prod' || env.ADS_GUARD_REAL_PAUSE?.trim() === '1'
}

export async function pauseOnly<T = any>(cfg: AdsConfig, mutateOperations: unknown[], env: Record<string, string | undefined> = process.env) {
  assertPauseOnly(cfg.customerId, mutateOperations)
  const validateOnly = !guardPauseIsReal(cfg.env, env)
  const res = await call<T>(cfg, 'POST', `/customers/${cfg.customerId}/googleAds:mutate`, { mutateOperations, validateOnly })
  return { validateOnly, res }
}

// --- Conversii (Faza 2) ------------------------------------------------------------------------

export function conversionActionResource(cfg: AdsConfig, id: string): string {
  return `customers/${cfg.customerId}/conversionActions/${id}`
}

export interface RetractionInput {
  orderId: string                 // = transactionId trimis la upload (order_id Profitshare)
  adjustmentDateTime: string      // "yyyy-mm-dd HH:mm:ss+HH:mm", dupa momentul conversiei
}

// Corpul cererii uploadConversionAdjustments pentru retrageri (comision anulat → conversia
// dispare din raportari si din invatarea licitarii). Identificare prin orderId, deci nu mai
// avem nevoie de gclid (care se sterge dupa 90 de zile).
export function buildRetractionBody(cfg: AdsConfig, conversionActionId: string, items: RetractionInput[], validateOnly: boolean) {
  return {
    conversionAdjustments: items.map((it) => ({
      conversionAction: conversionActionResource(cfg, conversionActionId),
      adjustmentType: 'RETRACTION',
      orderId: it.orderId,
      adjustmentDateTime: it.adjustmentDateTime,
    })),
    partialFailure: true,          // obligatoriu pentru acest serviciu
    validateOnly,
  }
}

export interface PartialFailureResult {
  errorsByIndex: Map<number, string>   // index in lista trimisa → cod + mesaj
  jobId?: string
}

// Erorile per rand dintr-un raspuns cu partialFailure (cererea e 200, erorile stau in
// partialFailureError.details[].errors[] cu location.fieldPathElements[0].index).
export function parsePartialFailure(data: any): PartialFailureResult {
  const errorsByIndex = new Map<number, string>()
  for (const d of data?.partialFailureError?.details ?? []) {
    for (const e of d?.errors ?? []) {
      const idx = e?.location?.fieldPathElements?.[0]?.index ?? 0
      const code = Object.entries(e.errorCode ?? {}).map(([k, v]) => `${k}.${v}`).join(',')
      const prev = errorsByIndex.get(idx)
      const msg = `${code}: ${e.message ?? ''}`.trim()
      errorsByIndex.set(idx, prev ? `${prev}; ${msg}` : msg)
    }
  }
  return { errorsByIndex, jobId: data?.jobId }
}

// Retrageri. In ADS_ENV=test pleaca OBLIGATORIU cu validateOnly (regula 4).
export async function uploadRetractions(cfg: AdsConfig, conversionActionId: string, items: RetractionInput[], opts: { validateOnly?: boolean } = {}) {
  const validateOnly = cfg.env === 'test' ? true : opts.validateOnly ?? false
  const data = await call<any>(cfg, 'POST', `/customers/${cfg.customerId}:uploadConversionAdjustments`,
    buildRetractionBody(cfg, conversionActionId, items, validateOnly))
  return { validateOnly, ...parsePartialFailure(data) }
}
