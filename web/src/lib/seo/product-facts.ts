// Text factual despre pretul unui produs, generat din aceleasi date ca graficul de pe /p/
// (istoricul pe 90 de zile + mediana 30 de zile a celei mai bune oferte). Pure — testat.
//
// De ce: asistentii AI si motoarele de cautare citeaza fraze, nu grafice. Blocul spune doar
// FAPTE (minim, maxim, mediana, data verificarii) — fara verdict si fara promisiuni de
// reducere (REGULI.md, regula 9: o afirmatie de reducere poate deveni falsa a doua zi).

import { formatPrice } from '../discount'
import { formatRoDate } from './site'

export interface PricePointLite { price: number; recorded_at: string }

export interface PriceFactsInput {
  history: PricePointLite[]          // ultimele 90 de zile, toate ofertele (ca graficul)
  median30: number | null            // mediana 30 de zile a celei mai bune oferte disponibile
  lastChecked: string | null         // ultima verificare a celei mai bune oferte
  retailer: string | null            // magazinul celei mai bune oferte
}

export function priceFacts(i: PriceFactsInput): string[] {
  const out: string[] = []
  const pts = i.history.filter((p) => Number.isFinite(p.price) && p.price > 0)
  if (pts.length >= 2) {
    // La egalitate alegem cea mai recenta data (istoricul e sortat crescator dupa data)
    let min = pts[0], max = pts[0]
    for (const p of pts) {
      if (p.price <= min.price) min = p
      if (p.price >= max.price) max = p
    }
    if (min.price === max.price) {
      out.push(`În ultimele 90 de zile, prețul înregistrat a fost constant: ${formatPrice(min.price)}.`)
    } else {
      out.push(
        `În ultimele 90 de zile, cel mai mic preț înregistrat a fost ${formatPrice(min.price)} ` +
        `(${formatRoDate(min.recorded_at)}), iar cel mai mare ${formatPrice(max.price)} (${formatRoDate(max.recorded_at)}).`
      )
    }
  } else if (pts.length === 1) {
    out.push(`Urmărim prețul din ${formatRoDate(pts[0].recorded_at)}; avem încă prea puține înregistrări pentru un istoric.`)
  }
  if (i.median30 != null && i.median30 > 0) {
    out.push(`Mediana prețurilor din ultimele 30 de zile: ${formatPrice(i.median30)}.`)
  }
  if (i.lastChecked) {
    out.push(`Ultima verificare: ${formatRoDate(i.lastChecked)}${i.retailer ? `, la ${i.retailer}` : ''}.`)
  }
  return out
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
