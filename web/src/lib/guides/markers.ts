// Marcajele „blocuri live” din corpul Markdown al unui ghid.
//
// De ce marcaje si nu preturi scrise de mana: pretul, reducerea si ofertele se schimba zilnic.
// Un ghid scris azi cu „-20%” ar minti peste o saptamana (REGULI.md, regula 9). Marcajul
// {{reducere:123}} se inlocuieste la fiecare randare (ISR) cu valoarea curenta din baza de date.
//
// Sintaxa: {{tip:ref}} pe un rand separat, unde ref = id-ul produsului sau slug-ul lui (/p/<slug>).
//   {{oferte:ref}}         — ofertele disponibile, cu butoane spre magazine
//   {{pret:ref}}           — cel mai mic pret de acum + magazinul
//   {{istoric-pret:ref}}   — graficul de pret (90 de zile) + mediana 30 de zile
//   {{reducere:ref}}       — verdictul fata de mediana 30 de zile (reducere reala / pret obisnuit)
//   {{comparatie:r1,r2,…}} — tabel comparativ (2–6 produse)

export const MARKER_TYPES = ['oferte', 'pret', 'istoric-pret', 'reducere', 'comparatie'] as const
export type MarkerType = (typeof MARKER_TYPES)[number]

export type GuideSegment =
  | { kind: 'md'; text: string }
  | { kind: 'block'; type: MarkerType; refs: string[]; raw: string }

// Doar tipurile cunoscute; restul textului ramane Markdown normal (ex. „{{” intr-un exemplu de cod).
const MARKER_RE = /\{\{\s*(oferte|pret|istoric-pret|reducere|comparatie)\s*:\s*([^{}\n]+?)\s*\}\}/g

export const MAX_COMPARE = 6

// Imparte corpul in bucati Markdown si blocuri live, in ordinea din text.
export function splitGuideBody(body: string): GuideSegment[] {
  const segments: GuideSegment[] = []
  let last = 0
  for (const m of body.matchAll(MARKER_RE)) {
    const idx = m.index ?? 0
    if (idx > last) segments.push({ kind: 'md', text: body.slice(last, idx) })
    const type = m[1] as MarkerType
    let refs = m[2].split(',').map((r) => r.trim()).filter(Boolean)
    // Blocurile pe un singur produs folosesc doar primul ref; comparatia are un plafon
    refs = type === 'comparatie' ? refs.slice(0, MAX_COMPARE) : refs.slice(0, 1)
    segments.push({ kind: 'block', type, refs, raw: m[0] })
    last = idx + m[0].length
  }
  if (last < body.length) segments.push({ kind: 'md', text: body.slice(last) })
  return segments
}

// Toate referintele de produs din corp (unice) — pentru o singura interogare in DB.
export function collectRefs(segments: GuideSegment[]): string[] {
  const set = new Set<string>()
  for (const s of segments) if (s.kind === 'block') s.refs.forEach((r) => set.add(r))
  return [...set]
}

// Un ref numeric e id de produs, altfel slug. Slug-urile de produs au mereu litere
// (generate din nume), deci un sir doar din cifre nu poate fi confundat.
export function isIdRef(ref: string): boolean {
  return /^\d{1,18}$/.test(ref)
}
