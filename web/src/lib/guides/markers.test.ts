// Teste pentru marcajele din ghiduri (lib/guides/markers.ts). Rulare: cd web && npm test
// Paritatea cu validarea importului (worker/src/lib/guide-drafts.ts) e verificata in
// worker/src/lib/guide-drafts.test.ts.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  splitGuideBody, collectRefs, removedMarkerErrors, noteMarkerErrors, guideMarkerErrors, productNotes,
  MARKER_TYPES, REMOVED_MARKER_TYPES,
} from './markers'

test('MARKER_TYPES: marcajele publice (+ pro/contra); reducere si istoric-pret sunt scoase', () => {
  assert.deepEqual([...MARKER_TYPES], ['oferte', 'pret', 'comparatie', 'pro', 'contra'])
  assert.deepEqual([...REMOVED_MARKER_TYPES], ['istoric-pret', 'reducere'])
})

test('splitGuideBody: oferte/pret/comparatie devin blocuri, in ordinea din text', () => {
  const segs = splitGuideBody('Intro\n\n{{oferte:telefon-x}}\n\n{{pret:12}}\n\n{{comparatie:a,b}}\n')
  const blocks = segs.flatMap((s) => (s.kind === 'block' ? [[s.type, s.refs]] : []))
  assert.deepEqual(blocks, [['oferte', ['telefon-x']], ['pret', ['12']], ['comparatie', ['a', 'b']]])
  assert.deepEqual(collectRefs(segs).sort(), ['12', 'a', 'b', 'telefon-x'])
})

test('splitGuideBody: marcajele scoase sunt recunoscute (nu raman text), fara referinte', () => {
  const segs = splitGuideBody('A\n{{reducere:x}}\nB\n{{ istoric-pret : y }}\n')
  assert.deepEqual(segs.flatMap((s) => (s.kind === 'removed' ? [s.type] : [])), ['reducere', 'istoric-pret'])
  // Textul Markdown nu mai contine marcajele (nu apar ca „{{…}}” pe pagina)
  assert.ok(segs.every((s) => s.kind !== 'md' || !s.text.includes('{{')))
  // Nu cer produse din DB
  assert.deepEqual(collectRefs(segs), [])
})

test('removedMarkerErrors: respinge reducere si istoric-pret, accepta restul', () => {
  assert.deepEqual(removedMarkerErrors('{{oferte:a}}\n{{pret:b}}\n{{comparatie:a,b}}'), [])
  const errs = removedMarkerErrors('{{reducere:a}}\ntext\n{{istoric-pret:b}}')
  assert.equal(errs.length, 2)
  assert.match(errs[0], /reducere:a/)
  assert.match(errs[1], /istoric-pret:b/)
})

// ---------- Puncte tari / slabe ----------

const CARD = '{{oferte:telefon-x}}\n{{pro: Ecran luminos, bun afară}}\n\n{{contra: Încărcare lentă}}\n{{pro: Autonomie de două zile}}\n\nText după.\n'

test('splitGuideBody: pro/contra se ataseaza cardului de deasupra, nu devin segmente sau text', () => {
  const segs = splitGuideBody(CARD)
  const block = segs.find((s) => s.kind === 'block')
  assert.ok(block && block.kind === 'block')
  assert.deepEqual(block.pros, ['Ecran luminos, bun afară', 'Autonomie de două zile'])
  assert.deepEqual(block.cons, ['Încărcare lentă'])
  assert.ok(segs.every((s) => s.kind !== 'md' || !s.text.includes('{{')))
  assert.deepEqual(collectRefs(segs), ['telefon-x'])
})

test('splitGuideBody: pro fara produs deasupra → orphan-note (nerandat)', () => {
  for (const body of ['{{pro: Ecran bun}}', '{{oferte:a}}\nText.\n{{pro: Ecran bun}}', '{{comparatie:a,b}}\n{{contra: Scump}}']) {
    const segs = splitGuideBody(body)
    assert.equal(segs.filter((s) => s.kind === 'orphan-note').length, 1, body)
  }
})

test('noteMarkerErrors: orfane, lungime 3–120, maximum 5 pe produs, marcaj rupt', () => {
  assert.deepEqual(noteMarkerErrors(CARD), [])
  assert.match(noteMarkerErrors('{{pro: Ecran bun}}')[0], /imediat după/)
  assert.match(noteMarkerErrors('{{oferte:a}}\n{{pro: ab}}')[0], /3–120/)
  assert.match(noteMarkerErrors(`{{oferte:a}}\n{{contra: ${'x'.repeat(121)}}}`)[0], /3–120/)
  const six = Array.from({ length: 6 }, (_, i) => `{{pro: Plus numărul ${i}}}`).join('\n')
  const errs = noteMarkerErrors(`{{pret:a}}\n${six}`)
  assert.equal(errs.length, 1)
  assert.match(errs[0], /maximum 5/)
  assert.ok(noteMarkerErrors('{{oferte:a}}\n{{pro: bun {{pret:a}} }}').some((e) => /rupt/.test(e)))
  // guideMarkerErrors = marcaje scoase + note
  assert.equal(guideMarkerErrors('{{reducere:a}}\n{{pro: Ecran bun}}').length, 2)
})

test('splitGuideBody: randeaza doar notele valide, primele 5', () => {
  const six = Array.from({ length: 6 }, (_, i) => `{{pro: Plus numărul ${i}}}`).join('\n')
  const block = splitGuideBody(`{{oferte:a}}\n{{pro: ab}}\n${six}`).find((s) => s.kind === 'block')
  assert.ok(block && block.kind === 'block')
  assert.equal(block.pros.length, 5)
  assert.equal(block.pros[0], 'Plus numărul 0')
})

test('productNotes: pe produs (ref din marcaj), unite intre carduri, fara dubluri; fara note → lipsa', () => {
  const body = CARD + '\n{{oferte:alt-produs}}\n\nText.\n\n{{pret:telefon-x}}\n{{pro: Ecran luminos, bun afară}}\n{{contra: Fără încărcător}}\n'
  assert.deepEqual(productNotes(body), [
    {
      ref: 'telefon-x',
      pros: ['Ecran luminos, bun afară', 'Autonomie de două zile'],
      cons: ['Încărcare lentă', 'Fără încărcător'],
    },
  ])
  assert.deepEqual(productNotes('{{oferte:a}}\n{{comparatie:a,b}}'), [])
})
