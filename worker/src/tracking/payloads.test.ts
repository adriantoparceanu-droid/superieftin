import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseCommission, parseRoDateTime, type PsCommissionRaw } from '../lib/profitshare.js'
import { buildIngestBody, pickAdIdentifier } from '../ads/data-manager.js'
import { buildRetractionBody, parsePartialFailure, errorCodes, type AdsConfig } from '../ads/google-ads.js'

// Randuri in forma reala a API-ului affiliate-commissions (valori inventate, structura
// verificata live pe 2026-09-26: sume ca text, items_* separate prin „|”, hash null fara subID).
function raw(over: Partial<PsCommissionRaw> = {}): PsCommissionRaw {
  return {
    order_id: 123456, order_status: 'pending', advertiser_id: 35, hash: 'abc123def456',
    order_date: '2026-09-20 14:30:00', order_updated: '2026-09-20 14:35:00',
    items_status: 'pending', items_commision: '12.3456', items_commision_value: '4.00',
    advertiser_name: 'eMAG.ro', ...over,
  }
}

const cfg: AdsConfig = { clientId: 'x', clientSecret: 'x', refreshToken: 'x', customerId: '2760086909', env: 'test' }

test('parseCommission — un produs, pending, hash = click_id', () => {
  const p = parseCommission(raw())
  assert.equal(p.externalId, '123456')
  assert.equal(p.clickId, 'abc123def456')
  assert.equal(p.status, 'pending')
  assert.equal(p.amount, 12.35)
  assert.equal(p.advertiserId, '35')
  assert.equal(p.unknownStatus, undefined)
})

test('parseCommission — mai multe produse: suma doar a celor neanulate', () => {
  const p = parseCommission(raw({ items_status: 'pending|canceled|approved', items_commision: '10.00|5.50|2.25' }))
  assert.equal(p.amount, 12.25)
})

test('parseCommission — comanda anulata → rejected, suma totala informativa', () => {
  const p = parseCommission(raw({ order_status: 'canceled', items_status: 'canceled|canceled', items_commision: '1.10|2.20' }))
  assert.equal(p.status, 'rejected')
  assert.equal(p.amount, 3.3)
})

test('parseCommission — approved si paid → approved; status necunoscut → pending + semnalat', () => {
  assert.equal(parseCommission(raw({ order_status: 'approved' })).status, 'approved')
  assert.equal(parseCommission(raw({ order_status: 'paid' })).status, 'approved')
  const u = parseCommission(raw({ order_status: 'ciudat' }))
  assert.equal(u.status, 'pending')
  assert.equal(u.unknownStatus, 'ciudat')
})

test('parseCommission — hash null / gol / cu caractere dubioase → fara click_id', () => {
  assert.equal(parseCommission(raw({ hash: null })).clickId, null)
  assert.equal(parseCommission(raw({ hash: '' })).clickId, null)
  assert.equal(parseCommission(raw({ hash: "x' OR 1=1" })).clickId, null)
})

test('parseRoDateTime — ora Romaniei, vara (+03:00) si iarna (+02:00)', () => {
  assert.equal(parseRoDateTime('2026-09-20 14:30:00').toISOString(), '2026-09-20T11:30:00.000Z')
  assert.equal(parseRoDateTime('2026-01-15 10:00:00').toISOString(), '2026-01-15T08:00:00.000Z')
  // ziua schimbarii orei (25 oct 2026, 04:00 EEST → 03:00 EET): dupa-amiaza e deja iarna
  assert.equal(parseRoDateTime('2026-10-25 15:00:00').toISOString(), '2026-10-25T13:00:00.000Z')
  assert.throws(() => parseRoDateTime('20/09/2026'))
})

test('pickAdIdentifier — exact un identificator, gclid are prioritate', () => {
  assert.deepEqual(pickAdIdentifier({ gclid: 'G', gbraid: 'B' }), { gclid: 'G' })
  assert.deepEqual(pickAdIdentifier({ gclid: null, gbraid: 'B', wbraid: 'W' }), { gbraid: 'B' })
  assert.deepEqual(pickAdIdentifier({ wbraid: 'W' }), { wbraid: 'W' })
  assert.equal(pickAdIdentifier({}), null)
})

test('buildIngestBody — Data Manager: destinatie, consimtamant, RON, transactionId, fara date personale', () => {
  const body = buildIngestBody(cfg, '999', {
    ids: { gclid: 'Cj0KCQtest' }, value: 12.35, eventTimestamp: '2026-09-20T14:30:00+03:00', transactionId: '123456',
  }, true)
  assert.deepEqual(body, {
    destinations: [{ operatingAccount: { accountType: 'GOOGLE_ADS', accountId: '2760086909' }, productDestinationId: '999' }],
    // B2 (GDPR): personalizarea NU e acordata de banner → mereu DENIED
    consent: { adUserData: 'CONSENT_GRANTED', adPersonalization: 'CONSENT_DENIED' },
    validateOnly: true,
    events: [{
      adIdentifiers: { gclid: 'Cj0KCQtest' }, conversionValue: 12.35, currency: 'RON',
      eventTimestamp: '2026-09-20T14:30:00+03:00', transactionId: '123456', eventSource: 'WEB',
    }],
  })
  // Garantie: niciun camp de date personale in cerere
  assert.doesNotMatch(JSON.stringify(body.events), /userData|email|phone|ipAddress/i)
  assert.throws(() => buildIngestBody(cfg, '999', { ids: {}, value: 1, eventTimestamp: 'x', transactionId: '1' }, true))
})

test('buildRetractionBody — RETRACTION dupa orderId, partialFailure obligatoriu', () => {
  const body = buildRetractionBody(cfg, '999', [{ orderId: '123456', adjustmentDateTime: '2026-09-26 10:00:00+03:00' }], true)
  assert.deepEqual(body, {
    conversionAdjustments: [{
      conversionAction: 'customers/2760086909/conversionActions/999', adjustmentType: 'RETRACTION',
      orderId: '123456', adjustmentDateTime: '2026-09-26 10:00:00+03:00',
    }],
    partialFailure: true,
    validateOnly: true,
  })
})

test('parsePartialFailure — erorile per rand (forma reala a raspunsului Google)', () => {
  const r = parsePartialFailure({
    partialFailureError: { code: 3, details: [{ errors: [
      { errorCode: { conversionAdjustmentUploadError: 'CONVERSION_NOT_FOUND' }, message: 'nu exista', location: { fieldPathElements: [{ fieldName: 'conversion_adjustments', index: 1 }, { fieldName: 'order_id' }] } },
    ] }] },
    jobId: '42',
  })
  assert.equal(r.errorsByIndex.size, 1)
  assert.match(r.errorsByIndex.get(1)!, /CONVERSION_NOT_FOUND/)
  assert.equal(r.jobId, '42')
  assert.equal(parsePartialFailure({}).errorsByIndex.size, 0)
})

test('errorCodes — Ads API, ErrorInfo si BadRequest', () => {
  assert.deepEqual(errorCodes({ error: { details: [{ errors: [{ errorCode: { authorizationError: 'USER_PERMISSION_DENIED' } }] }] } }), ['authorizationError.USER_PERMISSION_DENIED'])
  assert.deepEqual(errorCodes({ error: { status: 'PERMISSION_DENIED', details: [{ reason: 'ACCESS_TOKEN_SCOPE_INSUFFICIENT' }] } }), ['ACCESS_TOKEN_SCOPE_INSUFFICIENT'])
  assert.deepEqual(errorCodes({ error: { status: 'INVALID_ARGUMENT', details: [{ fieldViolations: [{ field: 'events[0].ad_identifiers.gclid', reason: 'INVALID_GCLID' }] }] } }), ['events[0].ad_identifiers.gclid: INVALID_GCLID'])
  assert.deepEqual(errorCodes({ error: { status: 'INTERNAL' } }), ['INTERNAL'])
})
