import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pickBestOffer } from './best-offer.js'

// Paritate web ↔ worker pentru regula „cel mai ieftin magazin partener”: aceeași ofertă trebuie
// să primească butonul din articol (web/src/lib/best-offer-pick.ts) și să apară în
// `npm run cercetare` / verificarea săptămânală (worker/src/lib/best-offer.ts). Formele datelor
// diferă (web primește in_stock + pauză + data confirmării; worker primește deja `available`,
// calculat în SQL), așa că le traducem pe aceleași oferte și comparăm id-ul ales.

const webPath = new URL('../../../web/src/lib/best-offer-pick.ts', import.meta.url).href
const web = await import(webPath) as {
  pickBestOffer: (offers: WebOffer[], now: Date) => { offer_id: string } | null
}
const availPath = new URL('../../../web/src/lib/availability.ts', import.meta.url).href
const { OFFER_STALE_DAYS } = await import(availPath) as { OFFER_STALE_DAYS: number }

interface WebOffer {
  offer_id: string; retailer_name: string; current_price: number | null; affiliate_url: string | null
  in_stock: boolean; last_checked: string | null; retailer_paused: boolean
}

// Generator determinist (LCG) — aceleași cazuri la fiecare rulare.
function rng(seed: number) {
  let s = seed >>> 0
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32
}

const NOW = new Date('2026-11-20T12:00:00Z')
const DAY = 86_400_000

test('aceeași ofertă aleasă în web și în worker (2.000 de seturi aleatoare)', () => {
  const r = rng(20261120)
  const pick = <T>(xs: T[]) => xs[Math.floor(r() * xs.length)]
  for (let set = 0; set < 2000; set++) {
    const n = 1 + Math.floor(r() * 6)
    const offers: WebOffer[] = []
    for (let i = 0; i < n; i++) {
      offers.push({
        offer_id: String(1 + Math.floor(r() * 40)) + String(i),   // id-uri cu lungimi diferite
        retailer_name: 'M' + i,
        current_price: pick([null, 0, 99.9, 100, 100, 149.5, 250]),
        affiliate_url: pick([null, '', '  ', 'https://l.profitshare.ro/l/1']),
        in_stock: r() < 0.8,
        // în fereastră, la limită (în ziua a 3-a) sau expirată; câteva egalități de timp
        last_checked: pick([null, new Date(NOW.getTime() - DAY).toISOString(),
          new Date(NOW.getTime() - DAY).toISOString(), new Date(NOW.getTime() - (OFFER_STALE_DAYS * DAY - 60_000)).toISOString(),
          new Date(NOW.getTime() - (OFFER_STALE_DAYS * DAY + 60_000)).toISOString()]),
        retailer_paused: r() < 0.1,
      })
    }
    // worker: `available` = condiția OFFER_AVAILABLE_SQL (în stoc, magazin activ, confirmată în fereastră)
    const workerOffers = offers.map((o) => ({
      offerId: Number(o.offer_id),
      price: o.current_price,
      affiliateUrl: o.affiliate_url,
      lastChecked: o.last_checked,
      available: o.in_stock && !o.retailer_paused && o.last_checked != null
        && new Date(o.last_checked).getTime() >= NOW.getTime() - OFFER_STALE_DAYS * DAY,
    }))
    const w = web.pickBestOffer(offers, NOW)?.offer_id ?? null
    const k = pickBestOffer(workerOffers)
    assert.equal(k ? String(k.offerId) : null, w, `set ${set}: ${JSON.stringify(offers)}`)
  }
})
