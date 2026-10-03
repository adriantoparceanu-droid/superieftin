// Teste pentru linkurile semnate ale alertelor pe email (lib/alert-token.ts).
// ACELASI fisier exista in worker/src/lib/alert-token.test.ts (doar importul difera): tokenul de
// referinta prinde orice desincronizare intre semnarea din worker si verificarea din site.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CONFIRM_TTL_S, MANAGE_TTL_S, alertTokenSecret, signAlertToken, verifyAlertToken } from './alert-token'

const S = 'secret-de-referinta'
const NOW = Date.UTC(2026, 9, 3, 12)

test('token de referinta (identic in web si worker)', () => {
  assert.equal(signAlertToken(S, 'm', 42, NOW), 'm.16.tpf2o0.hjO-vHgfhEI9y175pG22Lw')
  assert.equal(signAlertToken(S, 'u', 42, NOW), 'u.16.0.ebM2AicaF_LhawbfeJ-83-')
  assert.equal(verifyAlertToken(S, 'm', 'm.16.tpf2o0.hjO-vHgfhEI9y175pG22Lw', NOW), 42)
})

test('confirmare: valabila pana la expirare, apoi refuzata', () => {
  const t = signAlertToken(S, 'c', 7, NOW)
  assert.equal(verifyAlertToken(S, 'c', t, NOW), 7)
  assert.equal(verifyAlertToken(S, 'c', t, NOW + (CONFIRM_TTL_S - 1) * 1000), 7)
  assert.equal(verifyAlertToken(S, 'c', t, NOW + (CONFIRM_TTL_S + 1) * 1000), null)
})

test('gestionare: expira dupa MANAGE_TTL_S; dezabonarea nu expira', () => {
  const m = signAlertToken(S, 'm', 9, NOW)
  assert.equal(verifyAlertToken(S, 'm', m, NOW + (MANAGE_TTL_S + 1) * 1000), null)
  const u = signAlertToken(S, 'u', 9, NOW)
  assert.equal(verifyAlertToken(S, 'u', u, NOW + 10 * 365 * 24 * 3600 * 1000), 9)
})

test('falsificare: alt secret, alt id, alt tip, semnatura modificata, expirare scoasa', () => {
  const t = signAlertToken(S, 'm', 42, NOW)
  assert.equal(verifyAlertToken('alt-secret', 'm', t, NOW), null)
  const [k, , exp, sig] = t.split('.')
  assert.equal(verifyAlertToken(S, 'm', `${k}.17.${exp}.${sig}`, NOW), null)         // alt abonat
  assert.equal(verifyAlertToken(S, 'u', t, NOW), null)                               // alt tip
  assert.equal(verifyAlertToken(S, 'c', t.replace(/^m/, 'c'), NOW), null)
  assert.equal(verifyAlertToken(S, 'm', t.slice(0, -1) + (t.endsWith('A') ? 'B' : 'A'), NOW), null)
  assert.equal(verifyAlertToken(S, 'm', `${k}.16.0.${sig}`, NOW), null)              // „fara expirare”
  // un token u (fara expirare) nu poate fi refolosit ca m
  const u = signAlertToken(S, 'u', 42, NOW)
  assert.equal(verifyAlertToken(S, 'm', u.replace(/^u/, 'm'), NOW), null)
})

test('intrari invalide', () => {
  for (const bad of [null, undefined, 42, '', 'a.b.c', 'm.16.x', 'm.16.tpf2o0.' + 'x'.repeat(100)]) {
    assert.equal(verifyAlertToken(S, 'm', bad, NOW), null)
  }
  assert.throws(() => signAlertToken(S, 'm', 0, NOW))
  assert.throws(() => signAlertToken(S, 'm', 1.5, NOW))
})

test('secret: doar ALERT_TOKEN_SECRET (fara el, emailul e dezactivat)', () => {
  assert.equal(alertTokenSecret({ ALERT_TOKEN_SECRET: ' abc ' }), 'abc')
  assert.equal(alertTokenSecret({ ADMIN_SESSION_SECRET: 'x' }), null)
})
