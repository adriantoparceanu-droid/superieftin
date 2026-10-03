// Teste pentru re-armarea alertelor (lib/alert-rearm.ts). Rulare: cd worker && npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { alertMaxIdleDays, alertRearmPct, bestAvailablePrice, decideAlert, rearmThreshold, telegramMinIntervalHours, type AlertSnapshot } from './alert-rearm.js'

const H = 3600 * 1000
const T0 = Date.parse('2026-10-03T12:00:00Z')

// Simulare: o alerta prin care trec preturi succesive (cate unul pe ora, implicit); intoarce
// momentele (indexul) la care s-a trimis un anunt. Aplica deciziile exact ca workerii.
function simulate(prices: (number | null)[], opts: { target?: number; rearmPct?: number; minIntervalHours?: number | null; stepHours?: number } = {}) {
  const target = opts.target ?? 1000
  let s: AlertSnapshot = { armed: true, target, bestPrice: null, lastNotifiedAt: null }
  const sent: number[] = []
  const rearmed: number[] = []
  prices.forEach((p, i) => {
    const nowMs = T0 + i * (opts.stepHours ?? 1) * H
    s = { ...s, bestPrice: p }
    const d = decideAlert(s, { rearmPct: opts.rearmPct ?? 3, minIntervalHours: opts.minIntervalHours ?? null, nowMs })
    if (d === 'notify') { sent.push(i); s = { ...s, armed: false, lastNotifiedAt: new Date(nowMs).toISOString() } }
    if (d === 'rearm') { rearmed.push(i); s = { ...s, armed: true } }
  })
  return { sent, rearmed, armed: s.armed }
}

test('pragul de re-armare: prag + marja', () => {
  assert.equal(rearmThreshold(1000, 3), 1030)
  assert.equal(rearmThreshold(1610, 3), 1658.3)
  assert.equal(rearmThreshold(1000, 0), 1000)
})

test('scadere → anunt → urcare SUB marja nu re-armeaza → urcare PESTE marja re-armeaza → noua scadere → anunt nou', () => {
  //            0     1    2     3     4     5    6
  const r = simulate([1050, 990, 1020, 1030, 1040, 985, 980])
  assert.deepEqual(r.sent, [1, 5])        // a doua scadere (985) anunta din nou; 980 nu (deja TRIMISA)
  assert.deepEqual(r.rearmed, [4])        // 1020 si 1030 (egal cu pragul de re-armare) nu re-armeaza
  assert.equal(r.armed, false)
})

test('anuntul pleaca si la pret EGAL cu pragul', () => {
  assert.deepEqual(simulate([1000]).sent, [0])
})

test('oscilatii in jurul pragului: un singur anunt', () => {
  const prices = [1005, 999, 1004, 998, 1010, 997, 1025, 996, 1029, 995]
  const r = simulate(prices)
  assert.deepEqual(r.sent, [1])
  assert.deepEqual(r.rearmed, [])
})

test('fara oferta disponibila: alerta TRIMISA ramane in asteptare; ARMATA nu anunta', () => {
  const r = simulate([990, null, null, 1040, null, 980])
  assert.deepEqual(r.sent, [0, 5])
  assert.deepEqual(r.rearmed, [3])
  assert.equal(decideAlert({ armed: true, target: 1000, bestPrice: null, lastNotifiedAt: null }, { rearmPct: 3, minIntervalHours: null, nowMs: T0 }), 'wait')
  assert.equal(decideAlert({ armed: false, target: 1000, bestPrice: null, lastNotifiedAt: null }, { rearmPct: 3, minIntervalHours: null, nowMs: T0 }), 'wait')
})

test('plafon Telegram (24 h per alerta): re-armata si scazuta din nou in 3 ore → asteapta; dupa 24 h → anunt', () => {
  // pas de 1 h: 0 scadere, 1 urcare peste marja, 2 scadere iar (in fereastra), ... 24 h dupa primul anunt
  const prices: number[] = [990, 1040, 985]
  for (let i = 3; i < 24; i++) prices.push(985)
  prices.push(985)   // index 24 = exact 24 h dupa primul anunt
  const r = simulate(prices, { minIntervalHours: 24 })
  assert.deepEqual(r.rearmed, [1])
  assert.deepEqual(r.sent, [0, 24])
  // fara plafon, al doilea anunt ar fi plecat imediat
  assert.deepEqual(simulate([990, 1040, 985], { minIntervalHours: null }).sent, [0, 2])
})

test('plafonul nu blocheaza prima alerta si nici una veche', () => {
  const old = new Date(T0 - 48 * H).toISOString()
  assert.equal(decideAlert({ armed: true, target: 1000, bestPrice: 900, lastNotifiedAt: old }, { rearmPct: 3, minIntervalHours: 24, nowMs: T0 }), 'notify')
  assert.equal(decideAlert({ armed: true, target: 1000, bestPrice: 900, lastNotifiedAt: null }, { rearmPct: 3, minIntervalHours: 24, nowMs: T0 }), 'notify')
})

test('marja configurabila: 0% re-armeaza la orice urcare peste prag; 10% cere mai mult', () => {
  assert.deepEqual(simulate([990, 1001, 990], { rearmPct: 0 }).sent, [0, 2])
  assert.deepEqual(simulate([990, 1050, 990], { rearmPct: 10 }).sent, [0])
  assert.deepEqual(simulate([990, 1101, 990], { rearmPct: 10 }).sent, [0, 2])
})

test('cel mai mic pret disponibil (ofertele fara stoc nu conteaza)', () => {
  assert.equal(bestAvailablePrice([{ price: 900, available: false }, { price: 1050, available: true }, { price: 1020, available: true }]), 1020)
  assert.equal(bestAvailablePrice([{ price: 900, available: false }]), null)
  assert.equal(bestAvailablePrice(null), null)
})

test('valori din env', () => {
  assert.equal(alertRearmPct({}), 3)
  assert.equal(alertRearmPct({ ALERT_REARM_PCT: '5' }), 5)
  assert.equal(alertRearmPct({ ALERT_REARM_PCT: 'x' }), 3)
  assert.equal(telegramMinIntervalHours({}), 24)
  assert.equal(telegramMinIntervalHours({ TELEGRAM_ALERT_MIN_INTERVAL_HOURS: '6' }), 6)
  assert.equal(alertMaxIdleDays({}), 365)
  assert.equal(alertMaxIdleDays({ ALERT_MAX_IDLE_DAYS: '0' }), 365)
})
