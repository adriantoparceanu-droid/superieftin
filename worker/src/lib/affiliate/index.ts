import pino from 'pino'
import pool from '../db.js'
import { AffiliateResolver } from './resolver.js'
import { ProfitshareProvider } from './profitshare.provider.js'
import { TwoPerformantProvider } from './twoperformant.provider.js'
import type { AffiliateProvider } from './types.js'

const logger = pino({ level: 'info' })

// Providerele active. 2Performant e inregistrat dar inert pana implementam syncAdvertisers.
const providers: AffiliateProvider[] = [
  new ProfitshareProvider(),
  new TwoPerformantProvider(),
]

const priority = (process.env.AFFILIATE_NETWORK_PRIORITY || 'profitshare,2performant')
  .split(',').map((s) => s.trim()).filter(Boolean)

// Singleton folosit de toate caile de ingest (feed, price-check, scrapere).
export const resolver = new AffiliateResolver(providers, priority)

export { AffiliateResolver } from './resolver.js'
export { extractDomain } from './domain.js'
export { chooseAffiliate } from './keep-link.js'
export type { AffiliateAdvertiser, ResolvedAffiliate, AffiliateProvider } from './types.js'

// Sincronizeaza advertiserii din toate retelele in affiliate_advertisers (harta domeniu->advertiser).
// Apelat inaintea ingestului ca rezolutia sa foloseasca date proaspete.
export async function syncAffiliateAdvertisers(): Promise<{ upserted: number; perNetwork: Record<string, number> }> {
  let upserted = 0
  const perNetwork: Record<string, number> = {}

  for (const provider of providers) {
    let advertisers
    try {
      advertisers = await provider.syncAdvertisers()
    } catch (err) {
      logger.error({ network: provider.network, err }, 'Sincronizare advertiseri esuata')
      continue
    }
    perNetwork[provider.network] = advertisers.length
    for (const adv of advertisers) {
      await pool.query(`
        INSERT INTO affiliate_advertisers
          (network, external_id, name, domain, advertiser_hash, affiliate_hash, commission, status, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
        ON CONFLICT (network, external_id) DO UPDATE SET
          name = EXCLUDED.name,
          domain = EXCLUDED.domain,
          advertiser_hash = EXCLUDED.advertiser_hash,
          affiliate_hash = EXCLUDED.affiliate_hash,
          commission = EXCLUDED.commission,
          status = EXCLUDED.status,
          updated_at = now()
      `, [adv.network, adv.externalId, adv.name, adv.domain, adv.advertiserHash,
          adv.affiliateHash, adv.commission, adv.status])
      upserted++
    }
  }

  logger.info({ upserted, perNetwork }, 'Advertiseri afiliati sincronizati')
  return { upserted, perNetwork }
}
