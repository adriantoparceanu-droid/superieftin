import { createSign } from 'crypto'
import { readFileSync, existsSync } from 'fs'

// Client minimal pentru GA4 Data API (doar CITIRE), fara biblioteci noi — la fel ca integrarea
// Google Ads (fetch direct). Autentificare cu un cont de serviciu care are rolul Viewer in GA4.
//
// .env:
//   GA4_PROPERTY_ID=123456789                  (numeric: GA4 → Admin → Detalii proprietate)
//   GA4_SERVICE_ACCOUNT_JSON= cheia contului de serviciu, in oricare din formele:
//     - base64 (RECOMANDAT, mai ales pe VPS: fara ghilimele sau acolade care se strica in
//       docker compose): base64 -i cheie.json | tr -d '\n'
//     - JSON pe un singur rand: {"type":"service_account",...}
//     - calea spre fisierul cheii: /cale/cheie.json
//
// Scope-urile sunt analytics.readonly + webmasters.readonly: contul NU poate modifica nimic in
// GA4 sau Search Console (REGULI.md → GA4).

// Acelasi cont de serviciu citeste si Search Console (cuvintele cheie organice) — tot DOAR citire.
// Search Console cere in plus: API-ul activat in Cloud + contul adaugat ca utilizator „Restricționat”.
const SCOPE = 'https://www.googleapis.com/auth/analytics.readonly https://www.googleapis.com/auth/webmasters.readonly'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const API = 'https://analyticsdata.googleapis.com/v1beta'

export interface Ga4Config { propertyId: string; clientEmail: string; privateKey: string }

export class Ga4Error extends Error {
  constructor(message: string, public httpStatus?: number) { super(message) }
}

// null = GA4 nu e configurat (lipsesc variabilele) — jobul se opreste linistit, fara eroare.
export function ga4ConfigFromEnv(env: Record<string, string | undefined> = process.env): Ga4Config | null {
  const propertyId = env.GA4_PROPERTY_ID?.trim()
  const raw = env.GA4_SERVICE_ACCOUNT_JSON?.trim()
  if (!propertyId || !raw) return null
  if (!/^\d+$/.test(propertyId)) throw new Ga4Error(`GA4_PROPERTY_ID trebuie să fie numeric (ex. 123456789), nu „${propertyId}” — nu ID-ul de măsurare G-…`)
  const json = raw.startsWith('{') ? raw
    : existsSync(raw) ? readFileSync(raw, 'utf8')
    : Buffer.from(raw, 'base64').toString('utf8')
  let key: { client_email?: string; private_key?: string }
  try {
    key = JSON.parse(json)
  } catch {
    throw new Ga4Error('GA4_SERVICE_ACCOUNT_JSON nu e nici JSON, nici base64 valid, nici calea unui fișier existent')
  }
  if (!key.client_email || !key.private_key) throw new Ga4Error('GA4_SERVICE_ACCOUNT_JSON nu conține client_email / private_key (e cheia JSON a contului de serviciu?)')
  return { propertyId, clientEmail: key.client_email, privateKey: key.private_key }
}

const b64url = (s: string | Buffer) => Buffer.from(s).toString('base64url')

// Token de acces din cheia contului de serviciu (JWT semnat RS256, valabil o ora). Il pastram
// in memorie si il reinnoim cu 5 minute inainte sa expire.
let cached: { token: string; exp: number; email: string } | null = null

export async function accessToken(cfg: Ga4Config): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  if (cached && cached.email === cfg.clientEmail && cached.exp - 300 > now) return cached.token

  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = b64url(JSON.stringify({ iss: cfg.clientEmail, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 }))
  const signature = createSign('RSA-SHA256').update(`${header}.${claims}`).sign(cfg.privateKey).toString('base64url')

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${header}.${claims}.${signature}` }),
    signal: AbortSignal.timeout(20000),
  })
  const data = await res.json().catch(() => ({})) as { access_token?: string; expires_in?: number; error?: string; error_description?: string }
  if (!res.ok || !data.access_token) throw new Ga4Error(`Token GA4 refuzat: ${data.error ?? res.status} ${data.error_description ?? ''}`.trim(), res.status)
  cached = { token: data.access_token, exp: now + (data.expires_in ?? 3600), email: cfg.clientEmail }
  return cached.token
}

// Cererea si raspunsul runReport, doar campurile pe care le folosim
export interface ReportRequest {
  dateRanges: { startDate: string; endDate: string }[]
  dimensions: { name: string }[]
  metrics: { name: string }[]
  dimensionFilter?: unknown
  limit?: number
}
export interface ReportResponse {
  dimensionHeaders?: { name: string }[]
  metricHeaders?: { name: string }[]
  rows?: { dimensionValues: { value: string }[]; metricValues: { value: string }[] }[]
  rowCount?: number
  metadata?: { timeZone?: string }
}

export async function runReport(cfg: Ga4Config, body: ReportRequest): Promise<ReportResponse> {
  const res = await fetch(`${API}/properties/${cfg.propertyId}:runReport`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await accessToken(cfg)}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  })
  const data = await res.json().catch(() => ({})) as ReportResponse & { error?: { message?: string; status?: string } }
  if (!res.ok) throw new Ga4Error(`GA4 runReport ${res.status} ${data.error?.status ?? ''}: ${data.error?.message ?? ''}`.trim(), res.status)
  return data
}

// Metadatele proprietatii: numele dimensiunilor disponibile (inclusiv cele personalizate,
// ex. customEvent:merchant_name — exista doar daca proprietarul le-a inregistrat in GA4).
export async function availableDimensions(cfg: Ga4Config): Promise<Set<string>> {
  const res = await fetch(`${API}/properties/${cfg.propertyId}/metadata`, {
    headers: { Authorization: `Bearer ${await accessToken(cfg)}` },
    signal: AbortSignal.timeout(30000),
  })
  const data = await res.json().catch(() => ({})) as { dimensions?: { apiName: string }[]; error?: { message?: string } }
  if (!res.ok) throw new Ga4Error(`GA4 metadata ${res.status}: ${data.error?.message ?? ''}`.trim(), res.status)
  return new Set((data.dimensions ?? []).map((d) => d.apiName))
}
