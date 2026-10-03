// Teste pentru tokenurile /go/ (lib/go-token.ts). Rulare: cd web && npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  GO_FORM_MAX_AGE_S, GO_FORM_MIN_AGE_S, GO_TOKEN_TTL_S,
  goTokenSecret, isTokenCheckEnabled, matchesTestToken,
  signFormToken, signGoToken, verifyFormToken, verifyGoToken,
} from './go-token'

const S = 'secret-de-test'
const NOW = Date.UTC(2026, 9, 3, 12, 0, 0)

test('token JS: semnat si verificat pentru aceeasi oferta', () => {
  const { token, expiresAt } = signGoToken(S, 123, NOW)
  assert.match(token, /^j\.[0-9a-z]+\.[A-Za-z0-9_-]{22}$/)
  assert.equal(expiresAt, NOW + GO_TOKEN_TTL_S * 1000)
  assert.equal(verifyGoToken(S, 123, token, NOW), true)
  assert.equal(verifyGoToken(S, 123, token, NOW + (GO_TOKEN_TTL_S - 1) * 1000), true)
})

test('token JS: expirat → invalid', () => {
  const { token } = signGoToken(S, 123, NOW)
  assert.equal(verifyGoToken(S, 123, token, NOW + (GO_TOKEN_TTL_S + 1) * 1000), false)
})

test('token JS: alta oferta → invalid', () => {
  const { token } = signGoToken(S, 123, NOW)
  assert.equal(verifyGoToken(S, 124, token, NOW), false)
})

test('token JS: falsificat / alt secret / stricat → invalid', () => {
  const { token } = signGoToken(S, 123, NOW)
  const [k, t, sig] = token.split('.')
  // semnatura modificata
  const flipped = sig.slice(0, -1) + (sig.endsWith('A') ? 'B' : 'A')
  assert.equal(verifyGoToken(S, 123, `${k}.${t}.${flipped}`, NOW), false)
  // expirarea mutata in viitor cu semnatura veche
  const later = (parseInt(t, 36) + 3600).toString(36)
  assert.equal(verifyGoToken(S, 123, `${k}.${later}.${sig}`, NOW), false)
  // semnat cu alt secret
  assert.equal(verifyGoToken('alt-secret', 123, token, NOW), false)
  // token de formular folosit ca token JS
  assert.equal(verifyGoToken(S, 123, signFormToken(S, 123, NOW), NOW), false)
  for (const bad of [null, undefined, '', 'abc', 'j..', 'j.zz', 42, 'j.' + 'z'.repeat(80) + '.x']) {
    assert.equal(verifyGoToken(S, 123, bad, NOW), false, String(bad))
  }
})

test('token JS: expirare prea departe in viitor (nu emitem asa ceva) → invalid', () => {
  const { token } = signGoToken(S, 123, NOW + 3600_000)
  assert.equal(verifyGoToken(S, 123, token, NOW), false)
})

test('token de formular: prea repede, ok, expirat, alta oferta', () => {
  const ft = signFormToken(S, 7, NOW)
  assert.equal(verifyFormToken(S, 7, ft, NOW), 'too_fast')
  assert.equal(verifyFormToken(S, 7, ft, NOW + GO_FORM_MIN_AGE_S * 1000), 'ok')
  assert.equal(verifyFormToken(S, 7, ft, NOW + (GO_FORM_MAX_AGE_S + 1) * 1000), 'invalid')
  assert.equal(verifyFormToken(S, 8, ft, NOW + 5000), 'invalid')
  assert.equal(verifyFormToken(S, 7, ft, NOW - 5000), 'invalid')   // emis „in viitor”
  assert.equal(verifyFormToken(S, 7, signGoToken(S, 7, NOW).token, NOW + 5000), 'invalid')
})

test('secretul: GO_TOKEN_SECRET, altfel derivat din ADMIN_SESSION_SECRET, altfel oprit', () => {
  assert.equal(goTokenSecret({ GO_TOKEN_SECRET: 'abc' }), 'abc')
  const derived = goTokenSecret({ ADMIN_SESSION_SECRET: 'adm' })
  assert.ok(derived && derived !== 'adm' && derived.length === 64)
  assert.equal(goTokenSecret({}), null)
  assert.equal(isTokenCheckEnabled({}), false)
  assert.equal(isTokenCheckEnabled({ GO_TOKEN_SECRET: 'abc' }), true)
  assert.equal(isTokenCheckEnabled({ GO_TOKEN_SECRET: 'abc', GO_TOKEN_CHECK: '0' }), false)
})

test('header de test: doar cu GO_TEST_TOKEN setat si valoare identica', () => {
  assert.equal(matchesTestToken('xyz', 'xyz'), true)
  assert.equal(matchesTestToken('xyz', 'xyz2'), false)
  assert.equal(matchesTestToken('xy', 'xyz'), false)
  assert.equal(matchesTestToken(null, 'xyz'), false)
  assert.equal(matchesTestToken('', ''), false)
  assert.equal(matchesTestToken('xyz', undefined), false)   // env lipsa → exceptia e oprita
  assert.equal(matchesTestToken('xyz', '   '), false)
})
