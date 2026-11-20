import pool from './db'
import { OFFER_AVAILABLE_SQL, OFFER_STALE_DAYS } from './availability'

// Regula „cel mai ieftin magazin partener” (reorganizarea în blog, design 2026-11-20 §2).
//
// Într-un articol, un produs apare cu UN SINGUR buton, spre o singură ofertă. Care ofertă:
//   1. doar ofertele DISPONIBILE — aceeași condiție ca OFFER_AVAILABLE_SQL (în stoc, confirmată
//      în ultimele OFFER_STALE_DAYS zile, magazinul nu e pe pauză din Admin → Magazine);
//   2. doar ofertele CU link afiliat — fără el, clickul nu aduce comision (REGULI.md: trimitem
//      vizitatorul doar spre oferte cu affiliate_url);
//   3. prețul cel mai mic câștigă;
//   4. la preț egal, oferta confirmată cel mai recent (prețul ei e cel mai probabil încă valabil);
//   5. la egalitate totală, id-ul cel mai mic — doar ca rezultatul să fie stabil între randări.
// Nicio ofertă care trece de 1–2 → null (cardul arată „Momentan indisponibil…”).
//
// Funcția pură e sursa de adevăr; query-ul de mai jos filtrează deja în SQL (ca să nu aducem
// oferte inutile), dar decizia finală tot pickBestOffer o ia — o singură regulă, testată.

export interface OfferCandidate {
  offer_id: string
  retailer_name: string
  current_price: number | null
  affiliate_url: string | null
  in_stock: boolean
  last_checked: string | null   // momentul ultimei confirmări (feed / scanare / verificare preț)
  retailer_paused: boolean      // retailers.paused_at IS NOT NULL
}

export interface BestOffer {
  offer_id: string
  retailer_name: string
  current_price: number
  last_checked: string
}

const STALE_MS = OFFER_STALE_DAYS * 86_400_000

// Echivalentul în JS al OFFER_AVAILABLE_SQL (+ condiția de afiliere). `now` e parametru ca
// testele să nu depindă de ceasul mașinii.
export function isEligibleOffer(o: OfferCandidate, now: Date = new Date()): boolean {
  if (!o.in_stock || o.retailer_paused) return false
  if (!o.affiliate_url || !o.affiliate_url.trim()) return false
  if (o.current_price == null || !(o.current_price > 0)) return false
  if (!o.last_checked) return false
  const t = new Date(o.last_checked).getTime()
  return Number.isFinite(t) && t >= now.getTime() - STALE_MS
}

export function pickBestOffer(offers: readonly OfferCandidate[], now: Date = new Date()): BestOffer | null {
  let best: OfferCandidate | null = null
  for (const o of offers) {
    if (!isEligibleOffer(o, now)) continue
    if (!best || isBetter(o, best)) best = o
  }
  if (!best) return null
  return {
    offer_id: best.offer_id,
    retailer_name: best.retailer_name,
    current_price: best.current_price as number,
    last_checked: best.last_checked as string,
  }
}

// a e mai bună decât b? (ambele deja eligibile)
function isBetter(a: OfferCandidate, b: OfferCandidate): boolean {
  const pa = a.current_price as number
  const pb = b.current_price as number
  if (pa !== pb) return pa < pb
  const ta = new Date(a.last_checked as string).getTime()
  const tb = new Date(b.last_checked as string).getTime()
  if (ta !== tb) return ta > tb
  return compareIds(a.offer_id, b.offer_id) < 0
}

// Id-urile sunt bigint ca text: comparăm întâi lungimea, ca „9” < „10”.
function compareIds(a: string, b: string): number {
  return a.length !== b.length ? a.length - b.length : a < b ? -1 : a > b ? 1 : 0
}

// Cea mai bună ofertă pentru fiecare produs dintr-un articol — UN SINGUR query pentru toate
// produsele (fără câte un query pe card). Produsele fără ofertă eligibilă lipsesc din Map.
export async function getBestOffers(productIds: readonly string[]): Promise<Map<string, BestOffer>> {
  const ids = [...new Set(productIds.filter((id) => /^\d{1,18}$/.test(id)))]
  const result = new Map<string, BestOffer>()
  if (!ids.length) return result

  // last_checked vine ca Date (driverul pg), nu ::text: textul Postgres („… 10:00:00+02”) nu e
  // ISO și nu se parsează sigur cu new Date() — l-am trata drept neconfirmat.
  const { rows } = await pool.query<Omit<OfferCandidate, 'last_checked'> & { product_id: string; last_checked: Date | null }>(`
    SELECT o.product_id::text AS product_id, o.id::text AS offer_id, r.name AS retailer_name,
           o.current_price::float AS current_price, o.affiliate_url, o.in_stock,
           o.last_checked, (r.paused_at IS NOT NULL) AS retailer_paused
    FROM offers o
    JOIN retailers r ON r.id = o.retailer_id
    WHERE o.product_id = ANY($1::bigint[])
      AND o.current_price IS NOT NULL
      AND o.affiliate_url IS NOT NULL
      AND ${OFFER_AVAILABLE_SQL}
  `, [ids])

  const byProduct = new Map<string, OfferCandidate[]>()
  for (const r of rows) {
    const list = byProduct.get(r.product_id) ?? []
    list.push({ ...r, last_checked: r.last_checked ? new Date(r.last_checked).toISOString() : null })
    byProduct.set(r.product_id, list)
  }
  const now = new Date()
  for (const [pid, list] of byProduct) {
    const best = pickBestOffer(list, now)
    if (best) result.set(pid, best)
  }
  return result
}
