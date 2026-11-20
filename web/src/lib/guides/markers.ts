// Marcajele „blocuri live” din corpul Markdown al unui ghid.
//
// De ce marcaje si nu preturi scrise de mana: pretul si magazinul cel mai ieftin se schimba
// zilnic. Un articol scris azi cu „1.299 lei” ar minti peste o saptamana (REGULI.md, regula 9).
// Marcajul se inlocuieste la fiecare randare (ISR) cu valoarea curenta din baza de date.
//
// Sintaxa: {{tip:ref}} pe un rand separat, unde ref = id-ul produsului sau slug-ul lui.
//   {{oferte:ref}}         — cardul produsului: cel mai bun pret la magazinele partenere + un buton
//   {{pret:ref}}           — acelasi card (pastrat ca sinonim, ca textele vechi sa mearga)
//   {{comparatie:r1,r2,…}} — tabel fata in fata (2–6 produse) + cate un card compact pe produs
//   {{pro: text}}          — punct tare al produsului din marcajul {{oferte}}/{{pret}} de DEASUPRA
//   {{contra: text}}       — punct slab, la fel
//
// Punctele tari/slabe (cerinta proprietarului, 2026-11-20): randuri imediat dupa {{oferte:ID}} sau
// {{pret:ID}} (intre ele doar spatii / randuri goale), 0–5 din fiecare, text de 3–120 caractere,
// fara acolade. Apar in card („Bun:” / „Mai slab:”) si vor alimenta schema Review editoriala
// (positiveNotes / negativeNotes) — de aceea sunt expuse si de productNotes(), functie pura.
// Un {{pro}} / {{contra}} fara produs inainte (sau dupa text / dupa o comparatie) = eroare.
//
// Scoase din setul public (reorganizarea in blog, 2026-11-20 — istoricul de pret e DOAR intern):
//   {{istoric-pret:ref}}, {{reducere:ref}} — nu se mai randeaza, iar salvarea / importul le respinge.
//
// Listele si regulile sunt DUBLATE in worker/src/lib/guide-drafts.ts (validarea importului) —
// modifica-le impreuna; testul de paritate din worker/src/lib/guide-drafts.test.ts pica daca difera.

export const PRODUCT_MARKER_TYPES = ['oferte', 'pret', 'comparatie'] as const
export const NOTE_MARKER_TYPES = ['pro', 'contra'] as const
export const MARKER_TYPES = [...PRODUCT_MARKER_TYPES, ...NOTE_MARKER_TYPES] as const
export type MarkerType = (typeof PRODUCT_MARKER_TYPES)[number]
export type NoteMarkerType = (typeof NOTE_MARKER_TYPES)[number]

export const REMOVED_MARKER_TYPES = ['istoric-pret', 'reducere'] as const
export type RemovedMarkerType = (typeof REMOVED_MARKER_TYPES)[number]

export const MAX_COMPARE = 6
export const MAX_NOTES = 5          // per produs, din fiecare fel (pro / contra)
export const NOTE_MIN_CHARS = 3
export const NOTE_MAX_CHARS = 120

export type GuideSegment =
  | { kind: 'md'; text: string }
  // pros/cons: punctele tari/slabe atasate (doar la oferte/pret; la comparatie raman goale).
  // Contin DOAR notele valide (lungime ok, primele MAX_NOTES) — ce se randeaza.
  | { kind: 'block'; type: MarkerType; refs: string[]; raw: string; pros: string[]; cons: string[] }
  // Marcaj scos: recunoscut (ca sa nu apara ca text „{{reducere:…}}” in articolele vechi), dar
  // nerandat public; previzualizarea din admin il semnaleaza.
  | { kind: 'removed'; type: RemovedMarkerType; raw: string }
  // {{pro}}/{{contra}} fara produs inainte: nerandat public, semnalat in previzualizare + la salvare
  | { kind: 'orphan-note'; type: NoteMarkerType; raw: string }

// Doar tipurile cunoscute (+ cele scoase); restul textului ramane Markdown normal (ex. „{{” intr-un
// exemplu de cod).
const MARKER_RE = /\{\{\s*(oferte|pret|istoric-pret|reducere|comparatie|pro|contra)\s*:\s*([^{}\n]+?)\s*\}\}/g

function isRemoved(type: string): type is RemovedMarkerType {
  return (REMOVED_MARKER_TYPES as readonly string[]).includes(type)
}
function isNote(type: string): type is NoteMarkerType {
  return (NOTE_MARKER_TYPES as readonly string[]).includes(type)
}

export function noteTextOk(text: string): boolean {
  const n = [...text.trim()].length
  return n >= NOTE_MIN_CHARS && n <= NOTE_MAX_CHARS
}

// Imparte corpul in bucati Markdown si blocuri live, in ordinea din text. Notele pro/contra nu
// devin segmente proprii: se ataseaza blocului oferte/pret de deasupra.
export function splitGuideBody(body: string): GuideSegment[] {
  const segments: GuideSegment[] = []
  let last = 0
  // Blocul caruia i se pot atasa note: ultimul oferte/pret, cat timp intre el si nota sunt doar spatii
  let attach: Extract<GuideSegment, { kind: 'block' }> | null = null
  for (const m of body.matchAll(MARKER_RE)) {
    const idx = m.index ?? 0
    const between = body.slice(last, idx)
    if (between.trim()) attach = null
    // Spatiile dintre un card si notele lui nu devin segment Markdown (n-ar afisa nimic oricum)
    if (idx > last && !(attach && isNote(m[1]))) segments.push({ kind: 'md', text: between })
    last = idx + m[0].length

    if (isRemoved(m[1])) {
      segments.push({ kind: 'removed', type: m[1], raw: m[0] })
      attach = null
      continue
    }
    if (isNote(m[1])) {
      if (!attach) {
        segments.push({ kind: 'orphan-note', type: m[1], raw: m[0] })
        continue
      }
      const list = m[1] === 'pro' ? attach.pros : attach.cons
      const text = m[2].trim()
      if (noteTextOk(text) && list.length < MAX_NOTES) list.push(text)
      continue
    }
    const type = m[1] as MarkerType
    let refs = m[2].split(',').map((r) => r.trim()).filter(Boolean)
    // Blocurile pe un singur produs folosesc doar primul ref; comparatia are un plafon
    refs = type === 'comparatie' ? refs.slice(0, MAX_COMPARE) : refs.slice(0, 1)
    const seg: Extract<GuideSegment, { kind: 'block' }> = { kind: 'block', type, refs, raw: m[0], pros: [], cons: [] }
    segments.push(seg)
    attach = type === 'comparatie' ? null : seg
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

export interface ProductNotes {
  ref: string        // exact cum e scris in marcaj: id de produs SAU slug (rezolvat de loadLiveProducts)
  pros: string[]     // punctele tari, in ordinea din text, fara dubluri
  cons: string[]     // punctele slabe, la fel
}

// Punctele tari/slabe pe produs, pentru JSON-LD (Review editorial: positiveNotes / negativeNotes).
// Pura: doar din corpul Markdown. Aceleasi note care apar pe pagina (cele valide, max MAX_NOTES din
// fiecare per card). Un produs cu note in mai multe carduri → notele unite, fara dubluri.
// Produsele fara nicio nota lipsesc. Ordinea = prima aparitie in text.
export function productNotes(body: string): ProductNotes[] {
  const byRef = new Map<string, ProductNotes>()
  for (const s of splitGuideBody(body)) {
    if (s.kind !== 'block' || (!s.pros.length && !s.cons.length)) continue
    const ref = s.refs[0]
    if (!ref) continue
    const cur = byRef.get(ref) ?? { ref, pros: [], cons: [] }
    for (const p of s.pros) if (!cur.pros.includes(p)) cur.pros.push(p)
    for (const c of s.cons) if (!cur.cons.includes(c)) cur.cons.push(c)
    byRef.set(ref, cur)
  }
  return [...byRef.values()]
}

// Erorile de salvare pentru marcajele scoase (folosite de removedMarkerErrors / guideMarkerErrors).
// Aceeasi regula ca checkMarkers din worker: un articol cu {{reducere:…}} sau {{istoric-pret:…}} nu
// se mai salveaza.
export function removedMarkerErrors(body: string): string[] {
  const errors: string[] = []
  for (const s of splitGuideBody(body)) {
    if (s.kind === 'removed') {
      errors.push(`marcajul „${s.raw}” nu mai este permis (istoricul de preț e doar intern) — folosește {{oferte:…}}`)
    }
  }
  return errors
}

// Erorile pentru {{pro}} / {{contra}}: fara produs inainte, text prea scurt/lung, peste MAX_NOTES
// per card, sau rupte (acolade in text = marcaj imbricat → regex-ul nu le recunoaste deloc).
export function noteMarkerErrors(body: string): string[] {
  const errors: string[] = []
  let attach = false
  let counts = { pro: 0, contra: 0 }
  let last = 0
  for (const m of body.matchAll(MARKER_RE)) {
    const idx = m.index ?? 0
    if (body.slice(last, idx).trim()) attach = false
    last = idx + m[0].length
    if (isNote(m[1])) {
      if (!attach) {
        errors.push(`„${m[0]}”: punctele tari/slabe se pun imediat după {{oferte:…}} sau {{pret:…}}`)
        continue
      }
      if (!noteTextOk(m[2])) errors.push(`„${m[0]}”: textul trebuie să aibă ${NOTE_MIN_CHARS}–${NOTE_MAX_CHARS} caractere`)
      counts[m[1]]++
      if (counts[m[1]] === MAX_NOTES + 1) errors.push(`„${m[0]}”: maximum ${MAX_NOTES} marcaje ${m[1]} pe produs`)
      continue
    }
    attach = m[1] === 'oferte' || m[1] === 'pret'
    counts = { pro: 0, contra: 0 }
  }
  // Un {{pro:…}} cu acolade in text nu e recunoscut de MARKER_RE → ar ramane ca text pe pagina
  const rest = body.replace(MARKER_RE, '')
  if (/\{\{\s*(pro|contra)\s*:/i.test(rest)) errors.push('marcaj {{pro:…}} / {{contra:…}} rupt (acolade sau marcaje în text?)')
  return errors
}

// Toate erorile de marcaje verificate la „Salvează” din admin (oglinda checkMarkers din worker
// pentru marcajele scoase si pentru pro/contra).
export function guideMarkerErrors(body: string): string[] {
  return [...removedMarkerErrors(body), ...noteMarkerErrors(body)]
}
