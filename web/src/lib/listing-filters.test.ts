// Teste pentru filtrele paginii de categorie (lib/listing-filters.ts). Rulare: cd web && npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  parseBrandParam, parseSortParam, brandsForQuery, buildListingUrl, brandTitlePart,
  normalizeForSearch, orderBrandOptions, filterBrandOptions, countForSelection, MAX_BRANDS,
} from './listing-filters'

test('parseBrandParam: ?brand=X simplu (compatibil inapoi) si parametru repetat', () => {
  assert.deepEqual(parseBrandParam(undefined), [])
  assert.deepEqual(parseBrandParam('Samsung'), ['Samsung'])
  assert.deepEqual(parseBrandParam(['Samsung', 'Apple']), ['Samsung', 'Apple'])
})

test('parseBrandParam: curata spatii, valori goale si dubluri', () => {
  assert.deepEqual(parseBrandParam(['  Samsung ', '', '   ', 'Samsung', 'Apple']), ['Samsung', 'Apple'])
  assert.deepEqual(parseBrandParam(''), [])
})

test('parseBrandParam: limita de marci si de lungime', () => {
  const many = Array.from({ length: 50 }, (_, i) => `M${i}`)
  assert.equal(parseBrandParam(many).length, MAX_BRANDS)
  assert.deepEqual(parseBrandParam(['x'.repeat(101), 'LG']), ['LG'])
})

test('parseSortParam: valori necunoscute → price', () => {
  assert.equal(parseSortParam(undefined), 'price')
  assert.equal(parseSortParam('discount'), 'discount')
  assert.equal(parseSortParam(['name', 'price']), 'name')
  assert.equal(parseSortParam('pret'), 'price')
})

test('brandsForQuery: null fara marci, altfel sortat (aceeasi cheie de cache)', () => {
  assert.equal(brandsForQuery([]), null)
  assert.deepEqual(brandsForQuery(['Samsung', 'Apple']), ['Apple', 'Samsung'])
})

test('buildListingUrl: fara valori implicite, marci repetate, ordine fixa', () => {
  const base = '/c/telefoane-mobile'
  assert.equal(buildListingUrl(base, { sort: 'price', brands: [], tot: false }), base)
  assert.equal(buildListingUrl(base, { sort: 'price', brands: [], tot: false, page: 1 }), base)
  assert.equal(
    buildListingUrl(base, { sort: 'discount', brands: ['Samsung', 'Apple'], tot: true, page: 3 }),
    `${base}?sort=discount&brand=Samsung&brand=Apple&tot=1&page=3`,
  )
  assert.equal(buildListingUrl(base, { sort: 'price', brands: ['Dr. Oetker & Co'], tot: false }), `${base}?brand=Dr.+Oetker+%26+Co`)
})

test('brandTitlePart: una, doua, mai multe', () => {
  assert.equal(brandTitlePart([]), '')
  assert.equal(brandTitlePart(['Samsung']), ' Samsung')
  assert.equal(brandTitlePart(['Samsung', 'Apple']), ' Samsung, Apple')
  assert.equal(brandTitlePart(['Samsung', 'Apple', 'LG']), ' Samsung, Apple…')
})

test('normalizeForSearch / filterBrandOptions: fara diacritice si majuscule', () => {
  assert.equal(normalizeForSearch('  Știința Ță '), 'stiinta ta')
  const opts = [{ brand: 'Știința', count: 3 }, { brand: 'LG', count: 5 }, { brand: 'Algida', count: 1 }]
  assert.deepEqual(filterBrandOptions(opts, 'stiin').map(o => o.brand), ['Știința'])
  assert.deepEqual(filterBrandOptions(opts, 'lg').map(o => o.brand), ['LG', 'Algida'])
  assert.equal(filterBrandOptions(opts, '  ').length, 3)
})

test('orderBrandOptions: bifatele sus, apoi dupa numar desc, egalitate alfabetic', () => {
  const opts = [
    { brand: 'Apple', count: 10 }, { brand: 'Samsung', count: 30 }, { brand: 'Nokia', count: 2 },
    { brand: 'Huawei', count: 10 },
  ]
  assert.deepEqual(orderBrandOptions(opts, []).map(o => o.brand), ['Samsung', 'Apple', 'Huawei', 'Nokia'])
  assert.deepEqual(orderBrandOptions(opts, ['Nokia']).map(o => o.brand), ['Nokia', 'Samsung', 'Apple', 'Huawei'])
  // marca bifata care nu mai are produse ramane in lista (cu 0), ca sa poata fi debifata
  const withGone = orderBrandOptions(opts, ['Disparuta', 'Apple'])
  assert.deepEqual(withGone.slice(0, 2), [{ brand: 'Apple', count: 10 }, { brand: 'Disparuta', count: 0 }])
  assert.equal(withGone.length, 5)
})

test('countForSelection: suma marcilor bifate; fara selectie = totalul listei', () => {
  const opts = [{ brand: 'A', count: 4 }, { brand: 'B', count: 6 }, { brand: 'C', count: 1 }]
  assert.equal(countForSelection(opts, [], 25), 25)
  assert.equal(countForSelection(opts, ['A', 'C'], 25), 5)
  assert.equal(countForSelection(opts, ['Z'], 25), 0)
})
