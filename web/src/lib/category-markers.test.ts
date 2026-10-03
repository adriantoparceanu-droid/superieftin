// Teste pentru textele pe categorii (lib/category-markers.ts). Rulare: cd web && npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  renderCategoryMarkdown, needsDe, formatCount, formatLei, joinRo, renderCategoryMarkers, categoryFaqLd, markdownToPlain,
  validateCategoryContent, validateCategoryText, parseFaq, markerValue, type CategoryStats,
} from './category-markers'
import { renderMarkdown } from './guides/markdown'

const STATS: CategoryStats = {
  produse: 1221,
  magazine: 2,
  magazineNume: ['eMAG', 'evomag.ro'],
  reduceri: 105,
  cuMediana: 1,
  pretMedian: 7358.4,
  pretP10: 2499.99,
  pretP90: 15210,
  branduri: ['Lenovo', 'Dell', 'Apple', 'ASUS', 'HP'],
  istoricDeLa: '2026-06-13T08:00:00.000Z',
  actualizat: '2026-10-04T11:05:00.000Z',
}

test('regula lui „de” in romana', () => {
  for (const n of [20, 21, 99, 100, 120, 1000, 1221, 7358]) assert.equal(needsDe(n), true, String(n))
  for (const n of [0, 1, 2, 19, 101, 105, 119, 1013, 2913, 2.5]) assert.equal(needsDe(n), false, String(n))
})

test('formatCount: numar + substantiv acordat', () => {
  assert.equal(formatCount(1221), '1.221')
  assert.equal(formatCount(1, 'laptop', 'laptopuri'), '1 laptop')
  assert.equal(formatCount(12, 'laptop', 'laptopuri'), '12 laptopuri')
  assert.equal(formatCount(1221, 'laptop', 'laptopuri'), '1.221 de laptopuri')
  assert.equal(formatCount(105, 'laptop are', 'laptopuri au'), '105 laptopuri au')
  assert.equal(formatCount(0, 'produs', 'produse'), '0 produse')
})

test('formatLei: rotunjire si „de lei”', () => {
  assert.equal(formatLei(7358.4), '7.358 de lei')
  assert.equal(formatLei(2913), '2.913 lei')
  assert.equal(formatLei(140), '140 de lei')
  assert.equal(formatLei(57), '57 de lei')
  assert.equal(formatLei(8), '8 lei')
  assert.equal(formatLei(2.49), '2,49 lei')
  assert.equal(formatLei(15210), '15.210 lei')
  assert.equal(formatLei(2499.99), '2.500 de lei')
})

test('joinRo', () => {
  assert.equal(joinRo([]), '')
  assert.equal(joinRo(['eMAG']), 'eMAG')
  assert.equal(joinRo(['eMAG', 'evomag.ro']), 'eMAG și evomag.ro')
  assert.equal(joinRo(['a', 'b', 'c']), 'a, b și c')
})

test('renderCategoryMarkers: toate cheile', () => {
  const text = [
    '{{cat:produse|laptop|laptopuri}} la {{cat:lista-magazine}} ({{cat:magazine}} magazine).',
    'Median {{cat:pret-median}}, între {{cat:pret-p10}} și {{cat:pret-p90}}.',
    'Mărci: {{cat:branduri-top}}. Reduceri: {{cat:reduceri}}, cu mediană: {{ cat:cu-mediana | produs are | produse au }}.',
    'Din {{cat:istoric-de-la}}, prag {{cat:prag}}, actualizat {{cat:actualizat}}.',
  ].join(' ')
  assert.equal(
    renderCategoryMarkers(text, STATS, 'plain'),
    '1.221 de laptopuri la eMAG și evomag.ro (2 magazine). Median 7.358 de lei, între 2.500 de lei și 15.210 lei. ' +
      'Mărci: Lenovo, Dell, Apple, ASUS și HP. Reduceri: 105, cu mediană: 1 produs are. ' +
      'Din iunie 2026, prag 5%, actualizat 4 octombrie 2026, ora 14:05.',
  )
})

test('renderCategoryMarkers: cheie necunoscuta dispare, textul fara marcaje ramane neatins', () => {
  assert.equal(renderCategoryMarkers('A {{cat:nu-exista}} B', STATS), 'A  B')
  assert.equal(renderCategoryMarkers('Fără marcaje, {{oferte:123}} rămâne.', STATS), 'Fără marcaje, {{oferte:123}} rămâne.')
})

test('valori lipsa: fara marci / fara pret / fara istoric', () => {
  const empty: CategoryStats = { ...STATS, branduri: [], pretMedian: null, istoricDeLa: null, magazineNume: ['rowenta.ro/'] }
  assert.equal(markerValue('branduri-top', empty), 'diverse mărci')
  assert.equal(markerValue('pret-median', empty), '—')
  assert.equal(markerValue('istoric-de-la', empty), '—')
  // numele magazinului din DB fara slash-ul final
  assert.equal(markerValue('lista-magazine', empty), 'rowenta.ro')
})

test('mod md: valorile sunt protejate pentru Markdown', () => {
  const s: CategoryStats = { ...STATS, branduri: ['*Brand_X*'] }
  const html = renderMarkdown(renderCategoryMarkers('Mărci: {{cat:branduri-top}}', s))
  assert.ok(html.includes('*Brand_X*'), html)
  assert.ok(!html.includes('<em>'), html)
})

test('renderCategoryMarkdown: magazinele nu devin linkuri directe, HTML-ul nu se executa', () => {
  const html = renderCategoryMarkdown('La {{cat:lista-magazine}}. <script>x</script> [Lista](/reduceri-reale/laptopuri)', STATS)
  assert.ok(html.includes('eMAG și evomag.ro'), html)
  assert.ok(!html.includes('href="http://evomag.ro'), html)
  assert.ok(!html.includes('<script>'), html)
  assert.ok(html.includes('<a href="/reduceri-reale/laptopuri">Lista</a>'), html)
})

test('markdownToPlain: linkuri → text, fara a strica cratimele', () => {
  assert.equal(
    markdownToPlain('Vezi [Reduceri reale](/reduceri-reale/laptopuri) și **USB-C** de *60 W*.'),
    'Vezi Reduceri reale și USB-C de 60 W.',
  )
  assert.equal(markdownToPlain('Wi-Fi, desktop-uri, 1–1,5'), 'Wi-Fi, desktop-uri, 1–1,5')
})

test('categoryFaqLd: FAQPage valid, cu cifrele randate si fara Markdown', () => {
  const ld = categoryFaqLd([
    { q: 'Cât costă un laptop?', a: 'Median {{cat:pret-median}}. Vezi [lista](/reduceri-reale/laptopuri).' },
    { q: 'Gol', a: '   ' },
  ], STATS)
  assert.ok(ld)
  const parsed = JSON.parse(JSON.stringify(ld))
  assert.equal(parsed['@context'], 'https://schema.org')
  assert.equal(parsed['@type'], 'FAQPage')
  assert.equal(parsed.mainEntity.length, 1) // intrebarea fara raspuns e sarita
  assert.deepEqual(parsed.mainEntity[0], {
    '@type': 'Question',
    name: 'Cât costă un laptop?',
    acceptedAnswer: { '@type': 'Answer', text: 'Median 7.358 de lei. Vezi lista.' },
  })
  assert.equal(categoryFaqLd([], STATS), null)
})

test('validare: marcaje gresite, preturi scrise de mana, promisiuni, sanatate', () => {
  const msgs = (t: string) => validateCategoryText('text', t).map((i) => i.message).join(' | ')
  assert.equal(validateCategoryText('text', 'Avem {{cat:produse|laptop|laptopuri}}, {{cat:prag}}, 16 GB RAM, 60 W, 30 de zile.').length, 0)
  assert.match(msgs('{{cat:pret-minim}}'), /marcaj necunoscut/)
  assert.match(msgs('{{cat:pret-median|leu|lei}}'), /forma cu substantiv/)
  assert.match(msgs('{{cat:produse}'), /acolade/)
  assert.match(msgs('de la 199 lei'), /scris de mână/)
  assert.match(msgs('de la 1.299,99 de lei'), /scris de mână/)
  assert.match(msgs('reducere de 20%'), /scris de mână/)
  assert.match(msgs('Prețuri garantate'), /promisiune/)
  assert.match(msgs('Economisești mult'), /promisiune/)
  assert.match(msgs('Acest produs vindecă'), /sănătate/)
})

test('validare FAQ + parseFaq', () => {
  assert.equal(validateCategoryContent('Text', [{ q: 'Î?', a: 'R.' }]).length, 0)
  assert.ok(validateCategoryContent('Text', [{ q: 'Î?', a: '' }]).length > 0)
  assert.ok(validateCategoryContent('', Array.from({ length: 7 }, () => ({ q: 'q', a: 'a' }))).some((i) => /maxim/.test(i.message)))
  assert.deepEqual(parseFaq([{ q: ' a ', a: ' b ' }, { q: '', a: 'x' }, 'gunoi', null]), [{ q: 'a', a: 'b' }])
  assert.deepEqual(parseFaq('nu e lista'), [])
})

// ---------- Textele din migratia 030: trec validarea si respecta regulile ----------

const SQL = readFileSync(resolve(process.cwd(), '../db/migrations/030_category_content.sql'), 'utf8')

function migrationTexts(): { slug: string; intro: string; faq: { q: string; a: string }[] }[] {
  const blocks = SQL.split(/^-- \/c\//m).slice(1)
  return blocks.map((b) => {
    const slug = b.slice(0, b.indexOf('\n')).trim()
    const intro = /\$md\$([\s\S]*?)\$md\$/.exec(b)![1]
    const qs = [...b.matchAll(/\$q\$([\s\S]*?)\$q\$/g)].map((m) => m[1])
    const as = [...b.matchAll(/\$a\$([\s\S]*?)\$a\$/g)].map((m) => m[1])
    assert.equal(qs.length, as.length, slug)
    return { slug, intro, faq: qs.map((q, i) => ({ q, a: as[i] })) }
  })
}

test('migratia 030: 17 categorii, fara Sanatate & Naturale', () => {
  const texts = migrationTexts()
  assert.equal(texts.length, 17)
  const slugs = texts.map((t) => t.slug)
  assert.equal(new Set(slugs).size, slugs.length)
  for (const s of ['sanatate-naturale', 'suplimente-alimentare', 'ceaiuri-infuzii', 'alimente-bio', 'cosmetice-ingrijire']) {
    assert.ok(!slugs.includes(s), s)
  }
})

test('migratia 030: fiecare text trece validarea (marcaje, fara cifre de mana, fara promisiuni)', () => {
  for (const t of migrationTexts()) {
    const issues = validateCategoryContent(t.intro, t.faq)
    assert.deepEqual(issues, [], `${t.slug}: ${JSON.stringify(issues)}`)
    // subcategoriile au 3–5 intrebari; parintii-hub (fara FAQ) sau animale (hub cu FAQ)
    assert.ok(t.faq.length === 0 || (t.faq.length >= 3 && t.faq.length <= 5), t.slug)
    // nu ramane nimic nerandat
    const rendered = renderCategoryMarkers(t.intro + t.faq.map((f) => f.q + f.a).join(''), STATS)
    assert.ok(!rendered.includes('{{'), t.slug)
  }
})

test('migratia 030: intro-uri diferite intre categorii (fara text duplicat)', () => {
  const texts = migrationTexts()
  const firstSentences = texts.map((t) => t.intro.split('.')[0])
  assert.equal(new Set(firstSentences).size, texts.length)
  for (const t of texts) assert.ok(t.intro.length > 300, `${t.slug}: intro prea scurt`)
})

test('migratia 030: idempotenta (ADD COLUMN IF NOT EXISTS + UPDATE doar fara text)', () => {
  assert.equal((SQL.match(/ADD COLUMN IF NOT EXISTS/g) ?? []).length, 3)
  const updates = SQL.match(/^WHERE slug = '[^']+' AND intro_md IS NULL AND faq = '\[\]'::jsonb;$/gm) ?? []
  assert.equal(updates.length, 17)
  assert.ok(!/\bDROP\b|\bDELETE\b|\bTRUNCATE\b/i.test(SQL))
})
