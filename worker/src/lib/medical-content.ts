// Reguli de sănătate pentru blog (ghiduri + texte de categorie) — liste pure, fără bază de date.
//
// Decizia proprietarului (20.11.2026): pe BLOG se poate scrie și în arborii `sanatate-naturale`
// (Vegis) și `farmacie-veterinara`, DAR DOAR despre produse NE-MEDICALE (cosmetice naturale,
// ceaiuri/alimente ca atare, accesorii pentru animale fără medicamente). Suplimentele,
// medicamentele (umane sau veterinare), antiparazitarele și afirmațiile de sănătate rămân
// interzise. Reclamele Google rămân EXCLUSE pe acești arbori (REGULI.md regula 8 — asta NU se
// schimbă aici; vezi EXCLUDED_AD_ROOTS / guardrails.yaml).
//
// ATENȚIE — COPIE: fișierul există IDENTIC (octet cu octet) în worker/src/lib/medical-content.ts și
// web/src/lib/medical-content.ts (worker-ul nu poate importa din web la build). MODIFICĂ-LE
// ÎMPREUNĂ — testul worker/src/lib/medical-content.test.ts pică dacă diferă.
//
// Potrivirea: textul e trecut în litere mici, fără diacritice (ș/ş → s, ț/ţ → t, ă/â → a, î → i),
// spațiile multiple devin unul. Un termen se potrivește la ÎNCEPUT de cuvânt (prefix: „capsul”
// prinde „capsule”, „capsula”); termenii cu „=” în față trebuie să fie cuvânt întreg („=fier” nu
// prinde „fierbător”). Astfel listele se scriu o singură dată, fără variante cu/fără diacritice.

// Arborii „de sănătate”: categoria și tot ce e sub ea.
export const HEALTH_TREE_ROOTS = ['sanatate-naturale', 'farmacie-veterinara'] as const

export function isHealthTree(slug: string, ancestorSlugs: readonly string[] = []): boolean {
  const roots = HEALTH_TREE_ROOTS as readonly string[]
  return roots.includes(slug) || ancestorSlugs.some((s) => roots.includes(s))
}

export function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[şș]/g, 's').replace(/[ţț]/g, 't')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
}

// Grupul 2 = ce s-a potrivit, extins pana la capatul cuvantului („tratea” → „trateaza”), ca
// mesajul de eroare sa arate cuvantul din text, nu radacina din lista.
function termRegex(term: string): RegExp {
  const whole = term.startsWith('=')
  const t = (whole ? term.slice(1) : term).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(whole ? `(^|[^a-z0-9])(${t})($|[^a-z0-9])` : `(^|[^a-z0-9])(${t}[a-z0-9]*)`)
}

interface TermHit { term: string; word: string }

function matchTerms(list: readonly string[], low: string): TermHit[] {
  return list.flatMap((term) => {
    const m = termRegex(term).exec(low)
    return m ? [{ term: term.replace(/^=/, ''), word: m[2] }] : []
  })
}

const words = (hits: TermHit[]) => [...new Set(hits.map((h) => h.word))]

// ---------------------------------------------------------------------------------------------
// 1. Termeni medicali în DENUMIREA produsului — folosiți DOAR pentru produsele din arborii de
//    sănătate (un „Tablet Samsung” din IT nu e afectat). Un produs care îi conține e refuzat într-un
//    ghid și ascuns implicit în uneltele de cercetare.
// ---------------------------------------------------------------------------------------------
export const MEDICAL_PRODUCT_TERMS = [
  // forme de suplimente / medicamente
  'supliment', 'capsul', 'comprimat', 'tablet', 'pastil', 'drajeu', '=plic', '=plicuri', 'fiol',
  'sirop', 'tinctur', 'extract standardizat', 'picatur', 'unguent', 'supozitor', 'ovul',
  'spray nazal', 'spray bucal', 'solutie orala', 'pulbere orala', 'gume masticabile',
  'efervescent', 'doza zilnica',
  // medicamente / acțiune farmacologică
  'medicament', 'medicinal', 'farmaceutic', 'homeopat', 'antiinflamat', 'anti-inflamat',
  'analgezic', 'antibiotic', 'antiseptic', 'antifung', 'antimicot', 'antiviral', 'antibacterian',
  'antihistamin', 'antialergic', 'decongestion', 'expectorant', 'antitusiv', 'laxativ', 'diuretic',
  'sedativ', 'terapeutic', 'terapie', 'dispozitiv medical', 'oftalmic', '=otic',
  // veterinar: antiparazitare & co.
  'antiparazit', 'anti-parazit', 'deparazit', 'antipurici', 'anti-purici', 'purici', 'capus',
  'vierm', 'helmint', 'insecticid', 'spot-on', 'spot on', 'pipet', 'vaccin', 'giardi',
  // nutrienți tipici de supliment
  'vitamin', 'multivitamin', '=minerale', 'probiotic', 'prebiotic', 'colagen', 'omega 3',
  'omega-3', '=omega3', 'ginseng', 'magneziu', '=zinc', '=calciu', '=fier', 'seleniu', 'potasiu',
  'melatonin', 'glucozamin', 'condroitin', 'coenzima', '=q10', 'spirulin', 'chlorell', 'clorel',
  'echinace', 'propolis', 'laptisor de matca', 'acid hialuronic oral', 'biotin', 'lecitin',
  'enzime digestive', 'carbune activ', 'ashwagandha', '=maca', 'curcumin', 'resveratrol',
  // afecțiuni în denumire („ceai pentru tuse”)
  'tuse', 'raceal', '=gripa', 'durer', 'insomni', 'constipat', 'diaree', 'hemoroiz', 'reumat',
  'artrit', 'artroz', 'colesterol', 'glicemi', 'diabet', 'tensiune arteriala', 'hipertens',
  'cancer', 'anemi', 'prostat', 'menopauz', 'hepat', 'urinar', 'imunit', 'detox', 'slabire',
  '=slabit', 'arde grasimi', 'otit', 'dermatit', 'infecti',
] as const

// Excepții: termenul NU contează dacă denumirea conține unul dintre cuvintele date (tot fără
// diacritice, prefix la început de cuvânt). Ex.: „Ceai de mentă, 20 plicuri” = aliment ca atare.
// „picături” nu are excepții (decizia proprietarului). „tratament” lipsește intenționat din
// denumiri: „tratament pentru păr” e cosmetic; antiparazitarele sunt prinse de termenii proprii.
export const MEDICAL_TERM_EXCEPTIONS: Readonly<Record<string, readonly string[]>> = {
  tablet: ['ciocolat'],
  plic: ['ceai', 'infuzi'],
  plicuri: ['ceai', 'infuzi'],
  sirop: ['artar', 'agave', 'cicoare', 'curmal'],
}

// Cuvintele medicale găsite în denumire (fără diacritice, ex. „capsule”). [] = nimic medical.
export function findMedicalTerms(name: string): string[] {
  const low = normalizeForMatch(name)
  return words(matchTerms(MEDICAL_PRODUCT_TERMS, low).filter((h) => {
    const unless = MEDICAL_TERM_EXCEPTIONS[h.term]
    return !unless || !unless.some((u) => termRegex(u).test(low))
  }))
}

// Produsul pare medical / supliment: termeni medicali SAU afirmații de sănătate în denumire.
export function medicalReasons(name: string): string[] {
  return [...new Set([...findMedicalTerms(name), ...findHealthClaims(name)])]
}

export const MEDICAL_PRODUCT_MESSAGE = 'produs medical/supliment — nu se recomandă pe blog'

export interface GuideProductRef {
  ref: string           // slug-ul / id-ul din ghid
  name: string
  healthTree: boolean   // categoria lui e în HEALTH_TREE_ROOTS (sau sub ele)
}

// Erorile pentru produsele unui ghid: refuzat = din arborii de sănătate ȘI cu denumire medicală.
export function medicalProductErrors(products: readonly GuideProductRef[]): string[] {
  return products.flatMap((p) => {
    if (!p.healthTree) return []
    const why = medicalReasons(p.name)
    return why.length ? [`„${p.name}” (${p.ref}): ${MEDICAL_PRODUCT_MESSAGE} (${why.join(', ')})`] : []
  })
}

// ---------------------------------------------------------------------------------------------
// 2. Afirmații de sănătate în TEXT (ghiduri, texte de categorie) — pentru TOATE categoriile.
//    Expresii, nu cuvinte generale: „tratament antireflex”, „previne zgârieturile”, „semnal
//    slăbit” sau „întărește carcasa” trebuie să treacă (testate pe texte normale de blog).
// ---------------------------------------------------------------------------------------------
export const HEALTH_CLAIMS = [
  // vindecare / tratament
  'vindec', 'tratea', 'tratament natural', 'tratament medical', 'ca tratament', 'in tratamentul',
  'tratamentul afectiuni', 'tratamentul boli', 'terapi', 'terapeutic', 'remediu', 'remedii',
  '=leac', '=leacuri', 'cura de', 'cure de', '=o cura',
  // detox
  'detox', 'elimina toxin', 'eliminarea toxin', 'curata organismul', 'purifica organismul',
  // imunitate
  'imunit', 'intareste organismul', 'intareste oasele', 'intareste sanatatea',
  'intareste sistemul nervos',
  // acțiune farmacologică
  'antiinflamat', 'anti-inflamat', 'antibacterian', 'anti-bacterian', 'antiviral', 'anti-viral',
  'antifung', 'antimicot', 'antiseptic', 'analgezic', 'antioxidant',
  // slăbit
  'pentru slabit', 'de slabit', 'la slabit', 'cura de slabire', 'slabire rapida', 'ajuta la slabire',
  'pierdere in greutate', 'pierderea in greutate', 'arde grasimi', 'arderea grasimilor',
  'ardere a grasimilor', 'topeste grasim',
  // valori / organe
  'colesterol', 'glicemi', 'tensiunea arteriala', 'tensiune arteriala', 'tensiunii arteriale',
  'hipertensiun',
  'protejeaza ficatul', 'protectia ficatului', 'sanatatea ficatului', 'hepatoprotect',
  // boli / simptome
  'previne boli', 'previne aparitia boli', 'previne raceal', 'previne infecti', 'previne cancer',
  'combate boli', 'combate infecti', 'combate raceal', 'previne imbatranirea', 'cancer', 'diabet',
  '=boala', '=boli', '=bolile', '=bolilor', 'afectiuni', 'simptomele boli', 'simptomele raceli',
  'simptome de raceal', 'reduce simptom', 'amelioreaza simptom', 'amelioreaza durer',
  'amelioreaza starea', 'calmeaza simptom', 'calmeaza durer', 'calmeaza tus', 'calmeaza inflamat',
  'calmeaza sistemul nervos', 'reduce durer', 'elimina durer', 'impotriva durer', 'scapi de durer',
  'scapa de durer', 'dureri articulare', 'durerile articulare', 'infectii urinare', 'digesti',
  // regenerare / îmbătrânire
  'regenereaza pielea', 'regenerarea pielii', 'regenereaza celul', 'regenerare celulara',
  'regenerarea celul', 'regenereaza tesut', 'anti-imbatranire', 'antiimbatranire',
  'anti imbatranire', 'anti-aging', 'antiaging', 'anti aging', 'intinere',
] as const

// Afirmațiile de sănătate găsite, ca în text dar fără diacritice (ex. „trateaza”). [] = text curat.
export function findHealthClaims(text: string): string[] {
  return words(matchTerms(HEALTH_CLAIMS, normalizeForMatch(text)))
}
