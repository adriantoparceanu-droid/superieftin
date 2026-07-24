import pino from 'pino'
import { upsertProduct, upsertRetailerByDomain } from '../lib/upsert.js'
import { loadFeedRules } from '../lib/feedRules.js'
import { resolver, syncAffiliateAdvertisers } from '../lib/affiliate/index.js'
import { EmagScraper } from './emag.js'
import type { Scraper } from './types.js'

const logger = pino({ level: 'info' })

// Registry de scrapere.
export const scrapers: Scraper[] = [new EmagScraper()]

export function getScraper(name: string): Scraper | undefined {
  return scrapers.find((s) => s.name === name)
}

// Ruleaza un scraper si ingereaza produsele: verifica afilierea pe domeniu (la fiecare
// produs) si face upsert. Produsele neafiliate se salveaza la fel — vor aparea in site
// fara link de comision (comparator pur).
export async function ingestScraper(scraper: Scraper): Promise<{ imported: number; errors: number; affiliated: number }> {
  const log = logger.child({ scraper: scraper.name, domain: scraper.domain })

  const [resolveRule, retailerId] = await Promise.all([
    loadFeedRules(),
    upsertRetailerByDomain(scraper.domain, undefined, `https://${scraper.domain}`),
  ])
  // Date proaspete din API (nu doar cache-ul DB) — altfel afilierea ar folosi un hash stale.
  await syncAffiliateAdvertisers()
  await resolver.refresh()

  let imported = 0, errors = 0, affiliated = 0
  for await (const product of scraper.run()) {
    const aff = resolver.resolve(product.url)
    if (aff) {
      product.affiliateUrl = aff.affiliateUrl
      product.affiliateNetwork = aff.network
      affiliated++
    }
    const rule = resolveRule(retailerId, product.feedCategory)
    try {
      await upsertProduct(product, retailerId, rule)
      imported++
    } catch (err) {
      errors++
      if (errors <= 5) log.error({ slug: product.slug, err }, 'Eroare upsert produs scrapat')
    }
  }

  log.info({ imported, errors, affiliated }, 'Scraper ingerat')
  return { imported, errors, affiliated }
}
