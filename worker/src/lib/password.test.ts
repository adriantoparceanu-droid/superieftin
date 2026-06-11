import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hashPassword, verifyPassword } from './password.js'

test('hashPassword/verifyPassword — roundtrip si respingere', () => {
  const hash = hashPassword('parola-mea-secreta')
  assert.match(hash, /^scrypt:16384:8:1:[0-9a-f]{32}:[0-9a-f]{128}$/)
  assert.equal(verifyPassword('parola-mea-secreta', hash), true)
  assert.equal(verifyPassword('parola-gresita', hash), false)
  assert.equal(verifyPassword('orice', 'format-invalid'), false)
})
