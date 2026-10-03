// ads:validate — verificarile care NU au nevoie de contul Google Ads.
//
//  1. statice (functii pure, testate in validate.test.ts): limite de caractere, numar de
//     titluri/descrieri, bugete si CPC fata de guardrails.yaml, retea/geo/limba, cuvinte cheie
//     (fara broad, fara branduri de retaileri, fara duplicate, neblocate de propriile negative),
//     negativele de baza prezente, URL-uri pe www.superieftin.ro, fara /go/, fara categorii excluse;
//  2. live (pe site-ul de productie): fiecare URL raspunde 200 direct (fara redirect), pagina nu e
//     noindex, produsul e in stoc, categoria nu e exclusa, iar afirmatiile din anunturi sunt
//     adevarate pe pagina ACUM (regula 9): „reducere / sub mediana” cere insigna „Reducere reala”,
//     orice procent trebuie sa coincida cu procentul afisat, marcile din text apar pe pagina.

import type { Campaign, CampaignFile, Guardrails, Keyword, AdGroup, RsaAd } from './schema.js'
import { positiveKeywords, parseNegative, kwKey, formatKw, normKw } from './schema.js'

export interface Issue { level: 'error' | 'warn'; where: string; msg: string }

export const SITE_HOST = 'www.superieftin.ro'

// Limitele Google pentru anunturi si extensii (caractere)
export const LIMITS = {
  headline: 30, description: 90, path: 15,
  sitelinkText: 25, sitelinkDesc: 35, callout: 25, snippetValue: 25,
  keywordChars: 80, keywordWords: 10,
}
// Ce cerem noi (ads-builder): minim 8 titluri si 3 descrieri; tinta 12–15 si 4
export const RSA_MIN = { headlines: 8, descriptions: 3 }
export const RSA_TARGET = { headlines: 12, descriptions: 4 }
export const RSA_MAX = { headlines: 15, descriptions: 4 }

// Negative obligatorii in fiecare campanie (ads-builder, „Negative de baza”)
export const BASE_NEGATIVES = ['gratis', 'second hand', 'folosit', 'service', 'reparatie', 'manual',
  'driver', 'olx', 'piese', 'cum', 'ce este', 'forum']
// Brandurile retailerilor: DOAR ca negative (evoMAG interzice explicit; la ceilalti e practica
// standard in programele de afiliere). Obligatorii ca negative, interzise in cuvinte si texte.
export const RETAILER_BRANDS = ['emag', 'evomag', 'evo mag', 'itgalaxy', 'it galaxy', 'vexio', 'citgrup',
  'cit grup', 'forit', 'vegis', 'altex', 'flanco']
// Marci de produs: daca apar in textul anuntului trebuie sa apara si pe landing page
export const PRODUCT_BRANDS = ['samsung', 'galaxy', 'apple', 'iphone', 'xiaomi', 'huawei', 'honor', 'google pixel',
  'lenovo', 'asus', 'acer', 'dell', 'hp', 'lg', 'sony', 'philips', 'tcl', 'motorola', 'oppo', 'nokia']

// Cuvinte scrise integral cu majuscule permise (restul = „majuscule excesive”)
const CAPS_OK = new Set(['RON', 'FE', 'TV', 'OLED', 'LED', 'USB', 'RAM', 'SSD', 'PC', 'RO'])

const len = (s: string) => [...s].length
const words = (s: string) => normKw(s).split(' ').filter(Boolean)
const strip = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// Contine cuvantul/expresia `term` ca expresie intreaga (fara diacritice, litere mici)?
export function containsTerm(text: string, term: string): boolean {
  const t = ` ${strip(text).replace(/[^a-z0-9+]+/g, ' ')} `
  return t.includes(` ${strip(term).replace(/[^a-z0-9+]+/g, ' ').trim()} `)
}

// Ar bloca negativul `neg` cautarea `query`? (semantica Google, fara variante apropiate)
export function negativeBlocks(neg: Keyword, query: string): boolean {
  const q = words(query), n = words(neg.text)
  if (!n.length) return false
  if (neg.matchType === 'EXACT') return q.join(' ') === n.join(' ')
  if (neg.matchType === 'PHRASE') {
    for (let i = 0; i + n.length <= q.length; i++) if (n.every((w, j) => q[i + j] === w)) return true
    return false
  }
  return n.every((w) => q.includes(w))
}

// Probleme de stil interzise de politicile Google (Editorial & Punctuation)
export function styleProblems(text: string, kind: 'headline' | 'description' | 'other'): string[] {
  const out: string[] = []
  if (/\p{Extended_Pictographic}/u.test(text)) out.push('conține emoji / simboluri decorative')
  if (/[★☆✓✔✗→←►▶•●■□♥❤€$£™®©]/u.test(text)) out.push('conține simboluri în loc de cuvinte')
  if (/([!?.])\1/.test(text)) out.push('punctuație repetată')
  if (kind === 'headline' && text.includes('!')) out.push('„!” nu e permis în titluri')
  if ((text.match(/!/g) ?? []).length > 1) out.push('mai mult de un „!”')
  for (const w of text.split(/[^\p{L}\p{N}]+/u)) {
    if (w.length >= 3 && /^\p{Lu}+$/u.test(w) && !CAPS_OK.has(w)) { out.push(`majuscule excesive („${w}”)`); break }
  }
  if (/^\s|\s$|\s{2,}/.test(text)) out.push('spații la început/sfârșit sau duble')
  return out
}

// Procentele scrise in text (ex. „-16%”, „16,8 %”) → numere
export function percentsIn(text: string): number[] {
  return [...text.matchAll(/(\d+(?:[.,]\d+)?)\s*%/g)].map((m) => Number(m[1].replace(',', '.')))
}

// Mentioneaza textul o reducere? (atunci landing-ul trebuie sa arate „Reducere reala” acum)
export function claimsDiscount(text: string): boolean {
  return /reduc|sub median|redus|ieftinit|discount/i.test(strip(text))
}

// --- Afirmatii care expira (verdictul policy-reviewer B1, 2026-09-27) ----------------------------
//
// De ce: insigna „Reducere reala” depinde de mediana pe 30 de zile, care „prinde din urma” un pret
// redus in 5–14 zile. Un anunt care spune „sub mediana” / „redus” / „-16%” devine fals fara ca
// cineva sa-l modifice (regula 9). De aceea textele anunturilor (titluri, descrieri, sitelinks,
// callouts, snippets) vorbesc DOAR despre metoda si serviciu („Comparam cu mediana pe 30 zile”,
// „Istoric de pret pe 90 de zile”), niciodata despre starea de azi a pretului.
//
// Exceptie ingusta: un anunt sau sitelink catre o pagina de LISTA (ex. /reduceri-reale/telefoane-mobile,
// /despre — orice nu e /p/) poate vorbi de „reduceri” / „sub mediana”, pentru ca pagina aceea e,
// prin definitie, lista produselor sub mediana (sau explicatia metodei) — afirmatia nu expira.
// Callouts si snippets n-au exceptia (apar langa orice anunt, inclusiv cele spre /p/). Procentele
// si „pret redus” raman interzise peste tot.
const EXPIRING_ANYWHERE: [RegExp, string][] = [
  [/\d+(?:[.,]\d+)?\s*%/, 'procent de reducere'],
  [/\bredus[aei]?\b|\breduse\b/, '„redus”'],
  [/\bieftinit\w*/, '„ieftinit”'],
  [/\bieftin\w*\b[^.]*\b(?:azi|acum)\b|\b(?:azi|acum)\b[^.]*\bieftin\w*/, '„ieftin azi/acum”'],
  [/\bmai ieftin\b|\bcel mai ieftin\b|\bcel mai mic pret\b|\bpret(?:ul)? minim\b|\bcel mai bun pret\b/, 'superlativ de preț'],
  [/\b(?:a scazut|scazut|scade)\b/, '„a scăzut”'],
  [/\beconomis\w*/, '„economisești”'],
  [/\b(?:discount|promo\w*|oferta zilei|oferta speciala|pret special|lichidare|chilipir\w*|black friday)\b/, 'promoție'],
]
const EXPIRING_UNLESS_LISTING: [RegExp, string][] = [
  [/\bsub median/, '„sub mediană”'],
  [/\breduc\w*/, '„reducere”'],
]

// Motivele pentru care textul contine o afirmatie care expira (gol = textul e stabil).
// listingPage = textul e al unui sitelink catre o pagina care NU e de produs (vezi mai sus).
export function expiringClaims(text: string, opts: { listingPage?: boolean } = {}): string[] {
  const t = strip(text)
  const rules = opts.listingPage ? EXPIRING_ANYWHERE : [...EXPIRING_ANYWHERE, ...EXPIRING_UNLESS_LISTING]
  return rules.filter(([re]) => re.test(t)).map(([, why]) => why)
}

export function checkUrlStatic(url: string, g: Guardrails): string[] {
  const out: string[] = []
  let u: URL
  try { u = new URL(url) } catch { return [`URL invalid: ${url}`] }
  if (u.protocol !== 'https:') out.push(`URL-ul trebuie să fie https: ${url}`)
  if (u.host !== SITE_HOST) out.push(`URL-ul trebuie să fie pe ${SITE_HOST} (domeniul canonic): ${url}`)
  if (/^\/go(\/|$)/.test(u.pathname)) out.push(`URL-ul final nu poate fi /go/ (link afiliat) — folosește pagina /p/: ${url}`)
  for (const c of g.excluded_categories ?? []) {
    if (u.pathname.split('/').includes(c)) out.push(`categorie exclusă din reclame (${c}): ${url}`)
  }
  return out
}

function allUrls(c: Campaign): string[] {
  const urls: string[] = []
  for (const ag of c.ad_groups ?? []) {
    urls.push(ag.final_url)
    for (const ad of ag.ads ?? []) if (ad.final_url) urls.push(ad.final_url)
  }
  for (const s of c.extensions?.sitelinks ?? []) urls.push(s.url)
  return urls.filter(Boolean)
}

export function adTexts(ad: RsaAd): string[] {
  return [...(ad.headlines ?? []), ...(ad.descriptions ?? [])]
}

// --- Validare statica a unei campanii ------------------------------------------------------------

export function validateCampaign(cf: CampaignFile, g: Guardrails): Issue[] {
  const issues: Issue[] = []
  const c = cf.campaign
  const at = (where: string) => `${cf.rel} › ${where}`
  const err = (where: string, msg: string) => issues.push({ level: 'error', where: at(where), msg })
  const warn = (where: string, msg: string) => issues.push({ level: 'warn', where: at(where), msg })

  // Campania
  if (!c.name?.startsWith('SE | ')) err('campaign.name', 'numele trebuie să înceapă cu „SE | ” (așa le recunoaște ads:plan)')
  if (c.status !== (g.safety?.new_entities_status ?? 'PAUSED')) err('campaign.status', `trebuie să fie ${g.safety?.new_entities_status ?? 'PAUSED'} (regula 1); activarea o face proprietarul în Google Ads`)
  if (!(typeof c.daily_budget === 'number' && c.daily_budget > 0)) err('campaign.daily_budget', 'buget zilnic lipsă sau invalid')
  else if (c.daily_budget > g.budget.max_daily_per_campaign) err('campaign.daily_budget', `${c.daily_budget} lei/zi depășește plafonul de ${g.budget.max_daily_per_campaign} lei/zi pe campanie (guardrails)`)

  const strategy = c.bidding?.strategy
  if (!g.bidding.allowed_strategies.includes(strategy)) err('campaign.bidding.strategy', `strategia „${strategy}” nu e permisă (guardrails: ${g.bidding.allowed_strategies.join(', ')})`)
  const maxCpc = c.bidding?.max_cpc
  if (!(typeof maxCpc === 'number' && maxCpc > 0)) err('campaign.bidding.max_cpc', 'CPC maxim lipsă sau invalid (obligatoriu, și la MAXIMIZE_CLICKS ca plafon)')
  else if (maxCpc > g.bidding.max_cpc) err('campaign.bidding.max_cpc', `${maxCpc} lei depășește CPC-ul maxim de ${g.bidding.max_cpc} lei (guardrails)`)

  const t = c.targeting ?? {}
  const countries = t.countries ?? []
  const languages = t.languages ?? []
  if (!countries.length) err('campaign.targeting.countries', 'lipsește țara (RO)')
  for (const x of countries) if (!g.targeting.countries.includes(x)) err('campaign.targeting.countries', `țara ${x} nu e permisă (guardrails: ${g.targeting.countries.join(', ')})`)
  if (!languages.length) err('campaign.targeting.languages', 'lipsește limba (ro)')
  for (const x of languages) if (!g.targeting.languages.includes(x)) err('campaign.targeting.languages', `limba ${x} nu e permisă (guardrails: ${g.targeting.languages.join(', ')})`)
  if (t.location_mode !== 'PRESENCE') err('campaign.targeting.location_mode', 'trebuie PRESENCE (doar persoane aflate în România, nu „interesate de”)')
  const n = t.networks ?? {}
  for (const k of ['search', 'search_partners', 'display'] as const) {
    if (n[k] !== g.targeting.networks[k]) err(`campaign.targeting.networks.${k}`, `trebuie ${g.targeting.networks[k]} (guardrails: doar rețeaua Search)`)
  }
  if (!c.conversion_goal?.conversion_action_id) err('campaign.conversion_goal', 'lipsește obiectivul de conversie („Comision afiliere”)')

  // Audiente (liste de remarketing) — vezi validateAudiences
  if (c.audiences !== undefined) {
    const agCpcs = (c.ad_groups ?? []).map((ag) => ag.max_cpc ?? maxCpc).filter((x): x is number => typeof x === 'number')
    for (const [where, msg, level] of validateAudiences(c.audiences, Math.max(0, ...agCpcs), g, strategy)) {
      if (level === 'error') err(where, msg); else warn(where, msg)
    }
  }

  // Negative la nivel de campanie
  const campNeg = (c.negative_keywords ?? []).map(parseNegative)
  const seenNeg = new Set<string>()
  for (const k of campNeg) {
    if (seenNeg.has(kwKey(k))) warn('campaign.negative_keywords', `negativ duplicat: ${formatKw(k)}`)
    seenNeg.add(kwKey(k))
  }
  // Obligatorii: broad sau phrase (exact ar bloca doar cautarea identica, deci nu ajunge)
  const wideNeg = new Set(campNeg.filter((k) => k.matchType !== 'EXACT').map((k) => k.text))
  const missing = [...BASE_NEGATIVES, ...RETAILER_BRANDS].filter((x) => !wideNeg.has(x))
  if (missing.length) err('campaign.negative_keywords', `lipsesc negativele obligatorii: ${missing.join(', ')}`)

  // Grupuri de anunturi
  if (!c.ad_groups?.length) err('campaign.ad_groups', 'niciun grup de anunțuri')
  const agNames = new Set<string>()
  for (const [i, ag] of (c.ad_groups ?? []).entries()) {
    const w = `ad_groups[${i}] „${ag.name}”`
    if (!ag.name) err(w, 'grup fără nume')
    if (agNames.has(ag.name)) err(w, 'nume de grup duplicat în campanie')
    agNames.add(ag.name)
    if (!ag.final_url) err(w, 'lipsește final_url')
    if (ag.max_cpc != null) {
      if (!(ag.max_cpc > 0)) err(`${w}.max_cpc`, 'CPC invalid')
      else if (typeof maxCpc === 'number' && ag.max_cpc > maxCpc) err(`${w}.max_cpc`, `${ag.max_cpc} lei depășește CPC-ul maxim al campaniei (${maxCpc})`)
      else if (ag.max_cpc > g.bidding.max_cpc) err(`${w}.max_cpc`, `depășește guardrails (${g.bidding.max_cpc})`)
    }

    const kws = positiveKeywords(ag)
    if (!kws.length) err(w, 'niciun cuvânt cheie')
    const agNeg = (ag.negative_keywords ?? []).map(parseNegative)
    for (const k of kws) {
      const kw = `${w} › ${formatKw(k)}`
      if (k.matchType === 'BROAD') err(kw, 'broad match nu e permis (doar la cererea explicită a proprietarului)')
      if (c.exact_only && k.matchType !== 'EXACT') err(kw, 'campania e exact_only: doar cuvinte exact match')
      if (len(k.text) > LIMITS.keywordChars) err(kw, `peste ${LIMITS.keywordChars} de caractere`)
      if (words(k.text).length > LIMITS.keywordWords) err(kw, `peste ${LIMITS.keywordWords} cuvinte`)
      for (const b of RETAILER_BRANDS) if (containsTerm(k.text, b)) err(kw, `conține brandul retailerului „${b}” (doar ca negativ)`)
      for (const neg of [...campNeg, ...agNeg]) {
        if (negativeBlocks(neg, k.text)) err(kw, `e blocat de propriul negativ ${formatKw(neg)}`)
      }
    }

    if (!ag.ads?.length) err(w, 'niciun anunț')
    for (const [j, ad] of (ag.ads ?? []).entries()) validateRsa(ad, `${w} › ads[${j}]`, err, warn)
  }

  // Extensii
  const ext = c.extensions ?? {}
  const sl = ext.sitelinks ?? []
  if (sl.length < 4) warn('extensions.sitelinks', `${sl.length} sitelinks (recomandat 4)`)
  const slTexts = new Set<string>()
  for (const [i, s] of sl.entries()) {
    const w = `extensions.sitelinks[${i}] „${s.text}”`
    if (!s.text || len(s.text) > LIMITS.sitelinkText) err(w, `textul are ${len(s.text ?? '')} caractere (max ${LIMITS.sitelinkText})`)
    if (slTexts.has(normKw(s.text ?? ''))) err(w, 'text de sitelink duplicat')
    slTexts.add(normKw(s.text ?? ''))
    if (!!s.description1 !== !!s.description2) err(w, 'descrierile sitelink-ului se dau amândouă sau deloc')
    for (const d of [s.description1, s.description2]) if (d && len(d) > LIMITS.sitelinkDesc) err(w, `descrierea „${d}” are ${len(d)} caractere (max ${LIMITS.sitelinkDesc})`)
    for (const txt of [s.text, s.description1, s.description2]) if (txt) for (const p of styleProblems(txt, 'other')) err(w, p)
  }
  for (const [i, co] of (ext.callouts ?? []).entries()) {
    if (len(co) > LIMITS.callout) err(`extensions.callouts[${i}] „${co}”`, `${len(co)} caractere (max ${LIMITS.callout})`)
    for (const p of styleProblems(co, 'other')) err(`extensions.callouts[${i}]`, p)
  }
  for (const [i, s] of (ext.structured_snippets ?? []).entries()) {
    const w = `extensions.structured_snippets[${i}]`
    if (!s.header) err(w, 'lipsește header')
    if ((s.values ?? []).length < 3 || (s.values ?? []).length > 10) err(w, 'între 3 și 10 valori')
    for (const v of s.values ?? []) if (len(v) > LIMITS.snippetValue) err(w, `valoarea „${v}” are ${len(v)} caractere (max ${LIMITS.snippetValue})`)
  }

  // Retaileri in texte (anunturi + extensii)
  const texts: [string, string][] = []
  for (const [i, ag] of (c.ad_groups ?? []).entries()) for (const ad of ag.ads ?? []) for (const x of adTexts(ad)) texts.push([`ad_groups[${i}]`, x])
  for (const s of sl) for (const x of [s.text, s.description1, s.description2]) if (x) texts.push(['extensions.sitelinks', x])
  for (const x of ext.callouts ?? []) texts.push(['extensions.callouts', x])
  for (const s of ext.structured_snippets ?? []) for (const x of s.values ?? []) texts.push(['extensions.structured_snippets', x])
  for (const [w, x] of texts) for (const b of RETAILER_BRANDS) if (containsTerm(x, b)) err(w, `textul „${x}” conține brandul retailerului „${b}”`)

  // Afirmatii care expira (reducere „azi”) — vezi expiringClaims. Sitelink-urile catre pagini
  // care nu sunt de produs au exceptia ingusta pentru „reduceri” / „sub mediana”.
  const isProductUrl = (u: string) => { try { return new URL(u).pathname.startsWith('/p/') } catch { return true } }
  const stable = (w: string, x: string, listingPage = false) => {
    const why = expiringClaims(x, { listingPage })
    if (why.length) err(w, `„${x}” afirmă o reducere de azi (${why.join(', ')}) — devine falsă când mediana prinde prețul din urmă; scrie despre metodă/serviciu (regula 9)`)
  }
  for (const [i, ag] of (c.ad_groups ?? []).entries()) for (const [j, ad] of (ag.ads ?? []).entries()) {
    const listing = !isProductUrl(ad.final_url || ag.final_url)
    for (const x of adTexts(ad)) stable(`ad_groups[${i}] › ads[${j}]`, x, listing)
  }
  for (const [i, s] of sl.entries()) for (const x of [s.text, s.description1, s.description2]) if (x) stable(`extensions.sitelinks[${i}]`, x, !isProductUrl(s.url))
  for (const [i, x] of (ext.callouts ?? []).entries()) stable(`extensions.callouts[${i}]`, x)
  for (const [i, s] of (ext.structured_snippets ?? []).entries()) for (const x of s.values ?? []) stable(`extensions.structured_snippets[${i}]`, x)

  // URL-uri (static)
  for (const u of allUrls(c)) for (const p of checkUrlStatic(u, g)) err('url', p)

  return issues
}

// --- Audiente (remarketing pe Search, docs/ads-program/remarketing-vizitatori.md) -----------------
//
// Ajustarea de licitare e plafonata aici (nu in guardrails.yaml, pe care nu-l modificam fara
// cererea proprietarului): intre -50% si +50%. In plus, CPC-ul maxim inmultit cu ajustarea nu
// are voie sa treaca de CPC-ul maxim din guardrails — altfel lista ar ocoli plafonul dur.
export const AUDIENCE_BID_MODIFIER = { min: 0.5, max: 1.5 }

export function validateAudiences(
  a: Campaign['audiences'], highestCpc: number, g: Guardrails, strategy: string,
): [string, string, 'error' | 'warn'][] {
  const out: [string, string, 'error' | 'warn'][] = []
  const w = 'campaign.audiences'
  if (!a || typeof a !== 'object') return [[w, 'secțiune invalidă (aștept mode + segments)', 'error']]
  if (a.mode === 'TARGETING') out.push([`${w}.mode`, 'TARGETING (reclame DOAR pentru membrii listei) nu e permis încă — listele sunt sub pragul de 100 de utilizatori activi; folosește OBSERVATION (decizia proprietarului)', 'error'])
  else if (a.mode !== 'OBSERVATION') out.push([`${w}.mode`, `mod necunoscut „${String(a.mode)}” (OBSERVATION)`, 'error'])
  const segs = Array.isArray(a.segments) ? a.segments : []
  if (!segs.length) out.push([`${w}.segments`, 'nicio listă (scoate secțiunea audiences dacă nu vrei liste)', 'error'])
  const seen = new Set<string>()
  for (const [i, s] of segs.entries()) {
    const sw = `${w}.segments[${i}] „${s?.name ?? ''}”`
    const id = String(s?.user_list_id ?? '')
    if (!s?.name) out.push([sw, 'lipsește name', 'error'])
    if (!/^\d+$/.test(id)) out.push([sw, `user_list_id „${id}” invalid (doar cifre — ID-ul listei din Google Ads, nu din GA4)`, 'error'])
    if (seen.has(id)) out.push([sw, 'listă duplicată', 'error'])
    seen.add(id)
    const m = s?.bid_modifier ?? 1
    if (typeof m !== 'number' || !(m >= AUDIENCE_BID_MODIFIER.min && m <= AUDIENCE_BID_MODIFIER.max)) {
      out.push([sw, `bid_modifier ${String(m)} în afara intervalului ${AUDIENCE_BID_MODIFIER.min}–${AUDIENCE_BID_MODIFIER.max} (-50%…+50%)`, 'error'])
    } else if (highestCpc * m > g.bidding.max_cpc + 1e-9) {
      out.push([sw, `CPC ${highestCpc} lei × ${m} = ${(highestCpc * m).toFixed(2)} lei depășește CPC-ul maxim de ${g.bidding.max_cpc} lei (guardrails)`, 'error'])
    }
    if (m !== 1 && strategy === 'MAXIMIZE_CLICKS') out.push([sw, 'la MAXIMIZE_CLICKS Google poate ignora ajustarea de licitare pe audiențe — lista rămâne utilă pentru observare', 'warn'])
  }
  return out
}

function validateRsa(ad: RsaAd, w: string, err: (w: string, m: string) => void, warn: (w: string, m: string) => void) {
  if (ad.type !== 'RSA') { err(w, `tip de anunț necunoscut „${ad.type}” (doar RSA)`); return }
  const h = ad.headlines ?? [], d = ad.descriptions ?? []
  if (h.length < RSA_MIN.headlines) err(w, `${h.length} titluri (minim ${RSA_MIN.headlines})`)
  else if (h.length < RSA_TARGET.headlines) warn(w, `${h.length} titluri (țintă ${RSA_TARGET.headlines}–${RSA_MAX.headlines})`)
  if (h.length > RSA_MAX.headlines) err(w, `${h.length} titluri (maxim ${RSA_MAX.headlines})`)
  if (d.length < RSA_MIN.descriptions) err(w, `${d.length} descrieri (minim ${RSA_MIN.descriptions})`)
  else if (d.length < RSA_TARGET.descriptions) warn(w, `${d.length} descrieri (țintă ${RSA_TARGET.descriptions})`)
  if (d.length > RSA_MAX.descriptions) err(w, `${d.length} descrieri (maxim ${RSA_MAX.descriptions})`)
  const seen = new Set<string>()
  for (const x of h) {
    if (len(x) > LIMITS.headline) err(w, `titlul „${x}” are ${len(x)} caractere (max ${LIMITS.headline})`)
    for (const p of styleProblems(x, 'headline')) err(w, `titlul „${x}”: ${p}`)
    if (seen.has(normKw(x))) err(w, `titlu duplicat „${x}”`)
    seen.add(normKw(x))
  }
  for (const x of d) {
    if (len(x) > LIMITS.description) err(w, `descrierea „${x}” are ${len(x)} caractere (max ${LIMITS.description})`)
    for (const p of styleProblems(x, 'description')) err(w, `descrierea „${x}”: ${p}`)
    if (seen.has(normKw(x))) err(w, `descriere duplicată „${x}”`)
    seen.add(normKw(x))
  }
  for (const [k, p] of [['path1', ad.path1], ['path2', ad.path2]] as const) {
    if (p && len(p) > LIMITS.path) err(w, `${k} „${p}” are ${len(p)} caractere (max ${LIMITS.path})`)
    if (p && /[\s/]/.test(p)) err(w, `${k} „${p}” nu poate conține spații sau „/”`)
  }
  if (ad.path2 && !ad.path1) err(w, 'path2 fără path1')
}

// --- Validare pe toate fisierele -------------------------------------------------------------------

export function validateAll(files: CampaignFile[], g: Guardrails): Issue[] {
  const issues = files.flatMap((f) => validateCampaign(f, g))

  // Bugete totale: toate campaniile din YAML se pot activa, deci le numaram pe toate
  const total = files.reduce((s, f) => s + (Number(f.campaign.daily_budget) || 0), 0)
  if (total > g.budget.max_daily_total) issues.push({ level: 'error', where: 'total', msg: `suma bugetelor zilnice ${total} lei depășește plafonul total de ${g.budget.max_daily_total} lei/zi (guardrails)` })
  const monthly = Math.round(total * 30.4)
  if (monthly > g.budget.max_monthly_total) issues.push({ level: 'error', where: 'total', msg: `~${monthly} lei/lună depășește plafonul lunar de ${g.budget.max_monthly_total} lei (guardrails)` })

  // Nume de campanii unice
  const names = new Map<string, string>()
  for (const f of files) {
    const prev = names.get(f.campaign.name)
    if (prev) issues.push({ level: 'error', where: f.rel, msg: `numele campaniei e folosit și în ${prev}` })
    names.set(f.campaign.name, f.rel)
  }

  // Cuvinte cheie duplicate intre grupuri (in toate campaniile): acelasi text + acelasi tip
  // ar face grupurile noastre sa concureze intre ele in licitatie.
  const seen = new Map<string, string>()
  for (const f of files) for (const ag of f.campaign.ad_groups ?? []) for (const k of positiveKeywords(ag)) {
    const where = `${f.rel} › „${ag.name}”`
    const prev = seen.get(kwKey(k))
    if (prev) issues.push({ level: 'error', where, msg: `cuvântul ${formatKw(k)} apare și în ${prev}` })
    else seen.set(kwKey(k), where)
  }
  return issues
}

// --- Verificari live pe site ---------------------------------------------------------------------

export interface PageFacts {
  url: string
  status: number
  location?: string             // la redirect
  text: string                  // textul vizibil (fara taguri), pentru afirmatii si marci
  noindex: boolean
  discountPct: number | null    // „Reducere reala: 16,8% sub mediana de 30 de zile”
  inStock: boolean | null       // din JSON-LD Product (null = pagina nu e de produs)
  categories: string[]          // slug-urile din breadcrumb / JSON-LD
}

export type Fetcher = (url: string) => Promise<{ status: number; location?: string; body: string }>

export const defaultFetcher: Fetcher = async (url) => {
  const res = await fetch(url, { redirect: 'manual', headers: { 'User-Agent': 'superieftin-ads-validate/1.0', Accept: 'text/html' } })
  return { status: res.status, location: res.headers.get('location') ?? undefined, body: res.status === 200 ? await res.text() : '' }
}

export function parsePage(url: string, status: number, body: string, location?: string): PageFacts {
  const text = body
    .replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'")
    .replace(/\s+/g, ' ')
  const noindex = /<meta[^>]+name="robots"[^>]+content="[^"]*noindex/i.test(body)
  const m = text.match(/Reducere reală:\s*(\d+(?:[.,]\d+)?)\s*%\s*sub mediana/i)
  const discountPct = m ? Number(m[1].replace(',', '.')) : null
  let inStock: boolean | null = null
  const categories = new Set<string>()
  for (const s of body.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      const j = JSON.parse(s[1])
      for (const node of Array.isArray(j) ? j : [j]) {
        if (node['@type'] === 'Product') {
          const offers = Array.isArray(node.offers) ? node.offers : node.offers ? [node.offers] : []
          inStock = offers.some((o: any) => String(o.availability ?? '').endsWith('InStock'))
          if (node.category) categories.add(String(node.category))
        }
        if (node['@type'] === 'BreadcrumbList') {
          for (const it of node.itemListElement ?? []) {
            const mm = String(it.item ?? '').match(/\/c\/([^/?#]+)/)
            if (mm) categories.add(mm[1])
          }
        }
      }
    } catch { /* JSON-LD invalid: ignoram */ }
  }
  return { url, status, location, text, noindex, discountPct, inStock, categories: [...categories] }
}

// Incarcator de pagini cu cache (o pagina se descarca o singura data pe rulare). Folosit de
// validateLive si de garda zilnica (ads-guard, guard.ts).
export function createPageLoader(fetcher: Fetcher = defaultFetcher) {
  const pages = new Map<string, PageFacts>()
  const get = async (url: string) => {
    if (!pages.has(url)) {
      try {
        const r = await fetcher(url)
        pages.set(url, parsePage(url, r.status, r.body, r.location))
      } catch (e) {
        pages.set(url, { url, status: 0, text: '', noindex: false, discountPct: null, inStock: null, categories: [], location: String((e as Error).message) })
      }
    }
    return pages.get(url)!
  }
  // Parintii unei categorii (breadcrumb-ul paginii /c/<slug>) — ca sa prindem si subcategoriile
  // din Sanatate & Naturale (ex. suplimente-alimentare), nu doar slug-ul parinte.
  const catParents = new Map<string, string[]>()
  const parentsOf = async (slug: string) => {
    if (!catParents.has(slug)) {
      const p = await get(`https://${SITE_HOST}/c/${slug}`)
      catParents.set(slug, p.status === 200 ? p.categories : [])
    }
    return catParents.get(slug)!
  }
  return { pages, get, parentsOf }
}
export type PageLoader = ReturnType<typeof createPageLoader>

// Verificarea unei pagini de destinatie: 200 direct (fara redirect), indexabila, cu oferta in
// stoc, in afara categoriilor excluse. Intoarce motivele de respingere (gol = pagina e buna).
// strictStock = pagina de produs FARA JSON-LD Product (deci fara oferta) e respinsa (garda).
export async function landingProblems(url: string, loader: PageLoader, g: Guardrails, opts: { strictStock?: boolean } = {}): Promise<string[]> {
  const out: string[] = []
  const p = await loader.get(url)
  if (p.status !== 200) return [`${url} răspunde ${p.status || 'eroare de rețea'}${p.location ? ` (→ ${p.location})` : ''}; trebuie 200 direct`]
  if (p.noindex) out.push(`${url} e noindex (produs indisponibil?)`)
  if (p.inStock === false) out.push(`${url}: nicio ofertă în stoc`)
  else if (opts.strictStock && p.inStock == null && /^\/p\//.test(new URL(url).pathname)) out.push(`${url}: pagina de produs nu are nicio ofertă disponibilă`)
  // Categoria: din pagina (breadcrumb / JSON-LD) + din URL pentru /c/<slug> si /reduceri-reale/<slug>
  const fromPath = new URL(url).pathname.match(/^\/(?:c|reduceri-reale)\/([^/]+)/)?.[1]
  const own = [...p.categories, ...(fromPath ? [fromPath] : [])]
  const slugs = new Set(own)
  for (const s of own) for (const par of await loader.parentsOf(s)) slugs.add(par)
  for (const ex of g.excluded_categories ?? []) if (slugs.has(ex)) out.push(`${url} e în categoria exclusă ${ex} (regula 8)`)
  return out
}

// Verificarile live. `fetcher` e injectabil (testele folosesc pagini salvate).
export async function validateLive(files: CampaignFile[], g: Guardrails, fetcher: Fetcher = defaultFetcher): Promise<{ issues: Issue[]; pages: Map<string, PageFacts> }> {
  const issues: Issue[] = []
  const loader = createPageLoader(fetcher)
  const pages = loader.pages

  for (const f of files) {
    const c = f.campaign
    const urls = new Map<string, string>()   // url → unde e folosit
    for (const [i, ag] of (c.ad_groups ?? []).entries()) {
      urls.set(ag.final_url, `ad_groups[${i}] „${ag.name}”`)
      for (const ad of ag.ads ?? []) if (ad.final_url) urls.set(ad.final_url, `ad_groups[${i}] anunț`)
    }
    for (const [i, s] of (c.extensions?.sitelinks ?? []).entries()) if (!urls.has(s.url)) urls.set(s.url, `sitelinks[${i}] „${s.text}”`)

    for (const [url, where] of urls) {
      if (!url || checkUrlStatic(url, g).length) continue   // deja raportat static
      const w = `${f.rel} › ${where}`
      for (const msg of await landingProblems(url, loader, g)) issues.push({ level: 'error', where: w, msg })
    }

    // Afirmatiile din anunturi, pe pagina lor finala
    for (const [i, ag] of (c.ad_groups ?? []).entries()) {
      for (const [j, ad] of (ag.ads ?? []).entries()) {
        const url = ad.final_url || ag.final_url
        const p = pages.get(url)
        if (!p || p.status !== 200) continue
        const w = `${f.rel} › ad_groups[${i}] „${ag.name}” › ads[${j}]`
        issues.push(...claimIssues(adTexts(ad), p, w))
      }
    }
    for (const [i, s] of (c.extensions?.sitelinks ?? []).entries()) {
      const p = pages.get(s.url)
      if (!p || p.status !== 200) continue
      issues.push(...claimIssues([s.text, s.description1 ?? '', s.description2 ?? ''].filter(Boolean), p, `${f.rel} › sitelinks[${i}]`))
    }
  }
  return { issues, pages }
}

// Regula 9: afirmatiile trebuie sa fie adevarate pe landing ACUM.
export function claimIssues(texts: string[], p: PageFacts, where: string): Issue[] {
  const out: Issue[] = []
  for (const x of texts) {
    for (const pct of percentsIn(x)) {
      if (p.discountPct == null) out.push({ level: 'error', where, msg: `„${x}” are ${pct}%, dar ${p.url} nu afișează nicio reducere reală acum` })
      // „16%” e adevarat pentru 16,8% afisat (rotunjire in jos); „17%” nu.
      else if (!(pct <= p.discountPct && p.discountPct < Math.floor(pct) + 1)) out.push({ level: 'error', where, msg: `„${x}” spune ${pct}%, pagina ${p.url} afișează ${p.discountPct}%` })
    }
    if (claimsDiscount(x) && p.discountPct == null && /\/p\//.test(p.url)) {
      out.push({ level: 'error', where, msg: `„${x}” vorbește de reducere, dar ${p.url} nu mai afișează „Reducere reală” — anunțul ar fi fals (regula 9)` })
    }
    for (const b of PRODUCT_BRANDS) {
      if (containsTerm(x, b) && !containsTerm(p.text, b)) out.push({ level: 'error', where, msg: `„${x}” folosește marca „${b}”, care nu apare pe ${p.url}` })
    }
  }
  return out
}

export function describeAdGroupKeywords(ag: AdGroup): string {
  const k = positiveKeywords(ag)
  const e = k.filter((x) => x.matchType === 'EXACT').length, ph = k.filter((x) => x.matchType === 'PHRASE').length
  return `${k.length} cuvinte cheie (${e} exact, ${ph} phrase)`
}
