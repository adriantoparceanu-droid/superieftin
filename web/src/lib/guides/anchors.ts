import type { GuideSegment } from './markers'

// Unde pune GuideBody ancora #produs-<slug> (tinta redirecturilor /p/<slug> → articol si a
// ItemList-ului din JSON-LD). Pur, testat in anchors.test.ts.
//
// Regula: ancora merge pe CARDUL produsului ({{oferte}} / {{pret}}), prima aparitie; abia daca
// produsul apare DOAR in {{comparatie}}, ancora merge pe coloana lui din prima comparatie.
// Fiecare slug primeste o singura ancora (id unic in pagina).
//
// `resolve` = ref din marcaj (id sau slug) → slug-ul produsului (undefined = produs inexistent).
// Intoarce: indicele segmentului → slug-urile care primesc ancora in acel bloc.
export function anchorOwners(
  segments: GuideSegment[],
  resolve: (ref: string) => string | undefined,
): Map<number, Set<string>> {
  const owners = new Map<number, Set<string>>()
  const taken = new Set<string>()
  const give = (i: number, slug: string) => {
    if (taken.has(slug)) return
    taken.add(slug)
    if (!owners.has(i)) owners.set(i, new Set())
    owners.get(i)!.add(slug)
  }
  // Pasul 1: cardurile (un card = primul ref al marcajului, ca in GuideBody)
  segments.forEach((seg, i) => {
    if (seg.kind !== 'block' || seg.type === 'comparatie') return
    const slug = resolve(seg.refs[0] ?? '')
    if (slug) give(i, slug)
  })
  // Pasul 2: produsele ramase fara card → prima comparatie in care apar
  segments.forEach((seg, i) => {
    if (seg.kind !== 'block' || seg.type !== 'comparatie') return
    for (const ref of seg.refs) {
      const slug = resolve(ref)
      if (slug) give(i, slug)
    }
  })
  return owners
}
