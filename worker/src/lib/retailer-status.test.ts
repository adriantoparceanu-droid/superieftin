import { test } from 'node:test'
import assert from 'node:assert/strict'
import { decideState } from './retailer-status.js'

const now = Date.parse('2026-09-27T08:00:00Z')
const base = {
  id: 1, name: 'X', base_url: 'https://x.ro', paused_at: null, pause_reason: null, source_state: null,
  offers_total: 100, last_fresh: new Date(now - 3600_000), last_source: 'profitshare', last_status: 'success',
  last_count: 100, sources: ['profitshare'],
}
const covered = { profitshareCoveredIds: new Set([1]) }
const old = new Date(now - 10 * 24 * 3600_000)

test('decideState: cazurile reale din sep 2026', () => {
  assert.equal(decideState(base, covered, true, now).state, 'ok')
  // pauza manuala bate orice
  assert.equal(decideState({ ...base, paused_at: new Date(now) }, covered, true, now).state, 'paused')
  // ForIT: Profitshare trimite feed gol → respins cu 0 produse
  assert.equal(decideState({ ...base, last_fresh: old, last_status: 'rejected', last_count: 0 }, covered, true, now).state, 'feed_empty')
  assert.equal(decideState({ ...base, last_fresh: old, last_status: 'rejected', last_count: 40 }, covered, true, now).state, 'feed_rejected')
  // CITGrup: avea feed Profitshare, nu mai e in lista activa
  assert.equal(decideState({ ...base, last_fresh: old }, { profitshareCoveredIds: new Set() }, true, now).state, 'feed_missing')
  assert.equal(decideState({ ...base, last_fresh: old }, covered, false, now).state, 'program_inactive')
  // eMAG: scanare fara produse noi
  assert.equal(decideState({ ...base, last_fresh: old, last_source: 'scraper', sources: ['scraper'] }, covered, null, now).state, 'scan_failed')
  assert.equal(decideState({ ...base, last_fresh: old, last_source: '2performant', sources: ['2performant'] }, covered, true, now).state, 'feed_error')
  assert.equal(decideState({ ...base, last_fresh: old, last_source: 'upload', sources: ['upload'] }, covered, null, now).state, 'manual_only')
  assert.equal(decideState({ ...base, offers_total: 0, last_fresh: null }, covered, null, now).state, 'empty')
})
