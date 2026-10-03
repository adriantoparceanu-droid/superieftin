import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateDraft, checkMarkers, countUnverified, findHealthClaims } from './guide-drafts.js'

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

// ---------- Publicare directa (bloc „publish”, content/ghiduri/publicate/) ----------

// Ghid gata de publicare: fara [DE VERIFICAT], toate faptele confirmate
const publishable = () => ({
  ...base(),
  body_md: '## Ecran\n\nText verificat.\n\n{{oferte:galaxy-tab-s10}}\n',
  publish: { author_slug: 'adrian', reviewer_slug: 'echipa-superieftin' },
})

test('publish: ghid complet → valid, publish pastrat', () => {
  const r = validateDraft(publishable())
  assert.deepEqual(r.errors, [])
  assert.deepEqual(r.draft!.publish, { author_slug: 'adrian', reviewer_slug: 'echipa-superieftin' })
})

test('publish: lipsa blocului → ciorna (publish null), [DE VERIFICAT] permis', () => {
  const r = validateDraft(base())
  assert.deepEqual(r.errors, [])
  assert.equal(r.draft!.publish, null)
})

test('publish: bloc incomplet sau autor = verificator → eroare', () => {
  const a = validateDraft({ ...publishable(), publish: { author_slug: 'adrian' } })
  assert.ok(a.errors.some((e) => e.includes('reviewer_slug')))
  const b = validateDraft({ ...publishable(), publish: { author_slug: 'adrian', reviewer_slug: 'adrian' } })
  assert.ok(b.errors.some((e) => e.includes('diferiți')))
})

test('publish: [DE VERIFICAT] oriunde blocheaza publicarea', () => {
  const r = validateDraft({ ...publishable(), faq: [{ q: 'Are 5G?', a: 'Da [DE VERIFICAT: banda n78]' }] })
  assert.ok(r.errors.some((e) => e.includes('[DE VERIFICAT] în FAQ')))
  const t = validateDraft({ ...publishable(), title: 'Merită X? [DE VERIFICAT: an]' })
  assert.ok(t.errors.some((e) => e.includes('titlu')))
})

test('publish: fapt „de_verificat” in fisa blocheaza publicarea', () => {
  const p = publishable()
  p.review = { ...p.review, facts: [{ claim: 'Baterie 8000 mAh', source_type: 'db', source: 'feed', status: 'de_verificat' }] } as typeof p.review
  const r = validateDraft(p)
  assert.ok(r.errors.some((e) => e.includes('Baterie 8000 mAh')))
})

test('publish: afirmatii de sanatate blocheaza (regula 8)', () => {
  const r = validateDraft({ ...publishable(), summary: 'Pe scurt: purificatorul tratează alergiile.' })
  assert.ok(r.errors.some((e) => e.includes('sănătate') && e.includes('tratează')))
  assert.deepEqual(findHealthClaims('Detoxifiere completă'), ['detoxifiere'])
  assert.deepEqual(findHealthClaims('Nu retratează nimic'), [])
})

test('publish: pret scris de mana → eroare; puteri si diagonale → ok', () => {
  const r = validateDraft({ ...publishable(), body_md: 'Costă 1.299 lei acum.\n\n{{pret:galaxy-tab-s10}}' })
  assert.ok(r.errors.some((e) => e.includes('preț scris de mână') && e.includes('1.299 lei')))
  const f = validateDraft({ ...publishable(), faq: [{ q: 'Cât costă?', a: 'Sub 2000 RON.' }] })
  assert.ok(f.errors.some((e) => e.includes('FAQ')))
  const ok = validateDraft({ ...publishable(), body_md: 'Un încărcător de 65 W, un televizor de 55 inch, la 2,5 m.\n\n{{pret:galaxy-tab-s10}}' })
  assert.deepEqual(ok.errors, [])
})
