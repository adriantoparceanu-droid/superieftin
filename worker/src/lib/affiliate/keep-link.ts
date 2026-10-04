import type { ResolvedAffiliate } from './types.js'

// Ce link afiliat salvam pe o oferta: cel pe care il avem deja (din feed-ul retelei sau
// salvat anterior) sau cel construit de rezolver din codul primit prin API.
//
// Regula (incidentul din 28.09.2026): linkul existent CASTIGA. Rezolverul se foloseste doar
// cand oferta nu are niciun link afiliat (ex. eMAG, scanat local, fara feed).
//
// De ce: rezolverul construieste linkul Profitshare din `affiliate_identifier` intors de API
// (`affiliate-advertisers`), iar API-ul da coduri diferite de la o zi la alta (piC, Vk0, deC,
// Hpz…). Jobul de sync scria codul zilei peste TOATE linkurile din feed-uri; din 29.09
// codurile primite (Vk0, apoi deC) nu mai inregistrau clickuri in panoul Profitshare, in timp
// ce linkurile din feed (piC) mergeau. Feed-ul retelei e sursa de adevar pentru link.
export interface AffiliateChoice {
  affiliateUrl: string | null
  affiliateNetwork: string | null
}

// Codul de afiliat dintr-un link Profitshare /lps/<advertiser>/<cod>/ (null pentru alt format).
const LPS_RE = /^(https?:)?\/\/(l\.)?profitshare\.ro\/lps\/[^/]+\/([A-Za-z0-9]{1,16})\//

export function lpsAffiliateCode(url: string | null): string | null {
  return url?.match(LPS_RE)?.[3] ?? null
}

// Pune in linkul /lps/ construit de rezolver codul de afiliat folosit de feed-ul magazinului
// (cel numarat in Profitshare), in locul codului zilei din API. Fara cod de feed → neschimbat.
export function withFeedCode(url: string, feedCode: string | null): string {
  const code = lpsAffiliateCode(url)
  if (!code || !feedCode || code === feedCode) return url
  return url.replace(/(\/lps\/[^/]+\/)[^/]+\//, `$1${feedCode}/`)
}

export function chooseAffiliate(current: AffiliateChoice, resolved: ResolvedAffiliate | null): AffiliateChoice {
  if (current.affiliateUrl) return current
  if (resolved) return { affiliateUrl: resolved.affiliateUrl, affiliateNetwork: resolved.network }
  return current
}
