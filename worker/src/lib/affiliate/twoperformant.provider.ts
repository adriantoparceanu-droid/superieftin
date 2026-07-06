import { getAcceptedPrograms, programCommission, buildQuicklink } from '../twoperformant.js'
import { extractDomain } from './domain.js'
import type { AffiliateProvider, AffiliateAdvertiser } from './types.js'

// Provider 2Performant — impacheteaza clientul API (lib/twoperformant.ts).
// advertiserHash = unique_code-ul programului (param 'unique'); affiliateHash = codul de
// marketer (param 'aff_code', din TWOPERFORMANT_AFF_CODE).
export class TwoPerformantProvider implements AffiliateProvider {
  readonly network = '2performant'

  async syncAdvertisers(): Promise<AffiliateAdvertiser[]> {
    const affCode = process.env.TWOPERFORMANT_AFF_CODE
    if (!process.env.TWOPERFORMANT_EMAIL || !process.env.TWOPERFORMANT_PASSWORD || !affCode) {
      return [] // necredentializat — inert, nu rupe sincronizarea celorlalte retele
    }
    const programs = await getAcceptedPrograms()
    return programs.map((p) => ({
      network: this.network,
      externalId: String(p.id),
      name: p.name.trim(),
      domain: extractDomain(p.base_url || p.main_url),
      advertiserHash: p.unique_code || null,
      affiliateHash: affCode,
      commission: programCommission(p),
      status: p.affrequest?.status === 'accepted' ? 'active' : 'inactive',
    }))
  }

  buildLink(productUrl: string, adv: AffiliateAdvertiser): string {
    if (!adv.advertiserHash || !adv.affiliateHash) {
      throw new Error(`2Performant: cod lipsa pentru advertiserul ${adv.externalId}`)
    }
    return buildQuicklink(productUrl, adv.advertiserHash, adv.affiliateHash)
  }
}
