import { NextRequest } from 'next/server'
import pool from '@/lib/db'
import { SAFE_AD_ID } from '@/lib/adclick'
import { rateLimit, clientIp } from '@/lib/rate-limit'

// POST /api/consent/withdraw — retragerea acordului „Publicitate” (GDPR, Poarta 2 — B4).
//
// Cand vizitatorul isi retrage acordul, AdClickCapture trimite (sendBeacon) ID-ul clickului pe
// reclama din cookie-ul se_gclid, inainte sa stearga cookie-ul. Aici golim acel ID din toate
// clickurile /go inregistrate cu el si marcam has_ad_consent=false → workerul (tracking:sync)
// nu mai trimite la Google conversii pentru ele (planSync le sare ca „fara_acord”).
// Conversiile deja trimise inainte de retragere raman (au fost trimise cu temei legal).
//
// Primeste DOAR gclid/gbraid/wbraid (form-urlencoded, ca de la sendBeacon), nicio alta data.
// Nu salveaza nimic nou si nu logheaza ID-ul. Raspuns: 204 fara continut (400 input invalid,
// 429 prea multe cereri).

const MAX_BODY = 2000                 // 3 ID-uri × max. 300 caractere + nume de campuri
const LIMIT = 10                      // cereri per IP ...
const WINDOW_MS = 10 * 60_000         // ... la 10 minute (un vizitator real trimite una)

const empty = (status: number) => new Response(null, { status, headers: { 'Cache-Control': 'no-store' } })

export async function POST(req: NextRequest) {
  if (!rateLimit(`withdraw:${clientIp(req.headers)}`, LIMIT, WINDOW_MS)) return empty(429)

  const text = await req.text().catch(() => '')
  if (!text || text.length > MAX_BODY) return empty(400)

  const params = new URLSearchParams(text)
  // Orice camp necunoscut = cerere invalida: nu acceptam „si alte date” pe langa ID-uri
  for (const k of params.keys()) if (!['gclid', 'gbraid', 'wbraid'].includes(k)) return empty(400)

  // Construim WHERE doar din ID-urile prezente si valide — niciodata „gclid = NULL”/„IS NULL”,
  // care ar putea atinge alte randuri.
  const conds: string[] = []
  const values: string[] = []
  for (const k of ['gclid', 'gbraid', 'wbraid'] as const) {
    const all = params.getAll(k)
    if (all.length === 0) continue
    if (all.length > 1 || !SAFE_AD_ID.test(all[0])) return empty(400)
    values.push(all[0])
    conds.push(`${k} = $${values.length}`)       // k vine din lista fixa de mai sus, nu din cerere
  }
  if (conds.length === 0) return empty(400)

  try {
    await pool.query(
      `UPDATE ad_clicks SET gclid = NULL, gbraid = NULL, wbraid = NULL, has_ad_consent = false
       WHERE ${conds.join(' OR ')}`,
      values,
    )
  } catch (err) {
    // Fara ID in log (mesajul erorii pg nu include parametrii)
    console.error('consent/withdraw: UPDATE ad_clicks esuat', (err as Error)?.message)
    return empty(500)
  }
  return empty(204)
}
