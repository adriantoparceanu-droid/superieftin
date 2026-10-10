import { getAdvertisers, buildAffiliateUrl, advertiserCommission, activeAdvertiserIds, type PsAdvertiser } from '../profitshare.js'
import { extractDomain } from './domain.js'
import type { AffiliateProvider, AffiliateAdvertiser } from './types.js'

// De cate ori citim lista de advertiseri ca sa stabilim statusul (vezi activeAdvertiserIds).
// O data pe zi + inaintea scanarilor → cateva cereri in plus, mult sub limita de 60/minut.
const STATUS_READS = 3

// Provider Profitshare — impacheteaza clientul API existent (lib/profitshare.ts).
export class ProfitshareProvider implements AffiliateProvider {
  readonly network = 'profitshare'

  async syncAdvertisers(): Promise<AffiliateAdvertiser[]> {
    // Primul apel e obligatoriu (daca pica, sincronizarea esueaza ca inainte); celelalte doar
    // confirma statusul — o eroare la ele nu strica nimic, folosim ce am citit deja.
    const advertisers = await getAdvertisers()
    const reads: PsAdvertiser[][] = [advertisers]
    for (let i = 1; i < STATUS_READS; i++) {
      try { reads.push(await getAdvertisers()) } catch { /* ramanem la citirile reusite */ }
    }
    const active = activeAdvertiserIds(reads)
    return advertisers.map((adv) => ({
      network: this.network,
      externalId: String(adv.id),
      name: adv.name,
      domain: extractDomain(adv.url),
      advertiserHash: adv.advertiser_identifier || null,
      affiliateHash: adv.affiliate_identifier || null,
      commission: advertiserCommission(adv),
      status: active.has(String(adv.id)) ? 'active' : 'inactive',
    }))
  }

  buildLink(productUrl: string, adv: AffiliateAdvertiser): string {
    if (!adv.advertiserHash || !adv.affiliateHash) {
      throw new Error(`Profitshare: hash-uri lipsa pentru advertiserul ${adv.externalId}`)
    }
    return buildAffiliateUrl(productUrl, adv.affiliateHash, adv.advertiserHash)
  }
}
