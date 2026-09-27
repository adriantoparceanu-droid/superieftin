import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateDraft, checkMarkers, countUnverified } from './guide-drafts.js'

// O ciorna minima valida; testele o strica pe rand
const base = () => ({
  slug: 'merita-galaxy-tab-s10',
  title: 'Merită Galaxy Tab S10?',
  meta_description: 'Ce primești, cât costă acum și când merită.',
  kind: 'produs',
  category_slug: null,
  summary: 'Pe scurt: da, dacă prinzi o reducere reală.',
  body_md: '## Ecran\n\nText [DE VERIFICAT: luminozitate].\n\n{{oferte:galaxy-tab-s10}}\n\n{{comparatie:a-b,c-d}}\n',
  faq: [{ q: 'Are 5G?', a: 'Doar varianta 5G.' }],
  product_slugs: ['galaxy-tab-s10'],
  review: {
    facts: [{ claim: 'Ecran 11 inch', source_type: 'web', source: 'https://www.samsung.com/ro/', status: 'confirmat' }],
    checklist: ['Am verificat specificațiile'],
  },
})

test('validateDraft: ciorna valida → normalizata, warnings implicit []', () => {
  const r = validateDraft(base())
  assert.deepEqual(r.errors, [])
  assert.ok(r.draft)
  assert.deepEqual(r.draft!.review.warnings, [])
  assert.deepEqual(r.markerRefs.sort(), ['a-b', 'c-d', 'galaxy-tab-s10'])
})

test('validateDraft: campuri obligatorii lipsa', () => {
  const d: Record<string, unknown> = base()
  delete d.title
  delete d.review
  d.summary = '   '
  const r = validateDraft(d)
  assert.equal(r.draft, null)
  assert.ok(r.errors.some((e) => e.includes('„title”')))
  assert.ok(r.errors.some((e) => e.includes('„summary”')))
  assert.ok(r.errors.some((e) => e.includes('„review”')))
})

test('validateDraft: valori permise (kind, slug, status, source_type, sursa web = URL)', () => {
  const d = base() as Record<string, any>
  d.kind = 'articol'
  d.slug = 'Merită Tab'
  d.review.facts = [{ claim: 'x', source_type: 'web', source: 'site samsung', status: 'poate' }]
  const r = validateDraft(d)
  assert.ok(r.errors.some((e) => e.includes('„kind”')))
  assert.ok(r.errors.some((e) => e.includes('slug invalid')))
  assert.ok(r.errors.some((e) => e.includes('„status”')))
  assert.ok(r.errors.some((e) => e.includes('URL')))
  assert.ok(validateDraft({ ...base(), slug: 'metodologie' }).errors.some((e) => e.includes('rezervat')))
})

test('validateDraft: checklist si facts nevide, faq complet, fara marcaje in rezumat', () => {
  const d = base() as Record<string, any>
  d.review.checklist = []
  d.review.facts = []
  d.faq = [{ q: 'Doar intrebare' }]
  d.summary = 'Vezi {{pret:x}}'
  d.product_slugs = ['a', 'a']
  const r = validateDraft(d)
  assert.ok(r.errors.some((e) => e.includes('checklist')))
  assert.ok(r.errors.some((e) => e.includes('review.facts')))
  assert.ok(r.errors.some((e) => e.includes('faq[0]')))
  assert.ok(r.errors.some((e) => e.startsWith('summary')))
  assert.ok(r.errors.some((e) => e.includes('de două ori')))
})

test('validateDraft: nu e obiect', () => {
  assert.equal(validateDraft([]).draft, null)
  assert.equal(validateDraft('x').draft, null)
})

test('checkMarkers: tipuri necunoscute, numar de produse, acolade rupte', () => {
  assert.deepEqual(checkMarkers('{{oferte:abc}}\n{{istoric-pret:12}}').errors, [])
  assert.ok(checkMarkers('{{oferta:abc}}').errors[0].includes('necunoscut'))
  assert.ok(checkMarkers('{{pret:a,b}}').errors[0].includes('un singur produs'))
  assert.ok(checkMarkers('{{comparatie:a}}').errors[0].includes('2–6'))
  assert.ok(checkMarkers('{{comparatie:a,b,c,d,e,f,g}}').errors[0].includes('2–6'))
  assert.ok(checkMarkers('{{oferte:abc}').errors.some((e) => e.includes('fără un marcaj valid')))
  assert.deepEqual(checkMarkers('{{ oferte : x }} si {{pret:x}}').refs, ['x'])
})

test('countUnverified', () => {
  assert.equal(countUnverified('a [DE VERIFICAT: x] b [DE VERIFICAT] c'), 2)
  assert.equal(countUnverified('curat'), 0)
})
