import pino from 'pino'
import pool from '../lib/db.js'
import { ensurePriceHistoryPartitions } from '../lib/partitions.js'
import { upsertProduct, upsertRetailerByDomain } from '../lib/upsert.js'
import { loadFeedRules, IGNORE } from '../lib/feedRules.js'
import { resolver, syncAffiliateAdvertisers } from '../lib/affiliate/index.js'
import { findLinkConfig, buildDeepLink, type LinkConfigResult } from '../lib/affiliate/profitshare-deeplink.js'
import { EmagScraper } from './emag.js'
import type { Scraper } from './types.js'

const logger = pino({ level: 'info' })

// Scanarea acopera doar cateva pagini/categorie, nu tot catalogul — deci ofertele
// nevazute nu mai sunt "reconfirmate" ca la feed-uri. Le imbatranim in doua trepte:
// dupa STALE_DAYS fara stoc (ca la feed-sync), dupa TTL_DAYS le stergem (altfel se
// acumuleaza oferte moarte cu pret/stoc inghetat).
const STALE_DAYS = 3
const OFFER_TTL_DAYS = parseInt(process.env.SCRAPER_OFFER_TTL_DAYS || '30')

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

  // Partitia lunii curente trebuie sa existe inainte de primul upsert (vezi lib/partitions.ts)
  await ensurePriceHistoryPartitions()

  const [resolveRule, retailerId] = await Promise.all([
    loadFeedRules(),
    upsertRetailerByDomain(scraper.domain, undefined, `https://${scraper.domain}`),
  ])
  // Date proaspete din API (nu doar cache-ul DB) — altfel afilierea ar folosi un hash stale.
  await syncAffiliateAdvertisers()
  await resolver.refresh()

  // Rezerva Profitshare (deep link lps) pentru produsele pe care rezolverul nu le afiliaza.
  // Rezolverul citeste statusul salvat dintr-UN singur apel API, iar statusul variaza intre
  // serverele Profitshare (vezi profitshare-deeplink.ts) → la 1 oct eMAG a iesit „inactiv” si
  // toate ofertele scanate au primit affiliate_url NULL (si la update, peste linkurile bune).
  // Configurarea se cauta o singura data, la primul produs neafiliat.
  let psFallback: LinkConfigResult | undefined
  let unaffiliated = 0, linkErrors = 0

  let imported = 0, errors = 0, affiliated = 0
  for await (const product of scraper.run()) {
    const aff = resolver.resolve(product.url)
    if (aff) {
      product.affiliateUrl = aff.affiliateUrl
      product.affiliateNetwork = aff.network
      affiliated++
    } else {
      if (!psFallback) {
        psFallback = await findLinkConfig(scraper.domain)
        if (psFallback.config) {
          log.warn({ advertiser: psFallback.config.advertiserName, attempts: psFallback.attempts },
            'Rezolverul nu a afiliat produsul; folosesc linkul Profitshare din API (status instabil intre servere)')
        } else {
          log.error({ reason: psFallback.reason, attempts: psFallback.attempts },
            `NU pot construi linkul Profitshare pentru ${scraper.domain} — ofertele raman FARA afiliere (fara comision)`)
        }
      }
      if (psFallback.config) {
        try {
          product.affiliateUrl = buildDeepLink(product.url, psFallback.config, scraper.domain)
          product.affiliateNetwork = 'profitshare'
          affiliated++
        } catch (err) {
          linkErrors++
          if (linkErrors <= 5) log.error({ url: product.url, err: (err as Error).message }, 'Link Profitshare imposibil pentru produs')
        }
      }
      if (!product.affiliateUrl) unaffiliated++
    }
    const rule = resolveRule(retailerId, product.feedCategory, product.name)
      if (rule === IGNORE) continue   // regula „ignoră” din Admin → Mapare
    try {
      await upsertProduct(product, retailerId, rule)
      imported++
    } catch (err) {
      errors++
      if (errors <= 5) log.error({ slug: product.slug, err }, 'Eroare upsert produs scrapat')
    }
  }

  // Pruning DOAR daca scanarea a adus produse — altfel un blocaj (WAF, 0 importate) ar
  // marca/sterge gresit toate ofertele bune.
  let hidden = 0, deleted = 0
  if (imported > 0) {
    const h = await pool.query(
      `UPDATE offers SET in_stock = false
       WHERE retailer_id = $1 AND in_stock = true AND last_checked < now() - make_interval(days => $2)`,
      [retailerId, STALE_DAYS],
    )
    hidden = h.rowCount ?? 0
    const d = await pool.query(
      `DELETE FROM offers WHERE retailer_id = $1 AND last_checked < now() - make_interval(days => $2)`,
      [retailerId, OFFER_TTL_DAYS],
    )
    deleted = d.rowCount ?? 0
  }

  if (unaffiliated > 0) log.warn({ unaffiliated }, 'Produse ramase FARA link afiliat (vezi erorile de mai sus)')
  log.info({ imported, errors, affiliated, unaffiliated, hidden, deleted }, 'Scraper ingerat')
  return { imported, errors, affiliated }
}
