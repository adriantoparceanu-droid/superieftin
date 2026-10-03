import { getAdvertisers, advertiserStatus, buildAffiliateUrl, type PsAdvertiser } from '../profitshare.js'
import { extractDomain } from './domain.js'

// Link Profitshare „deep link” pentru magazinele fara feed (eMAG — scanat local).
//
// Formatul: https://l.profitshare.ro/lps/{advertiser_identifier}/{affiliate_identifier}/?redirect=<URL encodat>
//   - primul segment  = advertiser_identifier din API (`affiliate-advertisers`); eMAG = „9”, stabil.
//   - al doilea segment = affiliate_identifier = codul NOSTRU de afiliat, dar codificat de
//     Profitshare diferit la fiecare generare: API-ul raspunde din (cel putin) doua servere, fiecare
//     cu alt cod (verificat 2026-10-03: „FdB” si „6E5” alternand intre apeluri consecutive), iar
//     feed-urile/linkurile mai vechi au „piC”, „Bcb”, „EM2”, „pO7”… De aceea al doilea segment
//     difera intre magazine — nu e un cod per magazin. API-ul (autentificat cu contul nostru) il
//     da pe fiecare raspuns ca `affiliate_identifier`; il luam mereu de acolo, nu il hardcodam.
// Alternativa oficiala `POST affiliate-links` (folosita de pluginul WP Profitshare) creeaza cate un
// link scurt /l/{id} in cont per URL — e o scriere si nu o folosim pentru sute de produse.
//
// Statusul din API NU e stabil: serverele raspund diferit pentru `affiliate_statuses.active`
// (24 din 58 de advertiseri difera; unul dintre servere omite uneori complet campul). Asa a ramas
// eMAG „inactive” la scanarea din 1 oct → ingestul a scris affiliate_url NULL. Remediul de aici:
// daca un apel spune „inactiv”, mai intrebam de cateva ori; e suficient un raspuns „aprobat + activ”.

export interface PsLinkConfig {
  advertiserId: string
  advertiserName: string
  advertiserHash: string
  affiliateHash: string
}

// Codurile Profitshare sunt scurte, alfanumerice. Orice altceva (gol, cu „/”, „?”) ar strica linkul.
const CODE_RE = /^[A-Za-z0-9]{1,16}$/

// Alege din lista API advertiserul Profitshare pentru un domeniu, doar daca e aprobat + activ si are
// coduri valide. Functie pura (testata).
export function pickLinkConfig(advertisers: PsAdvertiser[], domain: string): PsLinkConfig | null {
  for (const adv of advertisers) {
    if (extractDomain(adv.url) !== domain) continue
    if (advertiserStatus(adv) !== 'active') continue
    const advertiserHash = String(adv.advertiser_identifier ?? '').trim()
    const affiliateHash = String(adv.affiliate_identifier ?? '').trim()
    if (!CODE_RE.test(advertiserHash) || !CODE_RE.test(affiliateHash)) continue
    return { advertiserId: String(adv.id), advertiserName: adv.name, advertiserHash, affiliateHash }
  }
  return null
}

export interface LinkConfigResult {
  config: PsLinkConfig | null
  attempts: number
  reason?: string   // de ce nu avem config (pentru log)
}

// Cauta configurarea prin API (doar citire), cu pana la `maxAttempts` apeluri (vezi mai sus de ce).
// `fetchAdvertisers` e injectabil pentru teste.
export async function findLinkConfig(
  domain: string,
  maxAttempts = 4,
  fetchAdvertisers: () => Promise<PsAdvertiser[]> = getAdvertisers,
): Promise<LinkConfigResult> {
  let lastReason = 'advertiser negasit in Profitshare'
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let advertisers: PsAdvertiser[]
    try {
      advertisers = await fetchAdvertisers()
    } catch (err) {
      lastReason = `API Profitshare: ${(err as Error).message}`
      continue
    }
    const config = pickLinkConfig(advertisers, domain)
    if (config) return { config, attempts: attempt }
    const found = advertisers.find((a) => extractDomain(a.url) === domain)
    if (found) {
      const st = found.commissions?.affiliate_statuses as { active?: string; approved?: string } | undefined
      lastReason = `advertiser ${found.name} (id ${found.id}) raportat neaprobat/inactiv `
        + `(approved=${st?.approved ?? '?'}, active=${st?.active ?? '?'}) sau fara coduri valide`
    }
  }
  return { config: null, attempts: maxAttempts, reason: lastReason }
}

// Construieste linkul afiliat pentru un URL de produs. Arunca eroare (nu inventeaza) daca URL-ul
// nu e http(s) sau nu e pe domeniul advertiserului.
//   - normalizam prin `new URL(...)`: diacriticele/spatiile brute devin %XX (UTF-8), iar %XX deja
//     existente raman neatinse — deci nu dublam encodarea;
//   - apoi tot URL-ul se encodeaza o data in `redirect` (encodeURIComponent: „&”, „?”, „=” devin %26…),
//     ca parametrii produsului sa nu se amestece cu ai Profitshare. Linkul se termina in
//     `?redirect=...`, deci `/go` poate lipi `&hash=<click_id>` (web/src/lib/subid.ts).
export function buildDeepLink(productUrl: string, config: PsLinkConfig, domain: string): string {
  let url: URL
  try {
    url = new URL(productUrl.trim())
  } catch {
    throw new Error(`URL de produs invalid: ${productUrl}`)
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error(`URL de produs non-http: ${productUrl}`)
  if (extractDomain(url.hostname) !== domain) throw new Error(`URL-ul nu e pe ${domain}: ${productUrl}`)
  url.hash = ''   // fragmentul (#...) nu ajunge oricum la magazin
  return buildAffiliateUrl(url.href, config.affiliateHash, config.advertiserHash)
}
