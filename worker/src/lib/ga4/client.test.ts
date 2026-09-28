import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ga4ConfigFromEnv } from './client.js'

const key = JSON.stringify({ type: 'service_account', client_email: 'ga4@proiect.iam.gserviceaccount.com', private_key: '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n' })

test('ga4ConfigFromEnv: lipsă → null (jobul sare liniștit)', () => {
  assert.equal(ga4ConfigFromEnv({}), null)
  assert.equal(ga4ConfigFromEnv({ GA4_PROPERTY_ID: '123' }), null)
})

test('ga4ConfigFromEnv: cheia ca JSON sau ca base64 dă același rezultat', () => {
  const fromJson = ga4ConfigFromEnv({ GA4_PROPERTY_ID: '123456', GA4_SERVICE_ACCOUNT_JSON: key })
  const fromB64 = ga4ConfigFromEnv({ GA4_PROPERTY_ID: '123456', GA4_SERVICE_ACCOUNT_JSON: Buffer.from(key).toString('base64') })
  assert.deepEqual(fromJson, fromB64)
  assert.equal(fromJson?.clientEmail, 'ga4@proiect.iam.gserviceaccount.com')
  assert.match(fromJson!.privateKey, /BEGIN PRIVATE KEY/)
})

test('ga4ConfigFromEnv: mesaje clare pentru greșelile frecvente', () => {
  assert.throws(() => ga4ConfigFromEnv({ GA4_PROPERTY_ID: 'G-ABC123', GA4_SERVICE_ACCOUNT_JSON: key }), /numeric/)
  assert.throws(() => ga4ConfigFromEnv({ GA4_PROPERTY_ID: '1', GA4_SERVICE_ACCOUNT_JSON: 'nu-e-cheie' }), /nici JSON/)
  assert.throws(() => ga4ConfigFromEnv({ GA4_PROPERTY_ID: '1', GA4_SERVICE_ACCOUNT_JSON: '{"a":1}' }), /client_email/)
})
