// Variante aproape identice ale aceluiasi produs → o singura pagina in Google (canonical).
//
// De ce: planul „Observatorul reducerilor reale” (docs/plans/2026-10-21-observator-*, Pista A).
// Feed-urile au adesea acelasi model in 3–6 culori, fiecare cu pagina /p/ proprie, aproape
// identica (acelasi text, acelasi pret). Pentru Google sunt pagini subtiri duplicate — exact ce a
// penalizat August 2026 Spam Update. Le pastram pe toate pentru vizitatori, dar spunem lui Google
// care e pagina principala (rel=canonical) si le scoatem pe celelalte din sitemap.
//
// Grup = aceeasi categorie + aceeasi marca + aceleasi etichete de stare (refurbished/second-hand)
// + aceeasi denumire normalizata (fara diacritice, litere mici), din care scoatem DOAR cuvintele
// de culoare dintr-o lista conservatoare. Cifrele, capacitatile si modelele raman neatinse: doua
// produse care difera prin „128GB” / „256GB” NU sunt variante (pret diferit, pagina proprie).
//
// Pagina principala = cele mai multe oferte disponibile, apoi istoricul cel mai lung (prima
// inregistrare cea mai veche), apoi id-ul cel mai mic (stabil intre rulari).
//
// Calculul ruleaza in worker, dupa refreshOfferPriceStats (sync.worker.ts), si scrie
// products.canonical_product_id (migratia 035). Site-ul doar citeste coloana si pune canonical-ul
// DOAR daca principala e ea insasi indexabila (web/src/lib/seo/product-index.ts,
// CANONICAL_TARGET_INDEXABLE_SQL). Functiile de aici sunt pure (testate fara baza de date);
// scrierea in DB e in product-canonicals.ts.

// Cuvinte de culoare (deja fara diacritice, litere mici). Lista e intentionat scurta: un cuvant
// lipsa = doua pagini separate (situatia de azi); un cuvant in plus = doua produse diferite
// lipite gresit. Nu adauga cuvinte ambigue (ex. „rose”, „natural”, „dark”, „space”).
export const COLOR_WORDS = new Set([
  // romana (cu formele de gen/numar uzuale)
  'negru', 'neagra', 'negri', 'negre',
  'alb', 'alba', 'albi', 'albe',
  'albastru', 'albastra', 'albastri', 'albastre', 'bleumarin', 'turcoaz',
  'rosu', 'rosie', 'rosii',
  'verde', 'verzi',
  'gri', 'cenusiu', 'cenusie',
  'argintiu', 'argintie', 'argintii',
  'auriu', 'aurie', 'aurii',
  'roz', 'mov', 'violet', 'galben', 'galbena', 'portocaliu', 'portocalie', 'maro', 'bej', 'crem', 'grafit',
  // engleza (numele culorilor din feed-uri)
  'black', 'white', 'blue', 'navy', 'silver', 'gold', 'gray', 'grey', 'graphite',
  'red', 'green', 'pink', 'purple', 'yellow', 'orange', 'beige', 'cream',
  'midnight', 'starlight', 'titanium', 'lavender', 'mint',
])

// Dupa aceste cuvinte, „gold”/„silver” etc. sunt NUME DE PROCESOR (Xeon Gold 6248, Pentium
// Silver N5000), nu culori → le pastram in denumire.
const COLOR_KEEP_AFTER = new Set(['xeon', 'pentium'])

// Produse la care culoarea E produsul (un cartus negru nu e varianta unuia galben) → fara grup.
export const NO_VARIANT_WORDS = new Set([
  'cartus', 'cartuse', 'toner', 'tonere', 'cerneala', 'ink', 'drum', 'filament', 'ribbon', 'panglica',
  'tusiera', 'pix', 'pixuri', 'marker', 'markere', 'creion', 'creioane', 'carioca', 'vopsea', 'spray',
])

// Denumirea fara diacritice, litere mici, impartita in cuvinte (orice nu e litera/cifra/./+ desparte).
export function nameTokens(name: string): string[] {
  return name
    .normalize('NFD').replace(/\p{M}/gu, '')       // ș → s, ă → a (si sedila veche ş/ţ)
    .toLowerCase()
    .replace(/[™®©]/g, '')
    .split(/[^\p{L}\p{N}.+]+/u)
    .map((t) => t.replace(/^\.+|\.+$/g, ''))       // „Pro.” = „Pro”
    .filter(Boolean)
}

// Denumirea normalizata fara culori, sau null daca produsul nu intra in grupuri de variante
// (produs de tip „culoarea e produsul” sau denumire prea scurta ca sa fie sigura).
export function variantName(name: string): string | null {
  // Denumire taiata de feed („… 3 An ...”): diferenta reala poate fi in partea lipsa → fara grup
  if (/(\.\.\.|…)\s*$/.test(name)) return null
  const tokens = nameTokens(name)
  if (tokens.some((t) => NO_VARIANT_WORDS.has(t))) return null
  const kept = tokens.filter((t, i) => !COLOR_WORDS.has(t) || (i > 0 && COLOR_KEEP_AFTER.has(tokens[i - 1])))
  const out = kept.join(' ')
  // Minim 2 cuvinte si 12 caractere: „Husa Negru” → „husa” nu e o identitate de produs
  if (kept.length < 2 || out.length < 12) return null
  return out
}

export interface VariantCandidate {
  id: string                           // products.id (bigint ca text)
  name: string
  brand: string | null
  categoryId: number | null
  tags: string[]                       // etichete de stare (refurbished / second-hand)
  availableOffers: number
  firstRecordedAt: string | Date | null
}

// Cheia grupului; null = produsul nu are variante (fara categorie sau marca = nu riscam)
export function variantGroupKey(p: VariantCandidate): string | null {
  if (p.categoryId == null) return null
  const brand = p.brand ? nameTokens(p.brand).join(' ') : ''
  if (!brand) return null
  const name = variantName(p.name)
  if (!name) return null
  return [p.categoryId, brand, [...p.tags].sort().join(','), name].join('|')
}

function timeOrInf(d: string | Date | null): number {
  if (!d) return Number.POSITIVE_INFINITY
  const t = new Date(d).getTime()
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t
}

// Ordinea pentru alegerea principalei: oferte disponibile desc, istoric mai vechi intai, id mic
export function comparePrincipal(a: VariantCandidate, b: VariantCandidate): number {
  if (a.availableOffers !== b.availableOffers) return b.availableOffers - a.availableOffers
  const ta = timeOrInf(a.firstRecordedAt), tb = timeOrInf(b.firstRecordedAt)
  if (ta !== tb) return ta < tb ? -1 : 1
  const ia = BigInt(a.id), ib = BigInt(b.id)
  return ia < ib ? -1 : ia > ib ? 1 : 0
}

// id varianta → id principala, DOAR pentru membrii care nu sunt principala (grupurile de 1 nu apar).
export function assignCanonicals(products: VariantCandidate[]): Map<string, string> {
  const groups = new Map<string, VariantCandidate[]>()
  for (const p of products) {
    const key = variantGroupKey(p)
    if (!key) continue
    const g = groups.get(key)
    if (g) g.push(p)
    else groups.set(key, [p])
  }
  const out = new Map<string, string>()
  for (const g of groups.values()) {
    if (g.length < 2) continue
    const [principal, ...rest] = [...g].sort(comparePrincipal)
    for (const m of rest) out.set(m.id, principal.id)
  }
  return out
}
