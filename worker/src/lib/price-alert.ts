// Alerte de pret (bot Telegram + trimiterea alertelor) — logica pura, testata in price-alert.test.ts.
//
// De ce linkul din alerta duce pe /p/ (si NU direct pe /go/ sau la magazin): la afiliere castiga
// ultimul click, iar ferestrele de click sunt scurte. Vizitatorul revine pe pagina produsului,
// vede toate ofertele de azi si da un click NOU pe „Vezi oferta” → /go/ (cu token anti-roboti si
// click_id nou) → fereastra noua de comision. Un link direct spre /go/ din Telegram ar ajunge pe
// pagina intermediara (fara token JS), iar unul direct la magazin n-ar avea click_id deloc.
// UTM-urile arata in GA4 cate vizite aduc alertele (sursa „alerta”).

import { escHtml } from './admin-telegram.js'

// Domeniul canonic. In compose, workerul primeste SITE_URL (nu NEXT_PUBLIC_SITE_URL, care e
// doar arg de build pentru web) — inainte linkurile cadeau pe fallback-ul fara www.
export function siteUrl(env: NodeJS.ProcessEnv = process.env): string {
  const raw = env.SITE_URL || env.NEXT_PUBLIC_SITE_URL || 'https://www.superieftin.ro'
  return raw.replace(/\/+$/, '')
}

export type AlertMedium = 'telegram' | 'email'

export function alertProductUrl(site: string, slug: string, medium: AlertMedium): string {
  const qs = new URLSearchParams({ utm_source: 'alerta', utm_medium: medium, utm_campaign: 'alerta_pret' })
  return `${site.replace(/\/+$/, '')}/p/${encodeURIComponent(slug)}?${qs}`
}

// Parametrul /start trimis de butonul de pe site:
//   prod_<id produs>[_<prag in lei>]  — formatul actual (alerta pe produs, orice magazin)
//   offer_<id oferta>[_<prag>]        — linkuri vechi (pe o oferta); botul le muta pe produsul ofertei
// Formatul il produce web/src/lib/price-alert.ts (alertStartParam) — modifica-le impreuna.
export type AlertStartParam = { productId: number; offerId: null; target: number | null }
  | { productId: null; offerId: number; target: number | null }

export function parseAlertStartParam(param: string | null | undefined): AlertStartParam | null {
  const m = /^(prod|offer)_(\d{1,15})(?:_(\d{1,8}))?$/.exec(param ?? '')
  if (!m) return null
  const id = Number(m[2])
  const t = m[3] != null ? Number(m[3]) : null
  const target = t != null && t >= 1 ? t : null
  return m[1] === 'prod' ? { productId: id, offerId: null, target } : { productId: null, offerId: id, target }
}

// Alerta e pe PRODUS: pleaca atunci cand ORICE oferta disponibila (orice magazin) ajunge la sau
// sub prag. Daca sunt mai multe, o alegem pe cea mai ieftina (la egalitate, id-ul mai mic — stabil).
// Ofertele vin din SQL deja filtrate pe pret <= prag; `available` = aceeasi regula ca pe /p/.
export interface AlertOffer { offerId: number; price: number; retailerName: string; available: boolean }

export function pickTriggerOffer(offers: AlertOffer[] | null | undefined, target: number): AlertOffer | null {
  let best: AlertOffer | null = null
  for (const o of offers ?? []) {
    if (!o.available || !(o.price > 0) || o.price > target) continue
    if (!best || o.price < best.price || (o.price === best.price && o.offerId < best.offerId)) best = o
  }
  return best
}

export const MAX_TARGET_PRICE = 100000

// Pragul trebuie sa fie SUB pretul de azi: altfel alerta pleaca imediat cu „pretul a ajuns la…”
// fara ca pretul sa fi scazut (mesaj inselator). Fara pret curent (oferta disparuta) nu limitam.
export function checkTarget(target: number, currentPrice: number | null): 'ok' | 'invalid' | 'not-below-current' {
  if (!Number.isFinite(target) || target <= 0 || target > MAX_TARGET_PRICE) return 'invalid'
  if (currentPrice != null && currentPrice > 0 && target >= currentPrice) return 'not-below-current'
  return 'ok'
}

// Suma tastata in chat: „800”, „1.299,90”, „1299.9”, „1 299”
export function parseTypedPrice(text: string): number {
  let t = text.trim().replace(/\s/g, '')
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) t = t.replace(/\./g, '')   // 1.299,90 → 1299,90
  t = t.replace(',', '.')
  return /^\d+(\.\d+)?$/.test(t) ? parseFloat(t) : NaN
}

export function formatRon(n: number): string {
  return n.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Mesajul alertei (Telegram). Spune doar ce s-a intamplat (pretul de la magazinul X a ajuns la Y,
// la sau sub pragul ales) — fara „reducere”, procente sau promisiuni (REGULI.md, regula 9).
// Alerta ramane activa (re-armare, lib/alert-rearm.ts): spunem cand anuntam din nou si cum se opreste.
export function buildAlertMessage(a: {
  alertId: number
  productName: string
  retailerName: string
  currentPrice: number
  targetPrice: number
  rearmPrice: number   // pragul + marja de re-armare
  url: string
}): string {
  return [
    '🔔 <b>Alertă de preț</b>',
    '',
    `<b>${escHtml(a.productName)}</b>`,
    `Prețul la ${escHtml(a.retailerName)} a ajuns la <b>${formatRon(a.currentPrice)} RON</b> (pragul tău: ${formatRon(a.targetPrice)} RON).`,
    '',
    'Prețurile se pot schimba oricând — verifică oferta pe pagină înainte să cumperi.',
    `👉 <a href="${escHtml(a.url)}">Vezi produsul și ofertele de azi</a>`,
    '',
    `Alerta rămâne activă: te anunțăm din nou la următoarea scădere la sau sub prag, după ce prețul urcă peste ${formatRon(a.rearmPrice)} RON.`,
    `Oprește alerta: /sterge ${a.alertId} · Toate alertele: /alertele_mele`,
  ].join('\n')
}
