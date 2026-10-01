import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compileCategoryFilter, importsNothing, normalizeFeedCategory } from './feed-category-filter.js'

test('normalizeFeedCategory — majuscule si spatii la capete', () => {
  assert.equal(normalizeFeedCategory('  Huse Telefoane '), 'huse telefoane')
  assert.equal(normalizeFeedCategory(null), '')
  assert.equal(normalizeFeedCategory(undefined), '')
})

test('filtru NULL — importa tot (comportamentul vechi)', () => {
  const ok = compileCategoryFilter(null)
  assert.equal(ok('Huse Telefoane'), true)
  assert.equal(ok(''), true)
  assert.equal(importsNothing(null), false)
})

test('filtru gol — nu importa nimic', () => {
  assert.equal(importsNothing([]), true)
  const ok = compileCategoryFilter([])
  assert.equal(ok('Telefoane'), false)
})

test('filtru cu lista — doar categoriile alese, fara diferenta de majuscule/spatii', () => {
  const ok = compileCategoryFilter(['Telefoane', ' Casti bluetooth, wireless, airpods si audio'])
  assert.equal(importsNothing(['Telefoane']), false)
  assert.equal(ok('telefoane'), true)
  assert.equal(ok('  TELEFOANE  '), true)
  assert.equal(ok('Casti bluetooth, wireless, airpods si audio'), true)
  assert.equal(ok('Huse Telefoane'), false)
  assert.equal(ok('Car Kit'), false)
  // „Telefoane” nu prinde „Huse Telefoane” (potrivire exacta, nu „contine”)
  assert.equal(ok('Telefoane mobile'), false)
})

test('filtru cu categoria goala — feed-uri fara <category>', () => {
  const ok = compileCategoryFilter([''])
  assert.equal(ok(''), true)
  assert.equal(ok('   '), true)
  assert.equal(ok('Telefoane'), false)
})
