// Teste pentru lista alba a protectiei /go/ (isGoWhitelisted din lib/internal-traffic.ts).
// Rulare: cd web && npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { isGoWhitelisted, isInternalRequest } from './internal-traffic'
import { buildToken } from './admin/session'

// Secretul sesiunii de admin e citit la fiecare apel (admin/session.ts), deci il putem pune aici
process.env.ADMIN_SESSION_SECRET = 'secret-admin-test'

const UA_BROWSER = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36'

function req(headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost:3000/go/1', { headers: { 'user-agent': UA_BROWSER, ...headers } })
}

test('vizitator obisnuit: NU e pe lista alba', () => {
  assert.equal(isGoWhitelisted(req(), { GO_TEST_TOKEN: 'tt' }), false)
})

test('robot cu user-agent de robot: intern, dar NU pe lista alba (nu ocoleste protectia)', () => {
  const r = req({ 'user-agent': 'curl/8.4.0' })
  assert.equal(isInternalRequest(r), true)
  assert.equal(isGoWhitelisted(r, {}), false)
})

test('cookie se_intern → lista alba', () => {
  assert.equal(isGoWhitelisted(req({ cookie: 'se_intern=1' }), {}), true)
  assert.equal(isGoWhitelisted(req({ cookie: 'se_intern=0' }), {}), false)
})

test('sesiune admin valida → lista alba; sesiune falsificata → nu', () => {
  assert.equal(isGoWhitelisted(req({ cookie: `admin_session=${buildToken(1)}` }), {}), true)
  assert.equal(isGoWhitelisted(req({ cookie: 'admin_session=abc.def' }), {}), false)
})

test('header de test: trece doar cu GO_TEST_TOKEN setat si egal', () => {
  const env = { GO_TEST_TOKEN: 'secret-test-123' }
  assert.equal(isGoWhitelisted(req({ 'x-go-test-token': 'secret-test-123' }), env), true)
  assert.equal(isGoWhitelisted(req({ 'x-go-test-token': 'gresit' }), env), false)
  assert.equal(isGoWhitelisted(req({ 'x-go-test-token': 'secret-test-123' }), {}), false)
  assert.equal(isGoWhitelisted(req({ 'x-go-test-token': '' }), { GO_TEST_TOKEN: '' }), false)
})
