import { test } from 'node:test'
import assert from 'node:assert/strict'
import { writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { parseCsvFeed, parseXmlFeed, mapFeedRow, type FeedRow } from './feed.js'

// Fixture-uri cu structura exacta a feed-urilor reale Profitshare (verificata pe
// feed-urile PCMadd/CSV si Vegis/XML descarcate din cont).

const CSV_FIXTURE = '﻿"Advertiser name",Category,Manufacturer,"Product code","Product name","Product description","Product affiliate link","Product link","Product picture","Price without VAT","Price with VAT","Price with discount, with VAT","Price with discount, without VAT",Currency,"Free shipping",Availability,"Gift included"\n'
  + 'PCMadd.com,"all in one",DELL,7490i5,"Aio DELL, OPTIPLEX 7490, 24"" LCD","Descriere, cu virgule",//profitshare.ro/lps/G2p/piC/?redirect=https%3A%2F%2Fwww.pcmadd.com%2Fp1,https://www.pcmadd.com/p1,https://www.pcmadd.com/img1.png,1975.21,2350.50,2100.00,1764.71,lei,0,in_stock,0\n'
  + 'PCMadd.com,accesorii,HP,XYZ99,"Produs fara discount","",//profitshare.ro/lps/G2p/piC/?redirect=https%3A%2F%2Fwww.pcmadd.com%2Fp2,https://www.pcmadd.com/p2,https://www.pcmadd.com/img2.png,173.55,174,,,lei,0,out_of_stock,0\n'

const XML_FIXTURE = `<?xml version="1.0" encoding="utf-8"?>
<products>
  <product>
    <adv_name>Vegis.ro</adv_name>
    <category>batoane proteice</category>
    <manufacturer>BOMBUS</manufacturer>
    <product_code>BB48302</product_code>
    <product_name>Baton Proteic &amp; Crispies 50g</product_name>
    <product_desc/>
    <product_aff_link>//profitshare.ro/lps/djp/piC/?redirect=https%3A%2F%2Fvegis.ro%2Fp1</product_aff_link>
    <link>https://vegis.ro/p1</link>
    <product_pic>https://cdn.vegis.ro/img1.jpg</product_pic>
    <price_no_vat>10.31</price_no_vat>
    <price_vat>11.45</price_vat>
    <price_discounted/>
    <price_discounted_no_tva/>
    <currency>lei</currency>
    <free_shipping>0</free_shipping>
    <availability>in_stock</availability>
    <gift_included>0</gift_included>
  </product>
</products>`

function tmpFixture(name: string, content: string): string {
  const p = join(tmpdir(), name)
  writeFileSync(p, content)
  return p
}

test('parseCsvFeed — citeste antetele cu BOM, ghilimele si virgule in valori', async () => {
  const file = tmpFixture('ps-test-feed.csv', CSV_FIXTURE)
  try {
    const rows: FeedRow[] = []
    for await (const row of parseCsvFeed(file)) rows.push(row)

    assert.equal(rows.length, 2)
    assert.equal(rows[0].advertiserName, 'PCMadd.com')
    assert.equal(rows[0].manufacturer, 'DELL')
    assert.equal(rows[0].productCode, '7490i5')
    assert.equal(rows[0].productName, 'Aio DELL, OPTIPLEX 7490, 24" LCD')
    assert.equal(rows[0].priceVat, '2350.50')
    assert.equal(rows[0].priceDiscountedVat, '2100.00')
    assert.equal(rows[0].availability, 'in_stock')
    assert.equal(rows[1].priceDiscountedVat, '')
    assert.equal(rows[1].availability, 'out_of_stock')
  } finally {
    rmSync(file, { force: true })
  }
})

test('parseXmlFeed — extrage blocurile <product> si decodeaza entitatile', async () => {
  const file = tmpFixture('ps-test-feed.xml', XML_FIXTURE)
  try {
    const rows: FeedRow[] = []
    for await (const row of parseXmlFeed(file)) rows.push(row)

    assert.equal(rows.length, 1)
    assert.equal(rows[0].advertiserName, 'Vegis.ro')
    assert.equal(rows[0].productName, 'Baton Proteic & Crispies 50g')
    assert.equal(rows[0].productCode, 'BB48302')
    assert.equal(rows[0].priceVat, '11.45')
    assert.equal(rows[0].priceDiscountedVat, '')
    assert.equal(rows[0].availability, 'in_stock')
  } finally {
    rmSync(file, { force: true })
  }
})

test('mapFeedRow — pret redus prioritar, link afiliat normalizat, mapare categorie', () => {
  const categoryMap = new Map([['all in one', 'desktop-all-in-one']])
  const row: FeedRow = {
    advertiserName: 'PCMadd.com',
    category: 'All in One',
    manufacturer: 'DELL',
    productCode: '7490i5',
    productName: 'Aio DELL OPTIPLEX 7490',
    affLink: '//profitshare.ro/lps/G2p/piC/?redirect=x',
    link: 'https://www.pcmadd.com/p1',
    picture: 'https://www.pcmadd.com/img1.png',
    priceVat: '2350.50',
    priceDiscountedVat: '2100.00',
    availability: 'in_stock',
  }
  const product = mapFeedRow(row, categoryMap)!
  assert.equal(product.price, 2100)
  assert.equal(product.affiliateUrl, 'https://profitshare.ro/lps/G2p/piC/?redirect=x')
  assert.equal(product.category, 'desktop-all-in-one')
  assert.equal(product.partNo, '7490i5')
  assert.equal(product.brand, 'DELL')
  assert.equal(product.inStock, true)
  assert.equal(product.slug, 'aio-dell-optiplex-7490')
})

test('mapFeedRow — categorie nemapata primeste slug auto, rand invalid e respins', () => {
  const base: FeedRow = {
    advertiserName: 'X', category: 'Sucuri, Siropuri', manufacturer: '', productCode: '',
    productName: 'Produs Y', affLink: '', link: 'https://x.ro/y', picture: '',
    priceVat: '0', priceDiscountedVat: '', availability: 'out_of_stock',
  }
  const product = mapFeedRow(base, new Map())!
  assert.equal(product.category, 'sucuri-siropuri')
  assert.equal(product.price, null)        // pret 0 = invalid
  assert.equal(product.partNo, null)
  assert.equal(product.inStock, false)
  assert.equal(product.affiliateUrl, 'https://x.ro/y')  // fallback pe link direct

  assert.equal(mapFeedRow({ ...base, productName: '' }, new Map()), null)
  assert.equal(mapFeedRow({ ...base, link: '' }, new Map()), null)
})
