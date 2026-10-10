// Teste pentru importul textelor de categorie (lib/category-texts.ts). Rulare: cd worker && npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  validateCategoryText, validateCategoryContent, validateCategoryFile, planAction, isExcludedCategory,
  CAT_MARKER_KEYS, MAX_FAQ, type CategoryFaqItem, type ContentIssue,
} from './category-texts.js'

// Validarea REALA din web (cea de la „Salvează” din admin). Import dinamic cu cale calculata, ca
// tsc-ul worker-ului (rootDir = src) sa nu-l includa in build; tsx il incarca la rulare.
const webPath = new URL('../../../web/src/lib/category-markers.ts', import.meta.url).href
const web = await import(webPath) as {
  validateCategoryText: (field: string, text: string) => ContentIssue[]
  validateCategoryContent: (intro: string, faq: CategoryFaqItem[]) => ContentIssue[]
  CAT_MARKER_KEYS: readonly string[]
  MAX_FAQ: number
}

// Textele din migratia 030 (corpus real) — aceeasi extragere ca in web/src/lib/category-markers.test.ts
const SQL = readFileSync(new URL('../../../db/migrations/030_category_content.sql', import.meta.url), 'utf8')
const MIGRATION = SQL.split(/^-- \/c\//m).slice(1).map((b) => ({
  intro: /\$md\$([\s\S]*?)\$md\$/.exec(b)![1],
  faq: [...b.matchAll(/\$q\$([\s\S]*?)\$q\$/g)].map((m, i) => ({ q: m[1], a: [...b.matchAll(/\$a\$([\s\S]*?)\$a\$/g)][i][1] })),
}))

const TEXT_CASES = [
  '',
  'Avem {{cat:produse|laptop|laptopuri}}, {{cat:prag}}, 16 GB RAM, 60 W, 30 de zile.',
  '{{cat:pret-minim}}', '{{ cat : produse }}', '{{cat:pret-median|leu|lei}}', '{{cat:produse| |x}}',
  '{{cat:produse}', '}} rămase', 'de la 199 lei', 'de la 1.299,99 de lei', '2499 RON', 'reducere de 20%',
  'Prețuri garantate', 'Economisești mult', 'Cele mai mici prețuri', 'cel mai ieftin din oraș',
  'Acest produs vindecă', 'detoxifiere rapidă', 'elimină toxinele', 'nu tratează nimic',
  'Mediana {{cat:pret-median}}, între {{cat:pret-p10}} și {{cat:pret-p90}}; {{cat:branduri-top}}; {{cat:lista-magazine}}.',
  '{{cat:reduceri|reducere|reduceri}} din {{cat:cu-mediana|produs|produse}}, din {{cat:istoric-de-la}}, {{cat:actualizat}}',
  '{{oferte:slug}} marcaj de ghid', '[Reduceri reale](/reduceri-reale/laptopuri) · **bold** _it_',
  ...MIGRATION.flatMap((m) => [m.intro, ...m.faq.flatMap((f) => [f.q, f.a])]),
]

test('validarea e identica cu cea din web (category-markers.ts) — modifica-le impreuna', () => {
  assert.deepEqual([...CAT_MARKER_KEYS], [...web.CAT_MARKER_KEYS])
  assert.equal(MAX_FAQ, web.MAX_FAQ)
  for (const t of TEXT_CASES) assert.deepEqual(validateCategoryText('text', t), web.validateCategoryText('text', t), t)
  const faqCases: [string, CategoryFaqItem[]][] = [
    ['Text', []],
    ['Text', [{ q: 'Î?', a: 'R.' }]],
    ['Text', [{ q: 'Î?', a: '' }]],
    ['', Array.from({ length: 7 }, () => ({ q: 'q', a: 'a' }))],
    ['De la 99 lei', [{ q: 'Cât costă?', a: 'Garantat 10%' }, { q: '{{cat:x}}', a: 'vindecă' }]],
    ...MIGRATION.map((m) => [m.intro, m.faq] as [string, CategoryFaqItem[]]),
  ]
  for (const [intro, faq] of faqCases) assert.deepEqual(validateCategoryContent(intro, faq), web.validateCategoryContent(intro, faq), intro)
})

const OK = {
  slug: 'monitoare',
  intro_md: '  Pe această pagină găsești {{cat:produse|monitor|monitoare}} la {{cat:lista-magazine}}.  ',
  faq: [{ q: ' Ce diagonală aleg? ', a: 'Depinde de distanță.' }, { q: '', a: '' }],
  review: {
    facts: [
      { claim: 'Panourile IPS au unghiuri bune', source_type: 'web', source: 'https://example.com/ips', status: 'confirmat' },
      { claim: 'Avem monitoare de la mai multe magazine', source_type: 'db', source: 'tabela offers', status: 'confirmat' },
    ],
    warnings: ['Feed-ul nu precizează rata de refresh'],
  },
}
const errs = (raw: unknown) => validateCategoryFile(raw).errors.join(' | ')

test('fisier valid: normalizat ca la salvarea din admin (trim, randuri goale scoase)', () => {
  const { file, errors } = validateCategoryFile(OK)
  assert.deepEqual(errors, [])
  assert.equal(file!.intro_md, 'Pe această pagină găsești {{cat:produse|monitor|monitoare}} la {{cat:lista-magazine}}.')
  assert.deepEqual(file!.faq, [{ q: 'Ce diagonală aleg?', a: 'Depinde de distanță.' }])
  assert.equal(file!.review.warnings.length, 1)
  // faq si warnings sunt optionale; facts poate fi lista goala
  assert.deepEqual(validateCategoryFile({ slug: 'x', intro_md: 'Text.', review: { facts: [] } }).errors, [])
})

test('fisier: structura gresita', () => {
  assert.match(errs(null), /obiect JSON/)
  assert.match(errs([OK]), /obiect JSON/)
  assert.match(errs({ ...OK, intro: 'x' }), /câmp necunoscut „intro”/)
  assert.match(errs({ ...OK, slug: 'Monitoare PC' }), /slug/)
  assert.match(errs({ ...OK, slug: undefined }), /slug: lipsește/)
  assert.match(errs({ ...OK, intro_md: '   ' }), /intro_md: e gol/)
  assert.match(errs({ ...OK, intro_md: 5 }), /intro_md: lipsește/)
  assert.match(errs({ ...OK, faq: 'x' }), /faq: trebuie/)
  assert.match(errs({ ...OK, faq: [{ q: 1, a: 'x' }] }), /faq\[0\]/)
  assert.match(errs({ ...OK, review: undefined }), /review: lipsește/)
  assert.match(errs({ ...OK, review: { facts: 'x' } }), /review.facts/)
  assert.match(errs({ ...OK, review: { facts: [], checklist: [] } }), /câmp necunoscut „checklist”/)
  assert.match(errs({ ...OK, review: { facts: [], warnings: [1] } }), /review.warnings/)
})

test('fisier: validarea de continut din admin se aplica', () => {
  assert.match(errs({ ...OK, intro_md: 'Monitoare de la 499 lei.' }), /text: preț sau procent scris de mână/)
  assert.match(errs({ ...OK, intro_md: '{{cat:pret-minim}}' }), /marcaj necunoscut/)
  assert.match(errs({ ...OK, faq: [{ q: 'Merită?', a: 'Economisești sigur.' }] }), /răspunsul 1: formulare interzisă/)
  assert.match(errs({ ...OK, faq: [{ q: 'Ajută?', a: 'Tratează insomnia.' }] }), /sănătate/)
  assert.match(errs({ ...OK, faq: [{ q: 'Doar întrebare?', a: '' }] }), /întrebarea 1: întrebarea și răspunsul sunt obligatorii/)
  assert.match(errs({ ...OK, faq: Array.from({ length: MAX_FAQ + 1 }, (_, i) => ({ q: `Î${i}?`, a: 'R.' })) }), /maxim 6/)
  assert.match(errs({ ...OK, intro_md: 'Text [DE VERIFICAT: cifra] aici.' }), /DE VERIFICAT/)
})

test('fisier: fisa de verificare — doar fapte „confirmat”, web = URL', () => {
  const fact = (f: object) => ({ ...OK, review: { facts: [{ ...OK.review.facts[0], ...f }] } })
  assert.match(errs(fact({ status: 'de_verificat' })), /status „de_verificat”/)
  assert.match(errs(fact({ status: undefined })), /se importă doar fapte „confirmat”/)
  assert.match(errs(fact({ source: 'site-ul producătorului' })), /URL http\/https/)
  assert.match(errs(fact({ source: 'ftp://x.ro/a' })), /URL http\/https/)
  assert.match(errs(fact({ source_type: 'carte' })), /source_type/)
  assert.match(errs(fact({ claim: ' ' })), /claim: lipsește/)
  assert.equal(errs(fact({ source_type: 'db', source: 'feed evomag' })), '')
})

test('excluderi regula 8: Sanatate & Naturale (cu subcategorii) si farmacie-veterinara', () => {
  assert.equal(isExcludedCategory('sanatate-naturale', []), true)
  assert.equal(isExcludedCategory('suplimente-alimentare', ['sanatate-naturale']), true)
  assert.equal(isExcludedCategory('farmacie-veterinara', ['animale-de-companie']), true)
  assert.equal(isExcludedCategory('monitoare', ['laptopuri-calculatoare']), false)
  assert.equal(isExcludedCategory('castroane', ['animale-de-companie']), false)
})

test('planAction: CREEAZĂ / ACTUALIZEAZĂ / NESCHIMBAT', () => {
  const file = validateCategoryFile(OK).file!
  assert.equal(planAction({ intro_md: null, faq: [] }, file), 'create')
  assert.equal(planAction({ intro_md: '  ', faq: [] }, file), 'create')
  assert.equal(planAction({ intro_md: null, faq: [{ q: 'a', a: 'b' }] }, file), 'update')
  assert.equal(planAction({ intro_md: 'Alt text', faq: file.faq }, file), 'update')
  // jsonb poate intoarce cheile in alta ordine — tot neschimbat
  assert.equal(planAction({ intro_md: file.intro_md, faq: file.faq.map((f) => ({ a: f.a, q: f.q })) }, file), 'unchanged')
  assert.equal(planAction({ intro_md: file.intro_md, faq: [] }, file), 'update')
})
