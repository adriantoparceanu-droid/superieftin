// Teste pentru pragul editabil al alertei de preț (lib/alert-threshold.ts). Rulare: cd web && npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatLeiInput, parseLeiAmount, telegramTarget, thresholdStatus, MAX_TARGET_PRICE } from './alert-threshold'

test('parsare: formatele românești din machetă', () => {
  assert.equal(parseLeiAmount('1.938'), 1938)
  assert.equal(parseLeiAmount('1938'), 1938)
  assert.equal(parseLeiAmount('1 938,50'), 1938.5)
  assert.equal(parseLeiAmount('1.938,50'), 1938.5)
  assert.equal(parseLeiAmount('1938.5'), 1938.5)
  assert.equal(parseLeiAmount(' 1.938 lei '), 1938)
  assert.equal(parseLeiAmount('12.345'), 12345)
  assert.equal(parseLeiAmount(1938), 1938)
  for (const bad of ['', 'abc', '0', '-5', '0,5', '1.5.6', '1938,505', String(MAX_TARGET_PRICE + 1), null, undefined]) {
    assert.equal(parseLeiAmount(bad), null, String(bad))
  }
})

test('afișare în câmp: separator de mii și la 4 cifre, zecimale doar dacă există', () => {
  assert.equal(formatLeiInput(1938), '1.938')
  assert.equal(formatLeiInput(1938.5), '1.938,50')
  assert.equal(formatLeiInput(99), '99')
  assert.equal(formatLeiInput(12345.67), '12.345,67')
  // ce afișăm se parsează înapoi în aceeași sumă
  for (const n of [1, 47, 1938, 1938.5, 99999.99]) assert.equal(parseLeiAmount(formatLeiInput(n)), n)
})

test('Telegram: lei întregi, rotunjit în jos (alerta nu pleacă peste suma aleasă)', () => {
  assert.equal(telegramTarget(1938.5), 1938)
  assert.equal(telegramTarget(1938), 1938)
  assert.equal(telegramTarget(null), null)
  assert.equal(telegramTarget(0.5), null)
})

test('mesaj: prag valid sub prețul de azi → procentul față de azi', () => {
  const s = thresholdStatus('1.938', 2040, 1938)
  assert.equal(s.kind, 'ok')
  assert.equal(s.value, 1938)
  assert.match(s.message, /^Te anunțăm la 1\.938\s?RON sau mai jos \(5% sub prețul de azi\)\.$/)
  assert.equal(s.showReset, false)
  // sub 1% → fără procent
  assert.doesNotMatch(thresholdStatus('2039', 2040, 1938).message, /%/)
  // alt prag decât cel propus → „Folosește pragul propus”
  assert.equal(thresholdStatus('1800', 2040, 1938).showReset, true)
})

test('mesaj: prag la/peste prețul de azi → avertisment, dar acceptat (decizia proprietarului)', () => {
  for (const raw of ['2040', '2.500']) {
    const s = thresholdStatus(raw, 2040, 1938)
    assert.equal(s.kind, 'warn')
    assert.ok(s.value != null)
    assert.match(s.message, /^Pragul e peste prețul de azi \(2\.040\s?RON\): te-am anunța imediat\.$/)
  }
})

test('mesaj: invalid / gol / produs indisponibil', () => {
  const bad = thresholdStatus('abc', 2040, 1938)
  assert.equal(bad.kind, 'err')
  assert.equal(bad.value, null)
  assert.equal(bad.message, 'Scrie o sumă în lei, de exemplu 1.938.')
  assert.equal(thresholdStatus('  ', 2040, 1938).kind, 'empty')
  // fără prag propus: exemplul vine din prețul de azi
  assert.match(thresholdStatus('x', 2000, null).message, /de exemplu 1\.900\./)
  // indisponibil: orice sumă, fără comparație cu „azi”
  const off = thresholdStatus('1.500', null, null)
  assert.equal(off.kind, 'ok')
  assert.match(off.message, /când produsul ajunge la 1\.500\s?RON sau mai jos/)
})
