// Teste pentru regulile alertelor pe email (lib/email-alerts.ts). Rulare: cd web && npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { emailAlertsEnabled, normalizeEmail, parseTargetPrice, targetBelowCurrent } from './email-alerts'

test('activ doar cu SMTP_HOST + EMAIL_FROM + ALERT_TOKEN_SECRET', () => {
  const ok = { SMTP_HOST: 'smtp-relay.brevo.com', EMAIL_FROM: 'alerte@superieftin.ro', ALERT_TOKEN_SECRET: 'x' }
  assert.equal(emailAlertsEnabled(ok), true)
  assert.equal(emailAlertsEnabled({}), false)
  assert.equal(emailAlertsEnabled({ ...ok, SMTP_HOST: ' ' }), false)
  assert.equal(emailAlertsEnabled({ ...ok, EMAIL_FROM: '' }), false)
  assert.equal(emailAlertsEnabled({ ...ok, ALERT_TOKEN_SECRET: '' }), false)
})

test('email: normalizat si validat', () => {
  assert.equal(normalizeEmail('  Ion.Popescu@Exemplu.RO '), 'ion.popescu@exemplu.ro')
  assert.equal(normalizeEmail('a+alerte@sub.exemplu.ro'), 'a+alerte@sub.exemplu.ro')
  for (const bad of ['', 'fara-arond', 'a@b', 'a@@b.ro', 'a b@c.ro', 'a..b@c.ro', 'x@-a.ro', null, 42, 'a@b.ro\r\nBcc: x@y.ro', `${'a'.repeat(250)}@b.ro`]) {
    assert.equal(normalizeEmail(bad), null, String(bad))
  }
})

test('prag: formate romanesti, limite', () => {
  assert.equal(parseTargetPrice('1610'), 1610)
  assert.equal(parseTargetPrice('1.299,90'), 1299.9)
  assert.equal(parseTargetPrice('1299.9'), 1299.9)
  assert.equal(parseTargetPrice('1 299'), 1299)
  assert.equal(parseTargetPrice(1610), 1610)
  assert.equal(parseTargetPrice('12.345'), 12345)   // punct = separator de mii, ca in romana
  for (const bad of ['', 'abc', '0', '-5', '0.5', '100001', '1.5.6', null]) assert.equal(parseTargetPrice(bad), null, String(bad))
})

test('prag sub cel mai mic pret de acum (altfel alerta ar pleca imediat)', () => {
  assert.equal(targetBelowCurrent(1610, 1699.99), true)
  assert.equal(targetBelowCurrent(1699.99, 1699.99), false)
  assert.equal(targetBelowCurrent(5000, null), true)
})
