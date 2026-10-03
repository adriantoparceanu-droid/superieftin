// Alerta de pret de pe pagina de produs (Telegram) — logica pura, testata in price-alert.test.ts.
//
// De ce conteaza (decizia proprietarului, 2026-10-03): la afiliere castiga ULTIMUL click, iar
// ferestrele de click sunt scurte. Vizitatorul care nu cumpara azi revine prin alerta cand
// pretul scade, da un click nou pe „Vezi oferta” si porneste o fereastra noua de comision.
//
// Formatul parametrului de start Telegram e citit de bot (worker/src/lib/price-alert.ts,
// parseAlertStartParam) — modifica-le impreuna.

import { REAL_DISCOUNT_PCT } from './discount'

// Pragul propus: cu REAL_DISCOUNT_PCT (5%) sub cel mai mic dintre pretul de azi si mediana
// pe 30 de zile. Exemple:
//  - pret 2.000, mediana 2.100 → 1.900 (5% sub pretul de azi)
//  - pret 2.400, mediana 2.000 (mai scump decat de obicei) → 1.900 (pragul unei reduceri reale)
//  - pret 1.700, mediana 2.665 (deja reducere) → 1.610 (inca 5% sub pretul de azi)
// Pragul e mereu SUB pretul de azi: altfel alerta ar pleca imediat si ar spune „a ajuns sub
// pragul tau” fara ca pretul sa fi scazut.
export function suggestAlertTarget(currentPrice: number | null, medianPrice: number | null): number | null {
  if (currentPrice == null || !(currentPrice > 0)) return null
  const base = medianPrice != null && medianPrice > 0 ? Math.min(currentPrice, medianPrice) : currentPrice
  const raw = base * (1 - REAL_DISCOUNT_PCT / 100)
  // Rotunjim IN JOS la o suma „rotunda”, usor de citit (rotunjirea in jos pastreaza minim 5%)
  const step = raw >= 1000 ? 10 : raw >= 100 ? 5 : 1
  const target = Math.floor(raw / step) * step
  return target >= 1 ? target : null
}

// Parametrul /start al botului: offer_<id> sau offer_<id>_<prag in lei, intreg>.
// Telegram accepta doar [A-Za-z0-9_-], maxim 64 de caractere.
export function alertStartParam(offerId: string | number, target: number | null): string {
  const id = String(offerId)
  if (!/^\d+$/.test(id)) throw new Error(`offerId invalid: ${id}`)
  return target != null && target >= 1 ? `offer_${id}_${Math.floor(target)}` : `offer_${id}`
}

export function telegramAlertUrl(botUsername: string, offerId: string | number, target: number | null): string {
  return `https://t.me/${encodeURIComponent(botUsername)}?start=${alertStartParam(offerId, target)}`
}
