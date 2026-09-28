import { test } from 'node:test'
import assert from 'node:assert/strict'
import { gaDate, buildDaily, buildBreakdown, topPerDay, dayRange, KINDS, type BreakdownRow } from './transform.js'
import type { ReportResponse } from './client.js'

// Raspuns GA4 in formatul API-ului (metricile vin ca text)
function report(metrics: string[], rows: [string[], number[]][]): ReportResponse {
  return {
    metricHeaders: metrics.map((name) => ({ name })),
    rows: rows.map(([dims, vals]) => ({ dimensionValues: dims.map((value) => ({ value })), metricValues: vals.map((v) => ({ value: String(v) })) })),
  }
}
const spec = (kind: string) => KINDS.find((k) => k.kind === kind)!

test('gaDate: 20260927 → 2026-09-27, refuză alte formate', () => {
  assert.equal(gaDate('20260927'), '2026-09-27')
  assert.throws(() => gaDate('2026-09-27'))
})

test('buildDaily: combină traficul cu clickurile afiliate și calculează timpul mediu', () => {
  const traffic = report(['totalUsers', 'newUsers', 'sessions', 'engagedSessions', 'screenPageViews', 'userEngagementDuration'], [
    [['20260926'], [100, 60, 130, 70, 400, 5000]],
    [['20260927'], [0, 0, 0, 0, 0, 0]],
  ])
  const clicks = report(['eventCount'], [[['20260926'], [12]], [['20260928'], [3]]])
  const rows = buildDaily(traffic, clicks)
  assert.deepEqual(rows[0], { day: '2026-09-26', users: 100, new_users: 60, sessions: 130, engaged_sessions: 70, page_views: 400, avg_engagement_seconds: 50, affiliate_clicks: 12 })
  assert.equal(rows[1].avg_engagement_seconds, 0, 'fără utilizatori → 0, nu împărțire la zero')
  // o zi cu clickuri dar fără rând de trafic nu se pierde
  assert.equal(rows[2].day, '2026-09-28')
  assert.equal(rows[2].affiliate_clicks, 3)
})

test('buildBreakdown: unește traficul și clickurile pe aceeași cheie, „(not set)” pentru gol', () => {
  const traffic = report(['sessions', 'totalUsers'], [
    [['20260926', 'google / organic'], [50, 40]],
    [['20260926', 'google / cpc'], [10, 9]],
    [['20260926', ''], [2, 2]],
  ])
  const clicks = report(['eventCount'], [[['20260926', 'google / cpc'], [4]], [['20260926', 'bing / organic'], [1]]])
  const rows = buildBreakdown(spec('source'), traffic, clicks)
  const byKey = Object.fromEntries(rows.map((r) => [r.key, r]))
  assert.equal(byKey['google / organic'].sessions, 50)
  assert.equal(byKey['google / cpc'].affiliate_clicks, 4)
  assert.equal(byKey['google / cpc'].sessions, 10)
  assert.equal(byKey['bing / organic'].sessions, 0, 'cheie doar cu clickuri → rând cu trafic 0')
  assert.ok(byKey['(not set)'])
  // clasament după sesiuni
  assert.equal(rows[0].key, 'google / organic')
})

test('buildBreakdown: tipurile doar cu clickuri (magazin) nu cer raport de trafic', () => {
  const clicks = report(['eventCount'], [[['20260926', 'ITGalaxy'], [7]], [['20260926', 'CITGrup'], [9]]])
  const rows = buildBreakdown(spec('retailer'), null, clicks)
  assert.deepEqual(rows.map((r) => [r.key, r.affiliate_clicks]), [['CITGrup', 9], ['ITGalaxy', 7]])
})

test('topPerDay: păstrează doar primele N pe fiecare zi, separat', () => {
  const mk = (day: string, key: string, sessions: number): BreakdownRow => ({ day, kind: 'page', key, sessions, users: 0, page_views: sessions, affiliate_clicks: 0 })
  const rows = [
    ...Array.from({ length: 60 }, (_, i) => mk('2026-09-26', `/p/${i}`, i)),
    mk('2026-09-27', '/a', 1), mk('2026-09-27', '/b', 5),
  ]
  const top = topPerDay(rows, 'page_views', 50)
  const d26 = top.filter((r) => r.day === '2026-09-26')
  assert.equal(d26.length, 50)
  assert.equal(d26[0].key, '/p/59')
  assert.ok(!d26.some((r) => r.key === '/p/5'), 'cele mai mici 10 au ieșit')
  assert.deepEqual(top.filter((r) => r.day === '2026-09-27').map((r) => r.key), ['/b', '/a'])
})

test('dayRange: până ieri inclusiv, în ora României (și după miezul nopții UTC)', () => {
  // 28 sep 2026, 00:30 ora României = 27 sep 21:30 UTC → „azi” e 28 în România
  assert.deepEqual(dayRange(3, new Date('2026-09-27T21:30:00Z')), { start: '2026-09-25', end: '2026-09-27' })
  assert.deepEqual(dayRange(90, new Date('2026-09-28T10:00:00Z')), { start: '2026-06-30', end: '2026-09-27' })
})
