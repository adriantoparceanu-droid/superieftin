// Teste pentru regulile de sanatate ale blogului (lib/medical-content.ts) + paritatea cu web.
// Rulare: cd worker && npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  findHealthClaims, findMedicalTerms, medicalReasons, medicalProductErrors, isHealthTree,
  normalizeForMatch, HEALTH_CLAIMS, MEDICAL_PRODUCT_TERMS, HEALTH_TREE_ROOTS, MEDICAL_PRODUCT_MESSAGE,
} from './medical-content.js'

test('paritate: web/src/lib/medical-content.ts e identic cu worker/src/lib/medical-content.ts', () => {
  const w = readFileSync(new URL('./medical-content.ts', import.meta.url), 'utf8')
  const web = readFileSync(new URL('../../../web/src/lib/medical-content.ts', import.meta.url), 'utf8')
  assert.equal(web, w, 'copiile difera — modifica-le impreuna')
})

test('paritate: aceleasi rezultate in web (import real)', async () => {
  const webPath = new URL('../../../web/src/lib/medical-content.ts', import.meta.url).href
  const web = await import(webPath) as typeof import('./medical-content.js')
  assert.deepEqual([...web.HEALTH_CLAIMS], [...HEALTH_CLAIMS])
  assert.deepEqual([...web.MEDICAL_PRODUCT_TERMS], [...MEDICAL_PRODUCT_TERMS])
  for (const s of [...MEDICAL_NAMES, ...NORMAL_NAMES, ...CLAIM_TEXTS, ...NORMAL_TEXTS]) {
    assert.deepEqual(web.findHealthClaims(s), findHealthClaims(s), s)
    assert.deepEqual(web.findMedicalTerms(s), findMedicalTerms(s), s)
  }
  // findHealthClaims din web (lib/guides/format.ts) e chiar functia de aici
  const fmt = await import(new URL('../../../web/src/lib/guides/format.ts', import.meta.url).href) as { findHealthClaims: typeof findHealthClaims }
  for (const s of CLAIM_TEXTS) assert.deepEqual(fmt.findHealthClaims(s), findHealthClaims(s), s)
})

test('normalizare: litere mici, fara diacritice (si cu sedila), spatii unice', () => {
  assert.equal(normalizeForMatch('Întărește  ŞI Ţine  ăâ'), 'intareste si tine aa')
})

test('arborii de sanatate', () => {
  assert.deepEqual([...HEALTH_TREE_ROOTS], ['sanatate-naturale', 'farmacie-veterinara'])
  assert.equal(isHealthTree('ceaiuri-infuzii', ['sanatate-naturale']), true)
  assert.equal(isHealthTree('perii-pieptene', ['animale-de-companie']), false)
})

// Denumiri care trebuie prinse (din arborii de sanatate)
const MEDICAL_NAMES = [
  'Supliment alimentar Magneziu + B6, 60 capsule',
  'Vitamina C 1000 mg, 30 comprimate efervescente',
  'Colagen marin hidrolizat, pulbere 300 g',
  'Omega 3 ulei de peste, 90 capsule moi',
  'Ginseng Panax tinctura 50 ml',
  'Picaturi pentru ochi caini 10 ml',
  'Picături de propolis fără alcool',
  'Sirop pentru tuse copii 100 ml',
  'Probiotic Junior, 10 plicuri',
  'Zgardă antiparazitară câini mari 70 cm',
  'Pipete antipurici și căpușe pisici, 3 buc',
  'Comprimate deparazitare interna caini (viermi)',
  'Unguent antiinflamator cu arnica 50 g',
  'Gel analgezic pentru articulatii',
  'Melatonina 5 mg, 60 tablete',
  'Extract standardizat de curcuma',
  'Ceai pentru slăbire, 20 plicuri',
  'Ceai detox ficat 50 g',
  'Fiole par cu biotina',
  'Pastile de supt pentru gat',
  'Spot-on Fipronil caini 10-20 kg',
  'Șampon antiparazitar pentru câini 250 ml',
  'Vaccin polivalent caini (test)',
  'Ceai imunitate copii',
]

// Denumiri ne-medicale (cosmetice naturale, ceaiuri/alimente ca atare, accesorii pentru animale)
const NORMAL_NAMES = [
  'Ceai de mentă, 20 plicuri',
  'Infuzie de fructe de pădure, 25 plicuri',
  'Sirop de arțar bio 250 ml',
  'Tabletă de ciocolată neagră 85% bio',
  'Miere de salcâm 500 g',
  'Ulei de cocos presat la rece 500 ml',
  'Săpun natural cu lavandă',
  'Șampon cosmetic pentru câini cu ovăz 250 ml',
  'Perie pentru câini cu păr lung',
  'Zgardă din piele, mărimea M',
  'Cremă de mâini cu unt de shea',
  'Nuci macadamia crude 200 g',
  'Fierbător de apă inox 1,7 l',
  'Tratament de noapte pentru păr cu ulei de argan',
]

test('denumiri medicale → prinse; mesaj clar la ghid', () => {
  for (const n of MEDICAL_NAMES) assert.ok(medicalReasons(n).length > 0, n)
  const errs = medicalProductErrors([{ ref: 'magneziu-b6', name: MEDICAL_NAMES[0], healthTree: true }])
  assert.equal(errs.length, 1)
  assert.ok(errs[0].includes(MEDICAL_PRODUCT_MESSAGE))
  assert.ok(errs[0].includes('magneziu-b6'))
})

test('denumiri ne-medicale → trec (inclusiv exceptiile: ceai la plicuri, sirop de artar, tableta de ciocolata)', () => {
  for (const n of NORMAL_NAMES) assert.deepEqual(medicalReasons(n), [], n)
})

test('produsele din afara arborilor de sanatate nu sunt verificate dupa denumire', () => {
  assert.deepEqual(medicalProductErrors([{ ref: 'tab', name: 'Tabletă Samsung Galaxy Tab A9', healthTree: false }]), [])
  assert.equal(medicalProductErrors([{ ref: 'tab', name: 'Melatonina 60 tablete', healthTree: true }]).length, 1)
})

test('picaturi: fara exceptii', () => {
  assert.deepEqual(findMedicalTerms('Ceai picaturi 20 plicuri'), ['picaturi'])
})

const CLAIM_TEXTS = [
  'Acest ceai vindecă răceala.',
  'Tratează eficient problemele de piele.',
  'Un produs care detoxifică organismul.',
  'Întărește imunitatea copiilor.',
  'Susține sistemul imunitar.',
  'Are efect antiinflamator și antibacterian.',
  'Ideal pentru slăbit: arde grăsimi rapid.',
  'Scade colesterolul și glicemia.',
  'Ajută la menținerea tensiunii arteriale în limite normale.',
  'Protejează ficatul.',
  'Cremă anti-îmbătrânire care regenerează pielea.',
  'Previne cancerul și diabetul.',
  'Ameliorează simptomele răcelii.',
  'Calmează durerile articulare.',
  'O cură de 30 de zile.',
  'Terapie naturală pentru stres.',
  'Este un remediu natural.',
  'Bogat în antioxidanți.',
  'Ajută digestia după mese copioase.',
]

// Texte normale de blog care NU trebuie blocate (tech, casa, animale, alimente)
const NORMAL_TEXTS = [
  'Ecranul are tratament antireflex, deci se vede bine și în soare. Folia previne zgârieturile.',
  'Dacă semnalul Wi-Fi e slăbit în dormitor, un sistem mesh rezolvă problema fără bătăi de cap.',
  'Carcasa din aluminiu întărește structura, iar balamaua rezistă la mii de deschideri.',
  'Perie de silicon pentru câini cu păr scurt: îndepărtează părul mort și e ușor de curățat după folosire.',
  'Ceaiul de mentă la plicuri e o alegere simplă; o curățenie generală a dulapului cu ceaiuri nu strică.',
  'Uleiul de cocos presat la rece se folosește în bucătărie și la prăjituri; are gust discret.',
  'Bateria ține o zi întreagă; simptomele unei baterii uzate sunt închiderile bruște la 20%.',
  'Castronul din inox nu reține mirosuri, iar baza din cauciuc îl ține pe loc când pisica mănâncă.',
]

test('afirmatii de sanatate in text → prinse', () => {
  for (const t of CLAIM_TEXTS) assert.ok(findHealthClaims(t).length > 0, t)
})

test('texte normale de blog → NU sunt blocate', () => {
  for (const t of NORMAL_TEXTS) assert.deepEqual(findHealthClaims(t), [], t)
})

test('compatibilitate: formele vechi raman prinse, fara fals pozitiv in interiorul cuvintelor', () => {
  assert.deepEqual(findHealthClaims('Detoxifiere completă'), ['detoxifiere'])
  assert.deepEqual(findHealthClaims('Nu retratează nimic'), [])
  assert.deepEqual(findHealthClaims('Elimină toxinele'), ['elimina toxinele'])
  assert.deepEqual(findHealthClaims('previne boli'), ['previne boli', 'boli'])
})
