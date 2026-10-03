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

// Parametrul /start trimis de butonul de pe site: offer_<id> sau offer_<id>_<prag in lei>.
// Formatul il produce web/src/lib/price-alert.ts (alertStartParam) — modifica-le impreuna.
export function parseAlertStartParam(param: string | null | undefined): { offerId: number; target: number | null } | null {
  const m = /^offer_(\d{1,15})(?:_(\d{1,8}))?$/.exec(param ?? '')
  if (!m) return null
  const offerId = Number(m[1])
  const target = m[2] != null ? Number(m[2]) : null
  return { offerId, target: target != null && target >= 1 ? target : null }
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

// Mesajul alertei. Spune doar ce s-a intamplat (pretul de la magazinul X a ajuns la Y, sub
// pragul ales) — fara „reducere”, procente sau promisiuni (REGULI.md, regula 9).
export function buildAlertMessage(a: {
  productName: string
  retailerName: string
  currentPrice: number
  targetPrice: number
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
    'Alerta s-a oprit după acest mesaj. O poți seta din nou de pe pagina produsului.',
  ].join('\n')
}
