import { getAdvertisers, buildAffiliateUrl, advertiserCommission, advertiserStatus } from '../profitshare.js'
import { extractDomain } from './domain.js'
import type { AffiliateProvider, AffiliateAdvertiser } from './types.js'

// Provider Profitshare — impacheteaza clientul API existent (lib/profitshare.ts).
export class ProfitshareProvider implements AffiliateProvider {
  readonly network = 'profitshare'

  async syncAdvertisers(): Promise<AffiliateAdvertiser[]> {
    const advertisers = await getAdvertisers()
    return advertisers.map((adv) => ({
      network: this.network,
      externalId: String(adv.id),
      name: adv.name,
      domain: extractDomain(adv.url),
      advertiserHash: adv.advertiser_identifier || null,
      affiliateHash: adv.affiliate_identifier || null,
      commission: advertiserCommission(adv),
      status: advertiserStatus(adv),
    }))
  }

  buildLink(productUrl: string, adv: AffiliateAdvertiser): string {
    if (!adv.advertiserHash || !adv.affiliateHash) {
      throw new Error(`Profitshare: hash-uri lipsa pentru advertiserul ${adv.externalId}`)
    }
    return buildAffiliateUrl(productUrl, adv.affiliateHash, adv.advertiserHash)
  }
}
