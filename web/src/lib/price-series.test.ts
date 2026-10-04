// Teste pentru seria „cel mai mic preț pe zi”, „Pe scurt despre preț” și cardul de verdict
// (lib/price-series.ts, lib/seo/product-facts.ts → priceFactRows, lib/verdict.ts). Rulare: cd web && npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { addDays, dailyLowSeries, daysBetween, roDay } from './price-series'
import { factText, priceFactRows } from './seo/product-facts'
import { thermometer, verdictCopy, verifiedLabel } from './verdict'
import { calculateDiscount } from './discount'

const now = new Date('2026-10-04T12:00:00Z')

test('zile calendaristice în ora României', () => {
  assert.equal(roDay('2026-10-03T22:30:00Z'), '2026-10-04')   // 01:30 în România
  assert.equal(roDay('2026-10-04 20:00:28.846953+02'), '2026-10-04')   // formatul text din Postgres
  assert.equal(addDays('2026-10-31', 1), '2026-11-01')
  assert.equal(addDays('2026-03-29', 1), '2026-03-30')        // schimbarea orei
  assert.equal(daysBetween('2026-09-30', '2026-10-04'), 4)
})

test('seria: cel mai mic preț pe zi, cu prețul ofertei păstrat între înregistrări', () => {
  const s = dailyLowSeries([
    { offer_id: '1', price: 100, recorded_at: '2026-10-01T08:00:00Z' },
    { offer_id: '2', price: 120, recorded_at: '2026-10-01T09:00:00Z' },
    { offer_id: '2', price: 90, recorded_at: '2026-10-02T09:00:00Z' },
    { offer_id: '2', price: 95, recorded_at: '2026-10-02T15:00:00Z' },   // ultimul preț al zilei câștigă
    { offer_id: '1', price: 98, recorded_at: '2026-10-04T08:00:00Z' },
  ], { now })
  assert.deepEqual(s, [
    { day: '2026-10-01', price: 100 },
    { day: '2026-10-02', price: 95 },
    { day: '2026-10-03', price: 95 },   // nicio înregistrare: rămân prețurile cunoscute
    { day: '2026-10-04', price: 95 },
  ])
})

test('seria: doar ofertele disponibile, se termină azi cu prețul de azi', () => {
  const pts = [
    { offer_id: '1', price: 100, recorded_at: '2026-10-01T08:00:00Z' },
    { offer_id: '9', price: 50, recorded_at: '2026-10-01T08:00:00Z' },   // magazin fără produs azi
    { offer_id: '1', price: 100, recorded_at: '2026-10-03T08:00:00Z' },
  ]
  const s = dailyLowSeries(pts, { offerIds: ['1'], todayPrice: 97, now })
  assert.deepEqual(s.map((p) => p.price), [100, 100, 100, 97])
  assert.equal(s.at(-1)!.day, '2026-10-04')
  // produs indisponibil: fără „azi”, seria se oprește la ultima zi cu date, cu toate ofertele
  const off = dailyLowSeries(pts, { offerIds: [], todayPrice: null, now })
  assert.deepEqual(off.map((p) => p.price), [50, 50, 50])
  assert.deepEqual(dailyLowSeries([], { now }), [])
})

test('Pe scurt: produs urmărit de puțin — „de când urmărim produsul”, niciodată „90 de zile”', () => {
  const series = [
    { day: '2026-09-20', price: 2599.99 }, { day: '2026-09-21', price: 2549.99 },
    { day: '2026-10-01', price: 2479.99 }, { day: '2026-10-04', price: 2040 },
  ]
  const rows = priceFactRows({ series, todayPrice: 2040, offerPrices: [2040, 2129.99, 2249.9], trackedSince: '2026-09-20T08:00:00Z', now })
  const t = rows.map(factText)
  assert.equal(rows.length, 3)
  assert.match(t[0], /^Prețul de azi, 2\.040\s?RON, e cel mai mic de la 20 septembrie 2026, de când urmărim produsul \(maximul perioadei: 2\.599,99\s?RON\)\.$/)
  assert.match(t[1], /^Cel mai mic preț a scăzut azi, de la 2\.479,99\s?RON\.$/)
  assert.match(t[2], /^Diferența de azi dintre cel mai ieftin și cel mai scump dintre cele 3 magazine: 209,9\s?RON\.$/)
  for (const x of t) {
    assert.doesNotMatch(x, /90 de zile/)
    assert.doesNotMatch(x, /reducere|%/i)   // regula 9: fără verdict / procente
  }
})

test('Pe scurt: istoric de 90+ zile, variație, schimbare de acum câteva zile, o singură ofertă', () => {
  const series = [
    { day: '2026-07-06', price: 100 }, { day: '2026-08-01', price: 80 },
    { day: '2026-09-30', price: 90 }, { day: '2026-10-01', price: 90 }, { day: '2026-10-04', price: 90 },
  ]
  const t = priceFactRows({ series, todayPrice: 90, offerPrices: [90], trackedSince: '2026-01-10T08:00:00Z', now }).map(factText)
  assert.equal(t.length, 2)   // fără rândul despre magazine
  assert.match(t[0], /^În ultimele 90 de zile, prețul a variat între 80\s?RON și 100\s?RON; azi: 90\s?RON\.$/)
  assert.match(t[1], /^Prețul a crescut acum 4 zile, de la 80\s?RON\.$/)
})

test('Pe scurt: preț constant / un singur punct / magazine cu același preț', () => {
  const flat = priceFactRows({
    series: [{ day: '2026-10-03', price: 361.12 }, { day: '2026-10-04', price: 361.12 }],
    todayPrice: 361.12, offerPrices: [361.12, 361.12], trackedSince: '2026-10-03 09:00:00+03', now,
  }).map(factText)
  assert.match(flat[0], /^De la 3 octombrie 2026, de când urmărim produsul, prețul înregistrat a fost constant: 361,12\s?RON\.$/)
  assert.equal(flat.length, 2)   // fără „nu s-a schimbat” — rândul (a) spune deja „constant”
  assert.match(flat[1], /^Ambele magazine au azi același preț/)
  const one = priceFactRows({ series: [{ day: '2026-10-04', price: 10 }], todayPrice: 10, offerPrices: [10], now }).map(factText)
  assert.deepEqual(one, ['Urmărim prețul din 4 octombrie 2026; avem încă prea puține înregistrări pentru un istoric.'])
  assert.deepEqual(priceFactRows({ series: [], todayPrice: null, offerPrices: [], now }), [])
})

test('verdict: textele celor 4 stări; doar reducerea reală spune „e cu X% sub mediana”', () => {
  const real = verdictCopy(calculateDiscount(2040, 2489.99), 2489.99)
  assert.equal(real.word, 'Reducere reală')
  assert.equal(real.pct, '−18,1%')
  const realText = factText({ icon: 'chart', parts: real.sentence })
  // citit de ads:validate / ads-guard (worker/src/ads/campaigns/validate.ts → parsePage)
  assert.match(realText, /^Prețul de azi e cu 18,1% sub mediana pe 30 de zile \(2\.489,99\s?RON\)\.$/)

  const normal = verdictCopy(calculateDiscount(2400, 2449.99), 2449.99)
  assert.equal(normal.word, 'Preț obișnuit')
  assert.equal(normal.pct, '−2%')
  const higher = verdictCopy(calculateDiscount(2649.99, 2449.99), 2449.99)
  assert.equal(higher.word, 'Peste prețul obișnuit')
  assert.equal(higher.pct, '+8,2%')
  const none = verdictCopy(calculateDiscount(2000, null), null)
  assert.equal(none.word, 'Monitorizăm prețul')
  assert.equal(none.pct, null)
  for (const v of [normal, higher, none]) {
    assert.doesNotMatch(factText({ icon: 'chart', parts: v.sentence }), /e cu\s*\d+(?:[.,]\d+)?%\s*sub mediana/)
  }
  for (const v of [real, normal, higher, none]) {
    assert.doesNotMatch(factText({ icon: 'chart', parts: v.sentence }), /garantat|economisești/i)
  }
})

test('termometru: zonele ±5% în jurul medianei, azi pe bară, fără valori → fără termometru', () => {
  const t = thermometer(2040, 2599.99, 2489.99, 2040)!
  assert.ok(t.realEnd > 0 && t.realEnd < t.median && t.median < t.highStart && t.highStart <= 100)
  assert.ok(t.today < t.realEnd)            // reducere reală: în zona hașurată
  assert.ok(t.flag >= 16 && t.flag <= 84)   // eticheta nu iese din bară
  // prețul de azi în afara intervalului de 30 de zile → intervalul se lărgește
  const out = thermometer(100, 120, 110, 150)!
  assert.ok(out.today > out.highStart && out.today <= 100)
  // min = max (preț constant): tot desenăm, cu spațiu în jurul medianei
  assert.ok(thermometer(100, 100, 100, 100))
  assert.equal(thermometer(null, 120, 110, 100), null)
  assert.equal(thermometer(100, 120, null, 100), null)
  assert.equal(thermometer(100, 120, 110, null), null)
})

test('„Verificat azi / ieri / pe …” în ora României', () => {
  assert.equal(verifiedLabel('2026-10-04T03:40:00Z', now), 'Verificat azi, 06:40')
  assert.equal(verifiedLabel('2026-10-03T19:10:00Z', now), 'Verificat ieri, 22:10')
  assert.match(verifiedLabel('2026-10-01T05:00:00Z', now), /^Verificat pe 1 oct\.?, 08:00$/)
})
