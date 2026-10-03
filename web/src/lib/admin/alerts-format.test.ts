// Teste pentru Admin → Alerte (lib/admin/alerts-format.ts). Rulare: cd web && npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  maskEmail, distanceToTargetPct, formatDistance, parseSubscriberStatus, parsePage, parseSearch,
  likeContains, totalPages,
} from './alerts-format'

test('maskEmail: pastreaza max 2 caractere din partea locala + domeniul', () => {
  assert.equal(maskEmail('adrian@kidsport.ro'), 'ad***@kidsport.ro')
  assert.equal(maskEmail('ion.popescu@exemplu.ro'), 'io***@exemplu.ro')
  assert.equal(maskEmail('ionel@x.ro'), 'io***@x.ro')
  // adrese scurte: mai putine caractere, ca sa nu ramana aproape intregi
  assert.equal(maskEmail('ion@x.ro'), 'i***@x.ro')
  assert.equal(maskEmail('ab@x.ro'), 'a***@x.ro')
  assert.equal(maskEmail('a@x.ro'), '***@x.ro')
})

test('maskEmail: lungimea mastii nu tradeaza lungimea adresei', () => {
  assert.equal(maskEmail('ab12345678901234567890@x.ro'), 'ab***@x.ro')
})

test('maskEmail: plus-adresare si @ multiplu → se imparte la ultimul @', () => {
  assert.equal(maskEmail('a+alerte@sub.exemplu.ro'), 'a+***@sub.exemplu.ro')
  assert.equal(maskEmail('"a@b"@x.ro'), '"a***@x.ro')
})

test('maskEmail: valori invalide → doar ***', () => {
  for (const bad of ['', 'fara-arond', '@x.ro', 'ion@']) assert.equal(maskEmail(bad), '***', bad)
})

test('maskEmail: rezultatul nu contine niciodata adresa intreaga', () => {
  for (const e of ['adrian@kidsport.ro', 'ab@x.ro', 'x@y.ro', 'ion@x.ro']) {
    assert.notEqual(maskEmail(e), e)
    assert.ok(maskEmail(e).includes('***'))
  }
})

test('distanceToTargetPct: cat trebuie sa scada pretul pana la prag', () => {
  assert.equal(distanceToTargetPct(1000, 900), 10)
  assert.equal(distanceToTargetPct(1000, 1000), 0)
  assert.ok(distanceToTargetPct(800, 900)! < 0)          // deja sub prag
  assert.equal(Math.round(distanceToTargetPct(2499.99, 2299)! * 100) / 100, 8.04)
})

test('distanceToTargetPct: fara pret disponibil sau date invalide → null', () => {
  assert.equal(distanceToTargetPct(null, 900), null)
  assert.equal(distanceToTargetPct(1000, null), null)
  assert.equal(distanceToTargetPct(0, 900), null)
  assert.equal(distanceToTargetPct(1000, 0), null)
  assert.equal(distanceToTargetPct(Number.NaN, 900), null)
})

test('formatDistance', () => {
  assert.equal(formatDistance(null), '—')
  assert.equal(formatDistance(0), 'atins')
  assert.equal(formatDistance(-3), 'atins')
  assert.equal(formatDistance(10), '−10%')
  assert.equal(formatDistance(8.04), '−8%')
  assert.equal(formatDistance(12.36), '−12,4%')
})

test('parametrii din URL', () => {
  assert.equal(parseSubscriberStatus('confirmati'), 'confirmati')
  assert.equal(parseSubscriberStatus('neconfirmati'), 'neconfirmati')
  assert.equal(parseSubscriberStatus('orice'), 'toti')
  assert.equal(parseSubscriberStatus(undefined), 'toti')

  assert.equal(parsePage(undefined), 1)
  assert.equal(parsePage('3'), 3)
  assert.equal(parsePage(['4', '5']), 4)
  assert.equal(parsePage('0'), 1)
  assert.equal(parsePage('-2'), 1)
  assert.equal(parsePage('2abc'), 1)
  assert.equal(parsePage('999999', 50), 50)

  assert.equal(parseSearch('  AdRiAn@ '), 'adrian@')
  assert.equal(parseSearch('   '), null)
  assert.equal(parseSearch(undefined), null)
  assert.equal(parseSearch('x'.repeat(200))!.length, 100)
})

test('likeContains: %, _ si \\ se cauta literal', () => {
  assert.equal(likeContains('ad'), '%ad%')
  assert.equal(likeContains('a_b%c'), '%a\\_b\\%c%')
  assert.equal(likeContains('a\\b'), '%a\\\\b%')
})

test('totalPages', () => {
  assert.equal(totalPages(0, 25), 1)
  assert.equal(totalPages(25, 25), 1)
  assert.equal(totalPages(26, 25), 2)
})
