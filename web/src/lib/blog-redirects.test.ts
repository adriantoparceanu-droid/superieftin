// Harta adreselor scoase la trecerea in blog (lib/blog-redirects.ts). Rulare: cd web && npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ARTICLE_EQUIVALENTS, REMOVED_PREFIXES, RETIRED_CATEGORY_SLUGS, articlePath, buildProductGuides,
  goneHtml, isRemovedPath, needsArticleData, normalizePath, productDecision, resolveBlogRedirect,
  type RedirectData,
} from './blog-redirects'
import { RENAMED_CATEGORIES } from './legacy-map'

const data: RedirectData = {
  productGuides: new Map([
    ['samsung-galaxy-a36', 'telefoane-bune-sub-1500-lei'],
    ['produs-in-ciorna', 'ghid-retras'],      // harta veche: articolul nu mai e publicat
  ]),
  publishedGuides: new Set([
    'telefoane-bune-sub-1500-lei',
    'black-friday-2026-ce-reduceri-sunt-reale',
    'reduceri-reale-black-friday-cum-verifici',
  ]),
}

test('/p/<slug> din articol publicat → 308 spre ancora cardului', () => {
  assert.deepEqual(resolveBlogRedirect('/p/samsung-galaxy-a36', data), {
    status: 308, location: '/ghiduri/telefoane-bune-sub-1500-lei#produs-samsung-galaxy-a36',
  })
  // „/” final si sub-cai → acelasi produs
  assert.deepEqual(resolveBlogRedirect('/p/samsung-galaxy-a36/', data), resolveBlogRedirect('/p/samsung-galaxy-a36', data))
})

test('/p/<slug> fara articol sau cu articol nepublicat → 410', () => {
  assert.deepEqual(resolveBlogRedirect('/p/alt-produs', data), { status: 410 })
  assert.deepEqual(resolveBlogRedirect('/p/produs-in-ciorna', data), { status: 410 })
  assert.deepEqual(resolveBlogRedirect('/p', data), { status: 410 })
  assert.deepEqual(resolveBlogRedirect('/p/', data), { status: 410 })
})

test('orice 308 duce DOAR spre un articol publicat', () => {
  const paths = ['/p/samsung-galaxy-a36', '/p/produs-in-ciorna', '/p/x', ...Object.keys(ARTICLE_EQUIVALENTS),
    '/reduceri-reale/laptopuri', '/indice/2026-10', '/cand-sa-cumperi/televizoare', '/t/refurbished']
  for (const p of paths) {
    const d = resolveBlogRedirect(p, data)
    if (d?.status !== 308) continue
    const slug = d.location.replace(/^\/ghiduri\//, '').split('#')[0]
    assert.ok(d.location.startsWith('/ghiduri/'), p)
    assert.ok(data.publishedGuides.has(slug), `${p} → ${d.location}`)
  }
})

test('observatorul: pereche explicita → 308, restul → 410', () => {
  assert.deepEqual(resolveBlogRedirect('/black-friday-2026', data), { status: 308, location: '/ghiduri/black-friday-2026-ce-reduceri-sunt-reale' })
  assert.deepEqual(resolveBlogRedirect('/reduceri-reale', data), { status: 308, location: '/ghiduri/reduceri-reale-black-friday-cum-verifici' })
  for (const p of ['/reduceri-reale/laptopuri', '/indice', '/indice/2026-10', '/cand-sa-cumperi',
    '/cand-sa-cumperi/televizoare', '/black-friday-2026/x', '/t/refurbished', '/t/second-hand', '/feeds/products.xml']) {
    assert.deepEqual(resolveBlogRedirect(p, data), { status: 410 }, p)
  }
})

test('pereche spre un articol inca nepublicat → 410 (niciun 308 spre 404)', () => {
  const noGuides: RedirectData = { productGuides: new Map(), publishedGuides: new Set() }
  assert.deepEqual(resolveBlogRedirect('/black-friday-2026', noGuides), { status: 410 })
})

test('adresele care raman nu sunt atinse', () => {
  for (const p of ['/', '/ghiduri', '/ghiduri/x', '/c/laptopuri', '/termeni', '/indicele', '/tablete', '/go/12', '/produs/x', '/feeds/altceva.xml']) {
    assert.equal(resolveBlogRedirect(p, data), null, p)
    assert.equal(isRemovedPath(p), false, p)
  }
})

test('vechile categorii devenite tag-uri → 410 direct (nu /t/)', () => {
  for (const s of RETIRED_CATEGORY_SLUGS) assert.deepEqual(resolveBlogRedirect(`/c/${s}`, data), { status: 410 })
})

test('legacy: categoriile redenumite duc spre /c/, niciodata spre adrese scoase (fara lanturi)', () => {
  for (const [from, to] of Object.entries(RENAMED_CATEGORIES)) {
    assert.equal(isRemovedPath(`/c/${to}`), false, `${from} → ${to}`)
    assert.ok(!(RETIRED_CATEGORY_SLUGS as readonly string[]).includes(to))
  }
})

test('legacy produs: aceeasi decizie ca /p/ (tinta finala direct)', () => {
  assert.deepEqual(productDecision('samsung-galaxy-a36', data), resolveBlogRedirect('/p/samsung-galaxy-a36', data))
  assert.deepEqual(productDecision('', data), { status: 410 })
})

test('needsArticleData: DB doar pentru /p/ si paginile cu pereche', () => {
  assert.equal(needsArticleData('/p/x'), true)
  assert.equal(needsArticleData('/black-friday-2026'), true)
  assert.equal(needsArticleData('/indice/2026-10'), false)
  assert.equal(needsArticleData('/t/refurbished'), false)
  assert.equal(needsArticleData('/toString'), false)
})

test('buildProductGuides: cel mai recent actualizat castiga, apoi id-ul mai mare', () => {
  const m = buildProductGuides([
    { product_slug: 'a', guide_slug: 'vechi', updated_at: '2026-10-01T10:00:00Z', guide_id: 1 },
    { product_slug: 'a', guide_slug: 'nou', updated_at: '2026-11-01T10:00:00Z', guide_id: 2 },
    { product_slug: 'a', guide_slug: 'mai-vechi', updated_at: '2026-09-01T10:00:00Z', guide_id: 3 },
    { product_slug: 'b', guide_slug: 'x', updated_at: '2026-11-01T10:00:00Z', guide_id: 4 },
    { product_slug: 'b', guide_slug: 'y', updated_at: '2026-11-01T10:00:00Z', guide_id: 5 },
  ])
  assert.equal(m.get('a'), 'nou')
  assert.equal(m.get('b'), 'y')
})

test('normalizePath / articlePath / prefixe', () => {
  assert.equal(normalizePath('/p/abc%20d/'), '/p/abc d')
  assert.equal(normalizePath('/p/%E0%A4%A'), '/p/%E0%A4%A')   // %-secventa gresita → bruta, fara exceptie
  assert.equal(articlePath('ghid', 'prod'), '/ghiduri/ghid#produs-prod')
  assert.ok(REMOVED_PREFIXES.every((p) => isRemovedPath(p)))
})

test('pagina 410: romana, noindex, linkuri spre homepage si articole', () => {
  const html = goneHtml()
  assert.match(html, /<html lang="ro">/)
  assert.match(html, /name="robots" content="noindex"/)
  assert.match(html, /href="\/"/)
  assert.match(html, /href="\/ghiduri"/)
})
