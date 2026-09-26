import { test } from 'node:test'
import assert from 'node:assert/strict'
import { extractBrand } from './emag.js'

test('extractBrand: cuvant intreg, fara diferenta de majuscule, primul din denumire', () => {
  // Bug-ul initial: „Vivo” gasit ca subsir in „Vivobook”, iar „ASUS” nu se potrivea cu „Asus”
  assert.equal(extractBrand('Laptop ASUS Vivobook Go 15 E1504FA cu procesor AMD Ryzen 3'), 'Asus')
  assert.equal(extractBrand('Telefon mobil vivo Y36, 8GB RAM'), 'Vivo')
  assert.equal(extractBrand('Laptop HP 250 G10, Intel Core i5'), 'HP')
  assert.equal(extractBrand('Televizor Samsung 55" compatibil Apple AirPlay'), 'Samsung')
  assert.equal(extractBrand('Laptop Apple MacBook Air 15"'), 'Apple')
  assert.equal(extractBrand('Televizor Kruger&Matz 43"'), 'Kruger&Matz')
  assert.equal(extractBrand('Cablu de date USB-C, 1m'), null)
  // „Honor” nu trebuie prins din „Honorar”, „LG” nu din „LGA1700”
  assert.equal(extractBrand('Placa de baza socket LGA1700'), null)
})
