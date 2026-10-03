// Teste pentru pragul propus si linkul de alerta Telegram (lib/price-alert.ts). Rulare: cd web && npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { alertStartParam, suggestAlertTarget, telegramAlertUrl } from './price-alert'

test('prag: 5% sub pretul de azi cand pretul e sub mediana', () => {
  assert.equal(suggestAlertTarget(2000, 2100), 1900)
  // deja reducere reala (1.700 vs 2.665) → inca 5% sub pretul de azi, rotunjit in jos la 10
  assert.equal(suggestAlertTarget(1699.99, 2664.995), 1610)
})

test('prag: pragul unei reduceri reale cand pretul e peste mediana', () => {
  assert.equal(suggestAlertTarget(2400, 2000), 1900)
})

test('prag: fara mediana → 5% sub pretul de azi', () => {
  assert.equal(suggestAlertTarget(2000, null), 1900)
  assert.equal(suggestAlertTarget(2000, 0), 1900)
})

test('prag: rotunjire in jos pe trepte (1 / 5 / 10 lei), mereu sub pretul de azi', () => {
  assert.equal(suggestAlertTarget(49.99, null), 47)     // 47,49 → 47
  assert.equal(suggestAlertTarget(120, null), 110)      // 114 → 110
  assert.equal(suggestAlertTarget(1099, null), 1040)    // 1044,05 → 1040
  for (const p of [3, 19.9, 99.99, 105, 999, 1000, 1052.63, 7349.5]) {
    const t = suggestAlertTarget(p, null)
    assert.ok(t != null && t <= p * 0.95, `pret ${p} → prag ${t}`)
  }
})

test('prag: fara pret sau pret prea mic → nimic', () => {
  assert.equal(suggestAlertTarget(null, 100), null)
  assert.equal(suggestAlertTarget(0, 100), null)
  assert.equal(suggestAlertTarget(1, null), null)       // 0,95 → sub 1 leu
})

test('parametru start: format acceptat de Telegram (<=64, [A-Za-z0-9_-])', () => {
  assert.equal(alertStartParam('123', 1610), 'prod_123_1610')
  assert.equal(alertStartParam(123, null), 'prod_123')
  assert.equal(alertStartParam('123', 1610.7), 'prod_123_1610')
  const p = alertStartParam('9007199254740991', 99999999)
  assert.ok(p.length <= 64 && /^[A-Za-z0-9_-]+$/.test(p))
  assert.throws(() => alertStartParam('12a', 5))
})

test('link Telegram', () => {
  assert.equal(telegramAlertUrl('superieftin_bot', '42', 1900), 'https://t.me/superieftin_bot?start=prod_42_1900')
})
