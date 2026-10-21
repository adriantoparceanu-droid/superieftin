// Teste pentru gruparea pe variante (lib/product-variants.ts, migratia 035). Rulare: cd worker && npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nameTokens, variantName, variantGroupKey, comparePrincipal, assignCanonicals, type VariantCandidate } from './product-variants.js'

const base: VariantCandidate = {
  id: '10', name: 'Telefon mobil Apple iPhone 15, 128GB, 5G, Negru', brand: 'Apple', categoryId: 3,
  tags: [], availableOffers: 1, firstRecordedAt: '2026-07-01T00:00:00Z',
}
const v = (over: Partial<VariantCandidate>): VariantCandidate => ({ ...base, ...over })

test('variante: normalizare — fara diacritice, litere mici, semne de punctuatie ca separatori', () => {
  assert.deepEqual(nameTokens('Zgardă Roșie, mărimea M (Ţesătură)™'), ['zgarda', 'rosie', 'marimea', 'm', 'tesatura'])
  assert.deepEqual(nameTokens('Laptop 15.6" 1.5TB Pro.'), ['laptop', '15.6', '1.5tb', 'pro'])
})

test('variante: scoate DOAR culorile; cifrele, capacitatile si modelele raman', () => {
  assert.equal(variantName('Telefon mobil Apple iPhone 15, 128GB, 5G, Negru'), 'telefon mobil apple iphone 15 128gb 5g')
  assert.equal(variantName('Telefon mobil Apple iPhone 15, 128GB, 5G, Black'), 'telefon mobil apple iphone 15 128gb 5g')
  assert.equal(variantName('Laptop ASUS TUF A16 16GB 512GB SSD Negru/Gri'), 'laptop asus tuf a16 16gb 512gb ssd')
  assert.equal(variantName('Calculator Dell OptiPlex 3090, Monitor 22 inch, Black&Silver'), 'calculator dell optiplex 3090 monitor 22 inch')
  // capacitate diferita → denumiri diferite (nu sunt variante)
  assert.notEqual(variantName('Apple iPhone 15 128GB Negru'), variantName('Apple iPhone 15 256GB Negru'))
  // „Blackwell” / „Redmi” nu sunt culori (cuvant intreg)
  assert.equal(variantName('Placa video RTX PRO 2000 Blackwell 8GB'), 'placa video rtx pro 2000 blackwell 8gb')
  assert.equal(variantName('Telefon Xiaomi Redmi Note 13 Green'), 'telefon xiaomi redmi note 13')
})

test('variante: Xeon Gold / Pentium Silver sunt procesoare, nu culori', () => {
  assert.equal(variantName('Server HP DL380 Intel Xeon Gold 6248 64GB'), 'server hp dl380 intel xeon gold 6248 64gb')
  assert.equal(variantName('Laptop Intel Pentium Silver N5000 4GB'), 'laptop intel pentium silver n5000 4gb')
})

test('variante: produsele la care culoarea E produsul nu se grupeaza', () => {
  assert.equal(variantName('Cartus HP 305 Black'), null)
  assert.equal(variantName('Toner Brother TN-2421 Negru'), null)
  assert.equal(variantName('Pix Pilot G2 0.7 Albastru'), null)
})

test('variante: denumire prea scurta dupa scoaterea culorii → fara grup', () => {
  assert.equal(variantName('Husa Negru'), null)
  assert.equal(variantName('Negru Alb'), null)
})

test('variante: denumire taiata de feed („...”) → fara grup (diferenta poate fi in partea lipsa)', () => {
  assert.equal(variantName('Laptop Dell Latitude 5510, Fara Hard Disk, Windows 10 Pro, 3 An ...'), null)
  assert.equal(variantName('Laptop Dell Latitude 5510, Fara Hard Disk, Windows 10 Pro…'), null)
})

test('variante: cheia cere categorie + marca; eticheta de stare face parte din cheie', () => {
  assert.equal(variantGroupKey(v({ categoryId: null })), null)
  assert.equal(variantGroupKey(v({ brand: null })), null)
  assert.equal(variantGroupKey(v({ brand: '  ' })), null)
  assert.equal(variantGroupKey(v({})), variantGroupKey(v({ name: 'Telefon mobil Apple iPhone 15, 128GB, 5G, Albastru' })))
  // marca fara diferenta de majuscule
  assert.equal(variantGroupKey(v({ brand: 'APPLE' })), variantGroupKey(v({})))
  assert.notEqual(variantGroupKey(v({ tags: ['refurbished'] })), variantGroupKey(v({})))
  assert.notEqual(variantGroupKey(v({ categoryId: 4 })), variantGroupKey(v({})))
  assert.notEqual(variantGroupKey(v({ brand: 'Samsung' })), variantGroupKey(v({})))
})

test('variante: principala = cele mai multe oferte, apoi istoric mai vechi, apoi id mic', () => {
  const a = v({ id: '30', availableOffers: 3, firstRecordedAt: '2026-09-01T00:00:00Z' })
  const b = v({ id: '20', availableOffers: 1, firstRecordedAt: '2026-06-01T00:00:00Z' })
  assert.ok(comparePrincipal(a, b) < 0)
  const c = v({ id: '40', availableOffers: 1, firstRecordedAt: '2026-05-01T00:00:00Z' })
  assert.ok(comparePrincipal(c, b) < 0)
  const d = v({ id: '9', availableOffers: 1, firstRecordedAt: '2026-06-01T00:00:00Z' })
  assert.ok(comparePrincipal(d, b) < 0)                 // id 9 < 20 (comparat numeric, nu ca text)
  const e = v({ id: '5', availableOffers: 1, firstRecordedAt: null })
  assert.ok(comparePrincipal(b, e) < 0)                 // fara istoric = ultimul
})

test('variante: assignCanonicals — doar membrii non-principali, grupurile de 1 lipsesc', () => {
  const list = [
    v({ id: '1', name: 'Apple iPhone 15 128GB Negru', availableOffers: 1 }),
    v({ id: '2', name: 'Apple iPhone 15 128GB Alb', availableOffers: 3 }),
    v({ id: '3', name: 'Apple iPhone 15 128GB Midnight', availableOffers: 0 }),
    v({ id: '4', name: 'Apple iPhone 15 256GB Negru', availableOffers: 2 }),   // alta capacitate → singur
    v({ id: '5', name: 'Cartus HP 305 Black', brand: 'HP' }),
    v({ id: '6', name: 'Cartus HP 305 Yellow', brand: 'HP' }),
  ]
  const m = assignCanonicals(list)
  assert.deepEqual([...m.entries()].sort(), [['1', '2'], ['3', '2']])
})
