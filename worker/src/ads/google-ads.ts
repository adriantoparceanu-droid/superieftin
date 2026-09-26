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
    const codes: string[] = []
    for (const d of data?.error?.details ?? []) {
      for (const e of d?.errors ?? []) codes.push(...Object.entries(e.errorCode ?? {}).map(([k, v]) => `${k}.${v}`))
      if (d?.reason) codes.push(d.reason)
    }
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

// Scriere. In ADS_ENV=test pleaca OBLIGATORIU cu validateOnly (regula 4) — nu se poate ocoli
// din apelant. In prod, apelantul trebuie sa fi verificat deja --prod + --confirm.
export function mutate<T = any>(cfg: AdsConfig, resource: string, operations: unknown[], opts: { validateOnly?: boolean } = {}) {
  const validateOnly = cfg.env === 'test' ? true : opts.validateOnly ?? false
  return call<T>(cfg, 'POST', `/customers/${cfg.customerId}/${resource}:mutate`, { operations, validateOnly })
}
