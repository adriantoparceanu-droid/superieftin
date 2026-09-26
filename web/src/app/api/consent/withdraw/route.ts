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
// 413 corp prea mare, 429 prea multe cereri; alte metode decat POST → 405, automat din Next).

const MAX_BODY = 2000                 // 3 ID-uri × max. 300 caractere + nume de campuri
const LIMIT = 10                      // cereri per IP ...
const WINDOW_MS = 10 * 60_000         // ... la 10 minute (un vizitator real trimite una)

const empty = (status: number) => new Response(null, { status, headers: { 'Cache-Control': 'no-store' } })

// R6: corpul se citeste cu plafon, ca un POST urias sa nu fie tinut intreg in memorie inainte de
// verificarea lungimii (req.text() citea tot, apoi compara).
//   - Content-Length prezent si > MAX_BODY → 413 imediat, fara sa citim nimic;
//   - Content-Length invalid (nu e numar) → 400;
//   - Content-Length lipsa (corp „chunked”) → NU respingem cu 411: sendBeacon/fetch trimit de
//     regula lungimea, dar nu vrem sa pierdem o retragere legitima din cauza unui proxy care o
//     scoate. In schimb citim bucata cu bucata si ne oprim (413) cand depasim MAX_BODY.
// Returneaza textul sau un cod HTTP de eroare.
async function readLimitedBody(req: NextRequest): Promise<string | number> {
  const lenHeader = req.headers.get('content-length')
  if (lenHeader !== null) {
    if (!/^\d+$/.test(lenHeader.trim())) return 400
    if (Number(lenHeader) > MAX_BODY) return 413
  }
  if (!req.body) return ''
  const reader = req.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > MAX_BODY) { void reader.cancel().catch(() => {}); return 413 }
      chunks.push(value)
    }
  } catch {
    return 400                            // conexiune intrerupta / corp stricat
  }
  const buf = new Uint8Array(total)
  let off = 0
  for (const c of chunks) { buf.set(c, off); off += c.byteLength }
  return new TextDecoder().decode(buf)
}

export async function POST(req: NextRequest) {
  if (!rateLimit(`withdraw:${clientIp(req.headers)}`, LIMIT, WINDOW_MS)) return empty(429)

  const body = await readLimitedBody(req)
  if (typeof body === 'number') return empty(body)
  const text = body
  if (!text) return empty(400)

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
