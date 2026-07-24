import { test } from 'node:test'
import assert from 'node:assert/strict'
import { labelFromPath, parseSitemapIndex, parseCategoryPaths } from './emag-catalog.js'

test('labelFromPath transforma slug-ul in eticheta lizibila', () => {
  assert.equal(labelFromPath('masini-de-spalat-rufe'), 'Masini de spalat rufe')
  assert.equal(labelFromPath('telefoane-mobile'), 'Telefoane mobile')
  assert.equal(labelFromPath('tv'), 'Tv')
})

test('parseSitemapIndex extrage doar sub-sitemap-urile de categorii', () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
    <sitemapindex>
      <sitemap><loc>https://www.emag.ro/sitemaps/categories-0.xml</loc><lastmod>2026-07-16</lastmod></sitemap>
      <sitemap><loc>https://www.emag.ro/sitemaps/brands-0.xml</loc></sitemap>
    </sitemapindex>`
  assert.deepEqual(parseSitemapIndex(xml), ['https://www.emag.ro/sitemaps/categories-0.xml'])
})

test('parseCategoryPaths extrage path-urile /c si ignora restul', () => {
  const xml = `<urlset>
    <url><loc>https://www.emag.ro/telefoane-mobile/c</loc></url>
    <url><loc>https://www.emag.ro/laptopuri/c</loc></url>
    <url><loc>https://www.emag.ro/telefoane-mobile/c</loc></url>
    <url><loc>https://www.emag.ro/vendor/some-shop</loc></url>
    <url><loc>https://www.emag.ro/cautare/laptop</loc></url>
  </urlset>`
  assert.deepEqual(parseCategoryPaths(xml).sort(), ['laptopuri', 'telefoane-mobile'])
})

test('parseCategoryPaths tolereaza spatii in jurul loc-ului', () => {
  const xml = '<url><loc>\n  https://www.emag.ro/televizoare/c\n</loc></url>'
  assert.deepEqual(parseCategoryPaths(xml), ['televizoare'])
})
