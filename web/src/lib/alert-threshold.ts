// Pragul alertei de preț scris de vizitator (cardul „Alertă de preț” de pe /p/) — logica pură,
// testată în alert-threshold.test.ts. Fără importuri de server: rulează și în browser.
//
// Decizia proprietarului (5 oct. 2026): pragul e un câmp editabil, ORICE sumă pozitivă. Un prag
// la sau peste prețul de azi e acceptat — atunci afișăm un avertisment („alerta pleacă la următoarea verificare”),
// iar alerta pleacă la următoarea verificare. Aceeași parsare o folosește serverul
// (lib/email-alerts.ts → parseTargetPrice), ca browserul și API-ul să accepte exact aceleași sume.

import { formatPrice } from './discount'

// Plafon de bun-simț (o sumă mai mare e aproape sigur o greșeală de tastare)
export const MAX_TARGET_PRICE = 100000

// „1.938”, „1938”, „1 938,50”, „1938.5”, „1.299,90 lei” → număr; altfel null.
// Punctul urmat de grupe de câte 3 cifre = separator de mii (ca în română); virgula = zecimale.
// Minimum 1 leu (formatul linkului Telegram cere un întreg ≥ 1), maximum MAX_TARGET_PRICE.
export function parseLeiAmount(raw: unknown): number | null {
  let t = typeof raw === 'number' ? String(raw) : typeof raw === 'string' ? raw : ''
  t = t.replace(/lei|ron/gi, '').replace(/\s/g, '')
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) t = t.replace(/\./g, '')
  t = t.replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null
  const n = parseFloat(t)
  return n >= 1 && n <= MAX_TARGET_PRICE ? Math.round(n * 100) / 100 : null
}

// Suma în câmp, în format românesc, cu separator de mii și la 4 cifre: 1938 → „1.938”,
// 1938.5 → „1.938,50”. (Nu folosim Intl: unele browsere nu grupează numerele de 4 cifre.)
export function formatLeiInput(n: number): string {
  const [int, dec] = (Math.round(n * 100) / 100).toFixed(2).split('.')
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return dec === '00' ? grouped : `${grouped},${dec}`
}

// Pragul trimis botului Telegram: formatul /start acceptă doar lei întregi (worker/src/lib/
// price-alert.ts). Rotunjim ÎN JOS, ca alerta să nu plece la o sumă peste cea aleasă.
export function telegramTarget(value: number | null): number | null {
  if (value == null) return null
  const t = Math.floor(value)
  return t >= 1 ? t : null
}

export type ThresholdKind = 'ok' | 'warn' | 'err' | 'empty'

export interface ThresholdStatus {
  kind: ThresholdKind
  value: number | null   // pragul valid (și pentru 'warn'), altfel null
  message: string
  showReset: boolean     // „Folosește pragul propus” (doar când pragul diferă de cel propus)
}

// Mesajul live de sub câmp. `today` = cel mai mic preț disponibil acum (null = indisponibil),
// `suggested` = pragul propus (lib/price-alert.ts → suggestAlertTarget).
export function thresholdStatus(raw: string, today: number | null, suggested: number | null): ThresholdStatus {
  const example = suggested ?? (today != null ? Math.max(1, Math.floor(today * 0.95)) : 1500)
  if (raw.trim() === '') {
    return { kind: 'empty', value: null, message: `Scrie suma în lei, de exemplu ${formatLeiInput(example)}.`, showReset: suggested != null }
  }
  const v = parseLeiAmount(raw)
  if (v == null) {
    return { kind: 'err', value: null, message: `Scrie o sumă în lei, de exemplu ${formatLeiInput(example)}.`, showReset: false }
  }
  const showReset = suggested != null && Math.round(v) !== Math.round(suggested)
  if (today == null) {
    return { kind: 'ok', value: v, message: `Te anunțăm când produsul ajunge la ${formatPrice(v)} sau mai jos, la oricare magazin.`, showReset }
  }
  if (v >= today) {
    return { kind: 'warn', value: v, message: `Pragul e la sau peste prețul de azi (${formatPrice(today)}): alerta pleacă la următoarea verificare a prețurilor.`, showReset }
  }
  const pct = Math.round((1 - v / today) * 100)
  return {
    kind: 'ok',
    value: v,
    message: `Te anunțăm la ${formatPrice(v)} sau mai jos${pct >= 1 ? ` (${pct}% sub prețul de azi)` : ''}.`,
    showReset,
  }
}
