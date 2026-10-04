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

export function chooseAffiliate(current: AffiliateChoice, resolved: ResolvedAffiliate | null): AffiliateChoice {
  if (current.affiliateUrl) return current
  if (resolved) return { affiliateUrl: resolved.affiliateUrl, affiliateNetwork: resolved.network }
  return current
}
