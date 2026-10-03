// Logica pura a sincronizarii comisioane → Google Ads (fara DB, fara retea), ca sa poata fi
// testata unitar: ce comisioane se trimit, ce se retrage, ce se sare si de ce.
// Folosita de tracking/sync.ts (rularea reala) si de tracking/core.test.ts.

// Google accepta conversii doar pentru clickuri din ultimele 90 de zile (fereastra maxima a
// actiunii de conversie) — dupa aceea gclid-ul nu mai foloseste la nimic si il stergem.
// Cele 90 de zile se socotesc de la clickul PE RECLAMA (ad_clicks.ad_click_at, migratia 022),
// nu de la clickul /go spre magazin — asa socoteste si Google.
export const CLICK_WINDOW_DAYS = 90
const DAY = 86400_000

export type AffiliateNetwork = 'profitshare' | '2performant'

// ID-ul comenzii trimis la Google (transactionId la upload = orderId la retragere). Trebuie sa fie
// UNIC intre retele (Google deduplica dupa el in cadrul actiunii de conversie):
//   - Profitshare: order_id-ul GOL, exact ca inainte — conversiile deja urcate au acest ID, iar
//     o schimbare de format le-ar face sa para comenzi noi (dubluri) si ar rupe retragerile;
//   - 2Performant: `2p-<id comision>` — prefixul evita coliziunea cu un order_id Profitshare.
export function googleOrderId(network: AffiliateNetwork | string, externalId: string): string {
  if (network === 'profitshare') return externalId
  if (network === '2performant') return `2p-${externalId}`
  throw new Error(`Rețea necunoscută pentru orderId: „${network}”`)
}

// Un comision din affiliate_conversions, cu datele clickului potrivit (LEFT JOIN ad_clicks).
export interface ConversionRow {
  id: number
  network: AffiliateNetwork
  externalId: string
  status: 'pending' | 'approved' | 'rejected'
  amount: number
  orderTime: Date
  uploadedAt: Date | null
  uploadedValue: number | null
  retractedAt: Date | null
  clickId: string | null
  adClickId: number | null
  hasAdConsent: boolean | null
  isInternal?: boolean | null   // click intern (admin / robot / test — migratia 027)
  gclid: string | null
  gbraid: string | null
  wbraid: string | null
  clickTime: Date | null        // COALESCE(ad_click_at, created_at): momentul clickului pe reclama
}

export type SkipReason =
  | 'fara_click_id'        // comanda fara subID (link vechi / din afara /go)
  | 'click_negasit'        // hash necunoscut (click sters sau alt site)
  | 'click_intern'         // comanda din browserul adminului / un test — nu invatam Google din ea
  | 'fara_acord'           // clickul s-a facut fara acordul „Publicitate” → nu trimitem nimic la Google
  | 'fara_id_google'       // cu acord, dar vizitatorul n-a venit dintr-o reclama Google
  | 'valoare_zero'
  | 'click_expirat'        // click mai vechi de 90 de zile — Google l-ar respinge
  | 'respins_netrimis'     // anulat inainte sa-l fi trimis — nimic de facut

export interface SyncPlan {
  uploads: ConversionRow[]
  retractions: ConversionRow[]
  alreadyUploaded: number
  valueChanged: ConversionRow[]      // trimis cu alta valoare decat cea curenta (doar logam)
  skipped: Record<SkipReason, number>
}

export function emptySkipped(): Record<SkipReason, number> {
  return { fara_click_id: 0, click_negasit: 0, click_intern: 0, fara_acord: 0, fara_id_google: 0, valoare_zero: 0, click_expirat: 0, respins_netrimis: 0 }
}

// Decide pentru fiecare comision: trimitere, retragere sau nimic. Idempotent prin constructie:
// ce are uploaded_at nu se mai trimite, ce are retracted_at nu se mai retrage.
export function planSync(rows: ConversionRow[], now = new Date()): SyncPlan {
  const plan: SyncPlan = { uploads: [], retractions: [], alreadyUploaded: 0, valueChanged: [], skipped: emptySkipped() }
  for (const r of rows) {
    if (r.status === 'rejected') {
      if (r.uploadedAt && !r.retractedAt) plan.retractions.push(r)
      else if (!r.uploadedAt) plan.skipped.respins_netrimis++
      continue
    }
    if (r.uploadedAt) {
      plan.alreadyUploaded++
      if (r.uploadedValue != null && Math.abs(r.uploadedValue - r.amount) >= 0.01) plan.valueChanged.push(r)
      continue
    }
    if (!r.clickId) { plan.skipped.fara_click_id++; continue }
    if (!r.adClickId) { plan.skipped.click_negasit++; continue }
    if (r.isInternal) { plan.skipped.click_intern++; continue }
    // Regula 7 (GDPR): fara acord la momentul clickului, NIMIC nu pleaca la Google
    if (!r.hasAdConsent) { plan.skipped.fara_acord++; continue }
    if (!(r.gclid || r.gbraid || r.wbraid)) { plan.skipped.fara_id_google++; continue }
    if (!(r.amount > 0)) { plan.skipped.valoare_zero++; continue }
    if (!r.clickTime || now.getTime() - r.clickTime.getTime() > CLICK_WINDOW_DAYS * DAY) { plan.skipped.click_expirat++; continue }
    plan.uploads.push(r)
  }
  return plan
}

// Ora in fusul Romaniei (fusul contului Google Ads), cu offset explicit.
//   'rfc3339' → 2026-09-25T12:00:00+03:00   (Data Manager API)
//   'ads'     → 2026-09-25 12:00:00+03:00   (Google Ads API, conversion adjustments)
export function formatRo(d: Date, style: 'rfc3339' | 'ads'): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Bucharest', hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(d)
  const g = (t: string) => parts.find((p) => p.type === t)!.value
  const localAsUtc = Date.UTC(+g('year'), +g('month') - 1, +g('day'), +g('hour'), +g('minute'), +g('second'))
  const offMin = Math.round((localAsUtc - Math.floor(d.getTime() / 1000) * 1000) / 60000)
  const sign = offMin >= 0 ? '+' : '-'
  const off = `${sign}${String(Math.floor(Math.abs(offMin) / 60)).padStart(2, '0')}:${String(Math.abs(offMin) % 60).padStart(2, '0')}`
  const date = `${g('year')}-${g('month')}-${g('day')}`
  const time = `${g('hour')}:${g('minute')}:${g('second')}`
  return style === 'rfc3339' ? `${date}T${time}${off}` : `${date} ${time}${off}`
}

// In loguri nu scriem identificatorii Google intregi — doar ultimele 4 caractere, ca sa
// putem recunoaste un rand fara sa expunem ID-ul.
export function maskId(r: Pick<ConversionRow, 'gclid' | 'gbraid' | 'wbraid'>): string {
  const [k, v] = r.gclid ? ['gclid', r.gclid] : r.gbraid ? ['gbraid', r.gbraid] : r.wbraid ? ['wbraid', r.wbraid] : ['-', '']
  return v ? `${k}:…${v.slice(-4)}` : '-'
}

// Acelasi lucru pentru textul erorilor (last_error in DB, erorile din log): mesajele Google pot
// cita gclid-ul trimis. Inlocuim orice aparitie a ID-urilor randului cu forma mascata, ca in
// baza de date sa nu ramana ID-uri intregi dupa stergerea de retentie (Poarta 2 — R3).
export function maskIdsInText(text: string, r: Pick<ConversionRow, 'gclid' | 'gbraid' | 'wbraid'>): string {
  let out = text
  for (const v of [r.gclid, r.gbraid, r.wbraid]) {
    if (v && v.length >= 5) out = out.split(v).join(`…${v.slice(-4)}`)
  }
  return out
}
