// Cardul de verdict de pe /p/ („MERITĂ ACUM?”) — textele și geometria termometrului, pure,
// testate în verdict.test.ts. Pragurile vin din lib/discount.ts (±5% față de mediana 30 de zile).
//
// ATENȚIE (reclame): pentru o reducere reală, fraza „Prețul de azi e cu X% sub mediana pe 30 de
// zile” + titlul „Reducere reală” sunt citite de ads:validate / ads-guard
// (worker/src/ads/campaigns/validate.ts → parsePage). Nu le schimba fără să schimbi și parserul.
// Celelalte stări NU folosesc formularea „e cu X% sub mediana” (ar părea o reducere pentru gardă).

import { formatPct, formatPrice, REAL_DISCOUNT_PCT, ABOVE_MEDIAN_PCT, type DiscountInfo, type DiscountVerdict } from './discount'

import type { FactPart } from './seo/product-facts'

export interface VerdictCopy {
  verdict: DiscountVerdict
  word: string            // „Reducere reală” / „Preț obișnuit” / „Peste prețul obișnuit” / „Monitorizăm prețul”
  pct: string | null      // „−18,2%” / „+7%” / null
  sentence: FactPart[]    // fraza de sub verdict (bucățile { b } îngroșate)
  short: string           // pentru bara fixă de jos: „−18,2% vs. mediană” / „preț obișnuit”
}

export function verdictCopy(info: DiscountInfo, median: number | null): VerdictCopy {
  const p = info.discountPct
  const med = median != null ? formatPrice(median) : null
  switch (info.verdict) {
    case 'real':
      return {
        verdict: 'real',
        word: 'Reducere reală',
        pct: `−${formatPct(p ?? 0)}%`,
        sentence: ['Prețul de azi e cu ', { b: `${formatPct(p ?? 0)}% sub mediana` }, ` pe 30 de zile (${med}).`],
        short: `−${formatPct(p ?? 0)}% vs. mediană`,
      }
    case 'normal': {
      const pct = p == null || p === 0 ? '0%' : `${p > 0 ? '−' : '+'}${formatPct(p)}%`
      const sentence: FactPart[] = p == null || p === 0
        ? ['Prețul de azi e ', { b: 'egal cu mediana' }, ` pe 30 de zile (${med}). Nu e o reducere reală.`]
        : ['Prețul de azi e la ', { b: `${formatPct(p)}% ${p > 0 ? 'sub' : 'peste'} mediană` }, ` (mediana pe 30 de zile: ${med}), în intervalul obișnuit. Nu e o reducere reală.`]
      return { verdict: 'normal', word: 'Preț obișnuit', pct, sentence, short: 'preț obișnuit' }
    }
    case 'higher':
      return {
        verdict: 'higher',
        word: 'Peste prețul obișnuit',
        pct: `+${formatPct(p ?? 0)}%`,
        sentence: ['Prețul de azi e cu ', { b: `${formatPct(p ?? 0)}% peste mediana` }, ` pe 30 de zile (${med}). O alertă de preț te anunță dacă scade.`],
        short: `+${formatPct(p ?? 0)}% vs. mediană`,
      }
    default:
      return {
        verdict: 'no-data',
        word: 'Monitorizăm prețul',
        pct: null,
        sentence: ['Avem încă prea puține prețuri înregistrate pentru o mediană pe 30 de zile, deci nu putem spune dacă e o reducere reală.'],
        short: 'monitorizăm prețul',
      }
  }
}

export interface Thermometer {
  realEnd: number    // % — sfârșitul zonei de reducere (0,95 × mediană), de la stânga
  highStart: number  // % — începutul zonei chihlimbar (1,05 × mediană)
  median: number     // % — poziția medianei
  today: number      // % — poziția prețului de azi
  flag: number       // % — eticheta „Azi · X”, ținută în interiorul barei
}

// Bara min–mediană–max pe 30 de zile (offer_price_stats). Fără una dintre valori → null (fără
// termometru: nu desenăm o scară inventată). Domeniul are puțin spațiu la capete; prețul de azi
// e mereu pe bară (dacă a ieșit din intervalul de 30 de zile, intervalul se lărgește).
export function thermometer(min: number | null, max: number | null, median: number | null, today: number | null): Thermometer | null {
  const ok = (v: number | null): v is number => v != null && Number.isFinite(v) && v > 0
  if (!ok(min) || !ok(max) || !ok(median) || !ok(today) || max < min) return null
  let lo = Math.min(min, today)
  let hi = Math.max(max, today)
  const pad = (hi - lo) * 0.08 || median * 0.04
  lo -= pad
  hi += pad
  const x = (v: number) => Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100))
  const r = (v: number) => Math.round(v * 10) / 10
  return {
    realEnd: r(x(median * (1 - REAL_DISCOUNT_PCT / 100))),
    highStart: r(x(median * (1 + ABOVE_MEDIAN_PCT / 100))),
    median: r(x(median)),
    today: r(x(today)),
    flag: r(Math.max(16, Math.min(84, x(today)))),
  }
}

// „Verificat azi, 06:40” / „Verificat ieri, 22:10” / „Verificat pe 3 oct., 06:40” (ora României).
// `now` = momentul afișării (în browser, ca „azi” să nu rămână „azi” din cache-ul paginii).
export function verifiedLabel(iso: string, now: Date = new Date()): string {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return ''
  const tz = 'Europe/Bucharest'
  const day = (x: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(x)
  const time = new Intl.DateTimeFormat('ro-RO', { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(d)
  const dd = day(d)
  if (dd === day(now)) return `Verificat azi, ${time}`
  if (dd === day(new Date(now.getTime() - 86_400_000))) return `Verificat ieri, ${time}`
  const date = new Intl.DateTimeFormat('ro-RO', { timeZone: tz, day: 'numeric', month: 'short' }).format(d)
  return `Verificat pe ${date}, ${time}`
}
