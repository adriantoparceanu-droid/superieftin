// Teste pentru ancorele #produs-<slug> (lib/guides/anchors.ts). Rulare: cd web && npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { anchorOwners } from './anchors'
import { splitGuideBody } from './markers'

// id-ul 12 = produsul cu slug-ul „telefon-b”; „lipsa” nu exista
const SLUGS: Record<string, string> = { 'telefon-a': 'telefon-a', 'telefon-b': 'telefon-b', '12': 'telefon-b', 'telefon-c': 'telefon-c' }
const resolve = (r: string) => SLUGS[r]

function owners(body: string) {
  const segs = splitGuideBody(body)
  const map = anchorOwners(segs, resolve)
  // segment → slug-uri, cu tipul blocului (mai usor de citit in assert)
  return [...map.entries()].map(([i, s]) => {
    const seg = segs[i]
    return [seg.kind === 'block' ? seg.type : seg.kind, [...s].sort()]
  })
}

test('ancora pe card chiar daca produsul apare intai intr-o comparatie', () => {
  assert.deepEqual(
    owners('{{comparatie:telefon-a,telefon-b}}\n\nText.\n\n{{oferte:telefon-a}}\n\n{{pret:12}}\n'),
    [['oferte', ['telefon-a']], ['pret', ['telefon-b']]],
  )
})

test('produs doar in comparatie → ancora pe coloana din prima comparatie', () => {
  assert.deepEqual(
    owners('{{oferte:telefon-a}}\n\n{{comparatie:telefon-a,telefon-c}}\n\n{{comparatie:telefon-c,telefon-b}}\n'),
    [['oferte', ['telefon-a']], ['comparatie', ['telefon-c']], ['comparatie', ['telefon-b']]],
  )
})

test('acelasi produs (id si slug) in doua carduri → o singura ancora, pe primul card', () => {
  assert.deepEqual(owners('{{oferte:telefon-b}}\n\n{{oferte:12}}\n'), [['oferte', ['telefon-b']]])
})

test('produs inexistent → fara ancora', () => {
  assert.deepEqual(owners('{{oferte:lipsa}}\n\n{{comparatie:lipsa,telefon-a}}\n'), [['comparatie', ['telefon-a']]])
})
