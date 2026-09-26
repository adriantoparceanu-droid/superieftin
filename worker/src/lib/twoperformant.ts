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
