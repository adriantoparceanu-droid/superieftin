import { test } from 'node:test'
import assert from 'node:assert/strict'
import { planSync, formatRo, maskId, maskIdsInText, type ConversionRow } from './core.js'
import { runTrackingSync } from './sync.js'
import type { AdsConfig } from '../ads/google-ads.js'
import type { PsCommissionRaw } from '../lib/profitshare.js'

const NOW = new Date('2026-09-26T09:00:00Z')
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86400_000)

function row(over: Partial<ConversionRow> = {}): ConversionRow {
  return {
    id: 1, externalId: '1001', status: 'pending', amount: 10, orderTime: daysAgo(2),
    uploadedAt: null, uploadedValue: null, retractedAt: null,
    clickId: 'abc123def456', adClickId: 7, hasAdConsent: true,
    gclid: 'Cj0KCQtestgclid', gbraid: null, wbraid: null, clickTime: daysAgo(3), ...over,
  }
}

test('planSync — trimite doar comisioanele cu click din reclama, cu acord, netrimise', () => {
  const p = planSync([
    row({ id: 1 }),                                                  // ✓ de trimis
    row({ id: 2, status: 'approved' }),                              // ✓ si aprobatele
    row({ id: 3, hasAdConsent: false }),                             // fara acord → nimic la Google
    row({ id: 4, gclid: null }),                                     // cu acord, fara reclama
    row({ id: 5, clickId: null, adClickId: null }),                  // fara subID
    row({ id: 6, adClickId: null }),                                 // hash necunoscut
    row({ id: 7, amount: 0 }),
    row({ id: 8, clickTime: daysAgo(91) }),                          // click prea vechi
    row({ id: 9, gclid: null, wbraid: 'wbraidtest' }),               // ✓ iOS
    row({ id: 10, isInternal: true }),                               // click din admin / test
  ], NOW)
  assert.deepEqual(p.uploads.map((r) => r.id), [1, 2, 9])
  assert.equal(p.skipped.click_intern, 1)
  assert.equal(p.skipped.fara_acord, 1)
  assert.equal(p.skipped.fara_id_google, 1)
  assert.equal(p.skipped.fara_click_id, 1)
  assert.equal(p.skipped.click_negasit, 1)
  assert.equal(p.skipped.valoare_zero, 1)
  assert.equal(p.skipped.click_expirat, 1)
})

test('planSync — retrage doar ce a fost trimis si anulat, o singura data', () => {
  const p = planSync([
    row({ id: 1, status: 'rejected', uploadedAt: daysAgo(1) }),                          // ✓ de retras
    row({ id: 2, status: 'rejected', uploadedAt: daysAgo(5), retractedAt: daysAgo(1) }), // deja retras
    row({ id: 3, status: 'rejected' }),                                                  // anulat inainte de trimitere
  ], NOW)
  assert.deepEqual(p.retractions.map((r) => r.id), [1])
  assert.equal(p.skipped.respins_netrimis, 1)
  assert.equal(p.uploads.length, 0)
})

test('planSync — idempotent: ce are uploaded_at nu se retrimite; valoarea schimbata doar se semnaleaza', () => {
  const p = planSync([
    row({ id: 1, uploadedAt: daysAgo(1), uploadedValue: 10 }),
    row({ id: 2, status: 'approved', amount: 8, uploadedAt: daysAgo(1), uploadedValue: 10 }),
  ], NOW)
  assert.equal(p.uploads.length, 0)
  assert.equal(p.alreadyUploaded, 2)
  assert.deepEqual(p.valueChanged.map((r) => r.id), [2])
})

test('formatRo — ora contului (Europe/Bucharest) cu offset, in ambele formate', () => {
  assert.equal(formatRo(new Date('2026-09-20T11:30:00Z'), 'rfc3339'), '2026-09-20T14:30:00+03:00')
  assert.equal(formatRo(new Date('2026-01-15T08:00:05Z'), 'ads'), '2026-01-15 10:00:05+02:00')
})

test('maskId — in loguri apar doar ultimele 4 caractere', () => {
  assert.equal(maskId({ gclid: 'Cj0KCQtestABCD', gbraid: null, wbraid: null }), 'gclid:…ABCD')
  assert.equal(maskId({ gclid: null, gbraid: null, wbraid: null }), '-')
})

// --- runTrackingSync cap-coada, pe o baza de date falsa in memorie (fara Postgres, fara retea) ---

interface Conv { id: number; external_id: string; click_id: string | null; ad_click_id: number | null; status: string; commission_amount: number; order_time: Date; uploaded_at: Date | null; uploaded_value: number | null; retracted_at: Date | null; last_error: string | null }
interface Click { id: number; click_id: string; has_ad_consent: boolean; gclid: string | null; gbraid: string | null; wbraid: string | null; created_at: Date; ad_click_at?: Date | null }

// Imita strict cele cateva interogari din tracking/sync.ts
function fakeDb(clicks: Click[]) {
  const convs: Conv[] = []
  const query = async (sql: string, params: any[] = []) => {
    if (sql.includes('INSERT INTO affiliate_conversions')) {
      const [externalId, clickId, , status, amount, orderTime] = params
      const adClickId = clicks.find((c) => c.click_id === clickId)?.id ?? null
      const ex = convs.find((c) => c.external_id === externalId)
      if (!ex) {
        convs.push({ id: convs.length + 1, external_id: externalId, click_id: clickId, ad_click_id: adClickId, status, commission_amount: amount, order_time: orderTime, uploaded_at: null, uploaded_value: null, retracted_at: null, last_error: null })
        return { rows: [{ inserted: true }], rowCount: 1 }
      }
      const changed = ex.status !== status || ex.commission_amount !== amount || ex.click_id !== clickId
      if (!changed) return { rows: [], rowCount: 0 }
      Object.assign(ex, { status, commission_amount: amount, click_id: clickId, ad_click_id: adClickId ?? ex.ad_click_id })
      return { rows: [{ inserted: false }], rowCount: 1 }
    }
    if (sql.includes('FROM affiliate_conversions ac')) {
      return { rows: convs.map((c) => {
        const k = clicks.find((x) => x.id === c.ad_click_id)
        return { id: c.id, external_id: c.external_id, status: c.status, amount: c.commission_amount, order_time: c.order_time, uploaded_at: c.uploaded_at, uploaded_value: c.uploaded_value, retracted_at: c.retracted_at, click_id: c.click_id, ad_click_id: c.ad_click_id, has_ad_consent: k?.has_ad_consent ?? null, gclid: k?.gclid ?? null, gbraid: k?.gbraid ?? null, wbraid: k?.wbraid ?? null, click_time: k ? (k.ad_click_at ?? k.created_at) : null }
      }), rowCount: convs.length }
    }
    if (sql.includes('SET uploaded_at')) { const c = convs.find((x) => x.id === params[0])!; c.uploaded_at = new Date(); c.uploaded_value = c.commission_amount; return { rows: [], rowCount: 1 } }
    if (sql.includes('SET retracted_at')) { convs.find((x) => x.id === params[0])!.retracted_at = new Date(); return { rows: [], rowCount: 1 } }
    if (sql.includes('SET last_error')) { convs.find((x) => x.id === params[0])!.last_error = params[1]; return { rows: [], rowCount: 1 } }
    if (sql.includes('UPDATE ad_clicks SET gclid = NULL')) {
      // Imita: COALESCE(ad_click_at, created_at) < now() - 90 zile, doar randuri cu ID Google
      assert.match(sql, /COALESCE\(ad_click_at, created_at\)/)
      const limit = Date.now() - params[0] * 86400_000
      let n = 0
      for (const c of clicks) {
        if ((c.ad_click_at ?? c.created_at).getTime() < limit && (c.gclid || c.gbraid || c.wbraid)) { c.gclid = c.gbraid = c.wbraid = null; n++ }
      }
      return { rows: [], rowCount: n }
    }
    throw new Error('interogare neasteptata in test: ' + sql.slice(0, 80))
  }
  return { db: { query } as any, convs }
}

const prodCfg: AdsConfig = { clientId: 'x', clientSecret: 'x', refreshToken: 'x', customerId: '2760086909', env: 'prod' }
const recentClick = new Date(Date.now() - 2 * 86400_000)
const orderDate = (() => { const d = new Date(Date.now() - 86400_000); return d.toISOString().slice(0, 10) + ' 12:00:00' })()
const commission = (status: string): PsCommissionRaw => ({
  order_id: 555, order_status: status, advertiser_id: 35, hash: 'clickcuads01', order_date: orderDate,
  items_status: status, items_commision: '20.00',
})

test('runTrackingSync — send de doua ori nu trimite dubluri; anularea se retrage o singura data', async () => {
  const { db, convs } = fakeDb([{ id: 7, click_id: 'clickcuads01', has_ad_consent: true, gclid: 'Cj0KCQtestgclid', gbraid: null, wbraid: null, created_at: recentClick }])
  const sent: any[] = []
  const retracted: any[] = []
  let api: PsCommissionRaw[] = [commission('pending')]      // „API-ul Profitshare”
  const deps = {
    cfg: prodCfg,
    fetchCommissions: (async () => api) as any,
    ingest: (async (_c: any, action: string, ev: any, o: any) => { sent.push({ action, ev, o }); return { validateOnly: false, warnings: [] } }) as any,
    retract: (async (_c: any, _a: string, items: any[]) => { retracted.push(...items); return { validateOnly: false, errorsByIndex: new Map() } }) as any,
  }
  const run = () => runTrackingSync({ db, mode: 'send', conversionActionId: '999', deps, log: () => {} })

  const r1 = await run()
  assert.equal(r1.uploaded, 1)
  assert.equal(sent.length, 1)
  assert.equal(sent[0].action, '999')
  assert.equal(sent[0].ev.transactionId, '555')
  assert.equal(sent[0].ev.value, 20)
  assert.equal(sent[0].o.validateOnly, false)
  assert.ok(convs[0].uploaded_at)

  const r2 = await run()                                   // a doua rulare, nimic nou
  assert.equal(r2.uploaded, 0)
  assert.equal(r2.plan.alreadyUploaded, 1)
  assert.equal(sent.length, 1, 'fara dubluri')

  api = [commission('canceled')]                            // comanda se anuleaza
  const r3 = await run()
  assert.equal(r3.retracted, 1)
  assert.deepEqual(retracted.map((x) => x.orderId), ['555'])
  const r4 = await run()
  assert.equal(r4.retracted, 0, 'retragerea nu se repeta')
  assert.equal(retracted.length, 1)
})

test('runTrackingSync — validate_only nu marcheaza nimic; plan nu contacteaza Google', async () => {
  const { db, convs } = fakeDb([{ id: 7, click_id: 'clickcuads01', has_ad_consent: true, gclid: 'Cj0KCQtestgclid', gbraid: null, wbraid: null, created_at: recentClick }])
  let calls = 0
  const deps = { cfg: prodCfg, ingest: (async () => { calls++; return { validateOnly: true, warnings: [] } }) as any }
  const p = await runTrackingSync({ db, mode: 'plan', fixture: [commission('pending')], conversionActionId: '999', deps, log: () => {} })
  assert.equal(p.plan.uploads, 1)
  assert.equal(calls, 0)
  const v1 = await runTrackingSync({ db, mode: 'validate', fixture: [commission('pending')], conversionActionId: '999', deps, log: () => {} })
  const v2 = await runTrackingSync({ db, mode: 'validate', fixture: [commission('pending')], conversionActionId: '999', deps, log: () => {} })
  assert.equal(p.inserted, 1, 'plan actualizeaza doar baza noastra')
  assert.equal(v1.inserted + v1.updated, 0, 'rularile urmatoare nu schimba nimic in baza')
  assert.equal(v2.inserted + v2.updated, 0)
  assert.equal(calls, 2, 'validate re-verifica zilnic, dar fara efect')
  assert.equal(convs[0].uploaded_at, null)
})

test('runTrackingSync — fara acord la click: nimic nu pleaca la Google', async () => {
  const { db } = fakeDb([{ id: 7, click_id: 'clickcuads01', has_ad_consent: false, gclid: null, gbraid: null, wbraid: null, created_at: recentClick }])
  let calls = 0
  const deps = { cfg: prodCfg, ingest: (async () => { calls++; return {} }) as any }
  const r = await runTrackingSync({ db, mode: 'validate', fixture: [commission('pending')], conversionActionId: '999', deps, log: () => {} })
  assert.equal(r.matched, 1)
  assert.equal(r.plan.skipped.fara_acord, 1)
  assert.equal(calls, 0)
})

test('runTrackingSync — refuza fixture la trimiterea reala si send fara ADS_ENV=prod', async () => {
  const { db } = fakeDb([])
  await assert.rejects(runTrackingSync({ db, mode: 'send', fixture: [], conversionActionId: '999', deps: { cfg: prodCfg }, log: () => {} }), /fixture/)
  await assert.rejects(runTrackingSync({ db, mode: 'send', conversionActionId: '999', deps: { cfg: { ...prodCfg, env: 'test' } }, log: () => {} }), /ADS_ENV/)
})

// --- Poarta 2 GDPR: B3 (retentie dupa ad_click_at, stergere independenta) + R3 (mascare) ---

test('maskIdsInText — ID-urile randului nu raman intregi in mesajele de eroare', () => {
  const r = { gclid: 'Cj0KCQtestgclidWXYZ', gbraid: null, wbraid: null }
  assert.equal(maskIdsInText('INVALID_GCLID: Cj0KCQtestgclidWXYZ nu exista (Cj0KCQtestgclidWXYZ)', r), 'INVALID_GCLID: …WXYZ nu exista (…WXYZ)')
  assert.equal(maskIdsInText('fara id', r), 'fara id')
})

test('runTrackingSync — retentia si fereastra de upload se socotesc de la clickul pe reclama (ad_click_at)', async () => {
  const days = (n: number) => new Date(Date.now() - n * 86400_000)
  const clicks: Click[] = [
    // /go acum 2 zile, dar reclama acum 95 de zile (cookie vechi) → expirat: nu se trimite, se sterge
    { id: 7, click_id: 'clickcuads01', has_ad_consent: true, gclid: 'Cj0KCQvechi0001', gbraid: null, wbraid: null, created_at: days(2), ad_click_at: days(95) },
    // reclama acum 10 zile → valid
    { id: 8, click_id: 'clickcuads02', has_ad_consent: true, gclid: 'Cj0KCQnou00002', gbraid: null, wbraid: null, created_at: days(2), ad_click_at: days(10) },
    // rand vechi, fara ad_click_at: /go acum 100 de zile → se sterge dupa created_at
    { id: 9, click_id: 'clickvechi03', has_ad_consent: true, gclid: null, gbraid: 'gbraidvechi003', wbraid: null, created_at: days(100), ad_click_at: null },
  ]
  const { db } = fakeDb(clicks)
  const fixture = [
    { ...commission('pending'), order_id: 1, hash: 'clickcuads01' },
    { ...commission('pending'), order_id: 2, hash: 'clickcuads02' },
  ]
  const r = await runTrackingSync({ db, mode: 'plan', fixture, conversionActionId: '999', deps: { cfg: prodCfg }, log: () => {} })
  assert.equal(r.plan.uploads, 1, 'doar clickul pe reclama din ultimele 90 de zile')
  assert.equal(r.plan.skipped.click_expirat, 1)
  assert.equal(r.purgedClickIds, 2)
  assert.equal(clicks[0].gclid, null)
  assert.equal(clicks[1].gclid, 'Cj0KCQnou00002')
  assert.equal(clicks[2].gbraid, null)
})

test('runTrackingSync — stergerea de retentie ruleaza si cand Profitshare esueaza', async () => {
  const clicks: Click[] = [
    { id: 7, click_id: 'clickcuads01', has_ad_consent: true, gclid: 'Cj0KCQvechi0001', gbraid: null, wbraid: null, created_at: new Date(Date.now() - 91 * 86400_000) },
  ]
  const { db } = fakeDb(clicks)
  const logs: string[] = []
  const deps = { cfg: prodCfg, fetchCommissions: (async () => { throw new Error('Profitshare HTTP 503') }) as any }
  await assert.rejects(runTrackingSync({ db, mode: 'validate', conversionActionId: '999', deps, log: (m) => logs.push(m) }), /Profitshare HTTP 503/)
  assert.equal(clicks[0].gclid, null, 'ID-ul expirat e sters chiar daca sincronizarea a esuat')
  assert.ok(logs.some((l) => /ștergerea de retenție a rulat: gclid șterse \(>90 zile\)=1/.test(l)))
})

test('runTrackingSync — gclid-ul din eroarea Google se salveaza mascat in last_error', async () => {
  const gclid = 'Cj0KCQtestgclidABCD'
  const { db, convs } = fakeDb([{ id: 7, click_id: 'clickcuads01', has_ad_consent: true, gclid, gbraid: null, wbraid: null, created_at: recentClick }])
  const deps = { cfg: prodCfg, ingest: (async () => { throw new Error(`INVALID_ARGUMENT: gclid ${gclid} not found`) }) as any }
  const r = await runTrackingSync({ db, mode: 'validate', fixture: [commission('pending')], conversionActionId: '999', deps, log: () => {} })
  assert.equal(r.errors.length, 1)
  assert.doesNotMatch(convs[0].last_error!, new RegExp(gclid))
  assert.match(convs[0].last_error!, /…ABCD/)
  assert.doesNotMatch(r.errors[0].error, new RegExp(gclid))
})
