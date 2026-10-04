// Text factual despre pretul unui produs, generat din aceleasi date ca graficul de pe /p/
// (cel mai mic pret pe zi, cel mult 90 de zile — lib/price-series.ts). Pure — testat.
//
// De ce: asistentii AI si motoarele de cautare citeaza fraze, nu grafice. Blocul spune doar
// FAPTE (minim, maxim, ultima schimbare, diferenta dintre magazine) — fara verdict si fara
// promisiuni de reducere (REGULI.md, regula 9: o afirmatie de reducere poate deveni falsa a doua zi).
//
// Fereastra istoricului: graficul arata ultimele HISTORY_WINDOW_DAYS zile, dar un produs urmarit
// de curand are mai putine. Atunci NU scriem „90 de zile” (ar sugera date pe care nu le avem —
// policy-reviewer, campania pet): titlul si frazele pleaca de la prima inregistrare.

import { formatPrice } from '../discount'
import { formatRoDate } from './site'
import { daysBetween, roDay, type DayPrice } from '../price-series'

export const HISTORY_WINDOW_DAYS = 90

// Data de la care afisam istoricul, daca e mai noua decat fereastra de 90 de zile; altfel null
// (= avem istoric pe toata fereastra, textele raman „90 de zile”).
// trackedSince = prima inregistrare din istoric pentru produs (oricand, nu doar in fereastra).
export function historyPartialSince(trackedSince: string | null | undefined, now: Date = new Date()): string | null {
  if (!trackedSince) return null
  const t = new Date(trackedSince).getTime()
  if (!Number.isFinite(t)) return null
  return t > now.getTime() - HISTORY_WINDOW_DAYS * 86_400_000 ? trackedSince : null
}

// Data scurta, ora Romaniei: „3 oct. 2026”
function formatRoDateShort(d: string): string {
  return new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Bucharest' })
    .format(new Date(d))
}

// Titlul blocului cu graficul: „Istoricul prețului (90 de zile)” / „Istoricul prețului (de la 3 oct. 2026)”
export function historyTitle(partialSince: string | null): string {
  return partialSince
    ? `Istoricul prețului (de la ${formatRoDateShort(partialSince)})`
    : `Istoricul prețului (${HISTORY_WINDOW_DAYS} de zile)`
}

// Fraza din meta description despre grafic
export function historyChartPhrase(partialSince: string | null): string {
  return partialSince
    ? `Grafic cu istoricul prețului de la ${formatRoDate(partialSince)}, comparat cu mediana de 30 de zile.`
    : `Grafic cu istoricul prețului pe ${HISTORY_WINDOW_DAYS} de zile, comparat cu mediana de 30 de zile.`
}

// --- „Pe scurt despre preț” (redesign, cardul cu 3 rânduri) -----------------------------------
//
// Trei rânduri, generate STRICT din date (aceeași serie ca graficul — lib/price-series.ts):
//   (a) unde e prețul de azi în perioada urmărită (minim / maxim);
//   (b) ultima schimbare a prețului;
//   (c) diferența dintre cel mai ieftin și cel mai scump magazin (doar cu ≥ 2 oferte).
// Fără verdict, fără procente, fără „reducere” — regula 9 (o afirmație de reducere poate deveni
// falsă a doua zi), iar ads:validate citește doar cardul de verdict.
// Bucățile `{ b }` se afișează îngroșat (prețurile).

export type FactPart = string | { b: string }
export interface PriceFactRow { icon: 'chart' | 'clock' | 'store'; parts: FactPart[] }

export interface PriceFactsInput {
  series: DayPrice[]                 // cel mai mic preț pe zi (ultimele 90 de zile), ultima = azi
  todayPrice: number | null          // cel mai mic preț disponibil acum (null = indisponibil)
  offerPrices: number[]              // prețurile ofertelor disponibile acum
  // Prima înregistrare din istoric pentru produs (oricând). Lipsa → prima zi din serie.
  trackedSince?: string | null
  now?: Date                         // pentru teste
}

export function priceFactRows(i: PriceFactsInput): PriceFactRow[] {
  const rows: PriceFactRow[] = []
  const s = i.series.filter((p) => Number.isFinite(p.price) && p.price > 0)
  const since = historyPartialSince(i.trackedSince ?? (s[0] ? `${s[0].day}T12:00:00Z` : null), i.now)
  // „de la 6 iulie 2026, de când urmărim produsul” / „din ultimele 90 de zile”
  const within = since ? `de la ${formatRoDate(since)}, de când urmărim produsul` : `din ultimele ${HISTORY_WINDOW_DAYS} de zile`
  const lead = since ? `De la ${formatRoDate(since)}, de când urmărim produsul,` : `În ultimele ${HISTORY_WINDOW_DAYS} de zile,`

  // (a) poziția prețului de azi
  if (s.length >= 2) {
    const min = Math.min(...s.map((p) => p.price))
    const max = Math.max(...s.map((p) => p.price))
    const today = i.todayPrice
    if (min === max) {
      rows.push({ icon: 'chart', parts: [`${lead} prețul înregistrat a fost constant: `, { b: formatPrice(min) }, '.'] })
    } else if (today != null && today <= min) {
      rows.push({ icon: 'chart', parts: ['Prețul de azi, ', { b: formatPrice(today) }, `, e cel mai mic ${within} (maximul perioadei: `, { b: formatPrice(max) }, ').'] })
    } else {
      rows.push({
        icon: 'chart',
        parts: [`${lead} prețul a variat între `, { b: formatPrice(min) }, ' și ', { b: formatPrice(max) },
          ...(today != null ? ['; azi: ', { b: formatPrice(today) }, '.'] : ['.'])],
      })
    }
  } else if (s.length === 1) {
    rows.push({ icon: 'chart', parts: [`Urmărim prețul din ${formatRoDate(`${s[0].day}T12:00:00Z`)}; avem încă prea puține înregistrări pentru un istoric.`] })
  }

  // (b) ultima schimbare (la pret constant, randul (a) spune deja tot)
  if (s.length >= 2 && s.some((p) => p.price !== s[0].price)) {
    let k = s.length - 1
    while (k > 0 && s[k - 1].price === s[k].price) k--
    const subject = i.offerPrices.length > 1 ? 'Cel mai mic preț' : 'Prețul'
    const ago = daysBetween(s[k].day, roDay(i.now ?? new Date()))
    const when = ago <= 0 ? 'azi' : ago === 1 ? 'ieri' : `acum ${ago} zile`
    rows.push({ icon: 'clock', parts: [`${subject} a ${s[k].price < s[k - 1].price ? 'scăzut' : 'crescut'} ${when}, de la `, { b: formatPrice(s[k - 1].price) }, '.'] })
  }

  // (c) diferența dintre magazine
  const prices = i.offerPrices.filter((p) => Number.isFinite(p) && p > 0)
  if (prices.length >= 2) {
    const diff = Math.round((Math.max(...prices) - Math.min(...prices)) * 100) / 100
    rows.push(diff === 0
      ? { icon: 'store', parts: [prices.length === 2 ? 'Ambele magazine au azi același preț: ' : `Toate cele ${prices.length} magazine au azi același preț: `, { b: formatPrice(prices[0]) }, '.'] }
      : { icon: 'store', parts: [`Diferența de azi dintre cel mai ieftin și cel mai scump dintre cele ${prices.length} magazine: `, { b: formatPrice(diff) }, '.'] })
  }
  return rows
}

// Textul simplu al unui rând (teste, meta)
export function factText(r: PriceFactRow): string {
  return r.parts.map((p) => (typeof p === 'string' ? p : p.b)).join('')
}

// --- Variante (culori / configuratii ale aceluiasi model) ------------------------------------

// Baza numelui pentru „Alte variante”: taiem tot ce urmeaza dupa ULTIMUL cuvant care contine o
// cifra (de regula culoarea / finisajul), daca restul are cel mult 3 cuvinte:
//   „Telefon mobil Galaxy S26 Ultra 256GB 12GB RAM Dual Sim 5G Cobalt Violet”
//     → „Telefon mobil Galaxy S26 Ultra 256GB 12GB RAM Dual Sim 5G”
// Variantele = produsele din aceeasi categorie al caror nume incepe cu aceasta baza.
// null = nu putem deduce sigur o baza (prea scurta / prea multe cuvinte dupa ultima cifra).
export function variantBase(name: string): string | null {
  const tokens = name.trim().split(/\s+/)
  let last = -1
  for (let i = tokens.length - 1; i >= 0; i--) if (/\d/.test(tokens[i])) { last = i; break }
  if (last < 0) return null
  if (tokens.length - 1 - last > 3) return null
  if (last + 1 < 3) return null
  const base = tokens.slice(0, last + 1).join(' ').replace(/[\s,;:–—-]+$/, '')
  return base.length >= 12 ? base : null
}
