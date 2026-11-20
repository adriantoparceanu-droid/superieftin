import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateDraft, checkMarkers, countUnverified, findHealthClaims, MARKER_TYPES, REMOVED_MARKER_TYPES } from './guide-drafts.js'

// Marcajele REALE din web (cele randate de GuideBody + respinse la „Salvează” din admin). Import
// dinamic cu cale calculata, ca tsc-ul worker-ului (rootDir = src) sa nu-l includa in build.
const webPath = new URL('../../../web/src/lib/guides/markers.ts', import.meta.url).href
const web = await import(webPath) as {
  MARKER_TYPES: readonly string[]
  REMOVED_MARKER_TYPES: readonly string[]
  removedMarkerErrors: (body: string) => string[]
  noteMarkerErrors: (body: string) => string[]
  guideMarkerErrors: (body: string) => string[]
}

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
  assert.deepEqual(checkMarkers('{{oferte:abc}}\n{{pret:12}}').errors, [])
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

// ---------- Marcaje scoase (reorganizarea in blog, 2026-11-20) ----------

test('checkMarkers: reducere si istoric-pret sunt respinse, cu mesaj dedicat', () => {
  const r = checkMarkers('{{oferte:a}}\n{{reducere:a}}\n{{istoric-pret:b}}')
  assert.equal(r.errors.length, 2)
  assert.ok(r.errors.every((e) => e.includes('nu mai este permis')))
  // Referintele din marcajele respinse nu se cauta in DB
  assert.deepEqual(r.refs, ['a'])
})

test('validateDraft: ciorna cu {{reducere}} nu trece', () => {
  const d = base()
  d.body_md += '\n{{reducere:galaxy-tab-s10}}\n'
  assert.ok(validateDraft(d).errors.some((e) => e.includes('reducere') && e.includes('nu mai este permis')))
})

// ---------- Puncte tari / slabe ({{pro:…}} / {{contra:…}}) ----------

test('checkMarkers: pro/contra imediat sub oferte/pret sunt acceptate, fara sa devina referinte', () => {
  const body = '{{oferte:a}}\n{{pro: Ecran luminos, bun afară}}\n\n{{contra: Încărcare lentă}}\n\nText.\n\n{{pret:12}}\n{{contra: Fără încărcător în cutie}}'
  const r = checkMarkers(body)
  assert.deepEqual(r.errors, [])
  assert.deepEqual(r.refs.sort(), ['12', 'a'])
})

test('checkMarkers: pro/contra fara produs inainte → eroare', () => {
  assert.ok(checkMarkers('{{pro: Ecran bun}}').errors[0].includes('imediat după'))
  // dupa text
  assert.ok(checkMarkers('{{oferte:a}}\nText.\n{{pro: Ecran bun}}').errors[0].includes('imediat după'))
  // dupa comparatie
  assert.ok(checkMarkers('{{comparatie:a,b}}\n{{contra: Scump}}').errors[0].includes('imediat după'))
  // dupa un marcaj scos
  assert.ok(checkMarkers('{{reducere:a}}\n{{pro: Ecran bun}}').errors.some((e) => e.includes('imediat după')))
})

test('checkMarkers: pro/contra — lungime 3–120, maximum 5, fara marcaje imbricate', () => {
  assert.ok(checkMarkers('{{oferte:a}}\n{{pro: ab}}').errors[0].includes('3–120'))
  assert.ok(checkMarkers(`{{oferte:a}}\n{{pro: ${'x'.repeat(121)}}}`).errors[0].includes('3–120'))
  assert.deepEqual(checkMarkers(`{{oferte:a}}\n{{pro: ${'ș'.repeat(120)}}}`).errors, [])
  const six = Array.from({ length: 6 }, (_, i) => `{{contra: Minus numărul ${i}}}`).join('\n')
  const r = checkMarkers(`{{oferte:a}}\n${six}`)
  assert.equal(r.errors.length, 1)
  assert.ok(r.errors[0].includes('maximum 5'))
  // limita e per produs: alt card isi are propriile 5
  const five = six.split('\n').slice(0, 5).join('\n')
  assert.deepEqual(checkMarkers(`{{oferte:a}}\n${five}\n\n{{oferte:b}}\n${five}`).errors, [])
  // imbricat → acolade fara pereche
  assert.ok(checkMarkers('{{oferte:a}}\n{{pro: bun {{pret:a}} }}').errors.length > 0)
})

test('paritate pro/contra cu web: acelasi numar de erori pe aceleasi corpuri', () => {
  const bodies = [
    '{{oferte:a}}\n{{pro: Ecran bun}}\n{{contra: Scump la lansare}}',
    '{{pro: Fara produs}}',
    '{{oferte:a}}\nText.\n{{pro: Ecran bun}}',
    '{{comparatie:a,b}}\n{{contra: Scump}}',
    '{{oferte:a}}\n{{pro: ab}}',
    `{{oferte:a}}\n{{pro: ${'x'.repeat(121)}}}`,
    `{{pret:a}}\n${Array.from({ length: 7 }, (_, i) => `{{pro: Plus numărul ${i}}}`).join('\n')}`,
    '{{oferte:a}}\n{{reducere:a}}\n{{contra: Fără produs}}',
  ]
  for (const b of bodies) {
    assert.equal(checkMarkers(b).errors.length, web.guideMarkerErrors(b).length, b)
  }
})

test('paritate cu web/src/lib/guides/markers.ts: aceleasi marcaje permise si scoase', () => {
  assert.deepEqual([...MARKER_TYPES].sort(), [...web.MARKER_TYPES].sort())
  assert.deepEqual([...REMOVED_MARKER_TYPES].sort(), [...web.REMOVED_MARKER_TYPES].sort())
  // Acelasi corp → aceleasi marcaje respinse in ambele locuri
  const body = '{{oferte:a}}\n{{reducere:a}}\n{{pret:b}}\n{{istoric-pret:b}}\n{{comparatie:a,b}}'
  assert.equal(checkMarkers(body).errors.length, web.removedMarkerErrors(body).length)
})
