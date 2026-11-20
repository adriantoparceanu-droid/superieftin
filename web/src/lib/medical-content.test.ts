// Teste scurte pentru lib/medical-content.ts (copia din web). Setul complet + paritatea cu worker-ul
// sunt in worker/src/lib/medical-content.test.ts. Rulare: cd web && npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { findHealthClaims, medicalProductErrors, isHealthTree } from './medical-content'
import { findHealthClaims as fromFormat } from './guides/format'

test('format.ts re-exporta aceeasi functie', () => {
  assert.equal(fromFormat, findHealthClaims)
})

test('afirmatii de sanatate prinse, texte normale lasate in pace', () => {
  assert.deepEqual(findHealthClaims('Întărește imunitatea și ajută la slăbit.'), ['imunitatea', 'la slabit'])
  assert.deepEqual(findHealthClaims('Folia previne zgârieturile, iar ecranul are tratament antireflex.'), [])
})

test('ghid: produs medical din arborele de sanatate → refuzat; acelasi nume in IT → ignorat', () => {
  assert.equal(medicalProductErrors([{ ref: 'x', name: 'Magneziu 60 capsule', healthTree: true }]).length, 1)
  assert.equal(medicalProductErrors([{ ref: 'x', name: 'Ceai de tei, 20 plicuri', healthTree: true }]).length, 0)
  assert.equal(medicalProductErrors([{ ref: 'x', name: 'Tabletă Lenovo Tab M11', healthTree: false }]).length, 0)
  assert.equal(isHealthTree('farmacie-veterinara', ['animale-de-companie']), true)
})
