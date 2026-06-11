import { Worker, Job } from 'bullmq'
import pino from 'pino'
import { tmpdir } from 'os'
import { join } from 'path'
import { unlink } from 'fs/promises'
import pool from '../lib/db.js'
import { connection } from '../lib/queue.js'
import { getAdvertisers, getFeeds, getProductsByPartNo, buildAffiliateUrl, type PsAdvertiser, type PsFeed } from '../lib/profitshare.js'
import { downloadFeed, parseFeedFile, mapFeedRow } from '../importers/feed.js'
import { upsertProduct, upsertOfferPrice } from '../lib/upsert.js'
import { toSlug } from '../lib/slug.js'
import { checkAndSendAlerts } from './alerts.worker.js'

const logger = pino({ level: 'info' })

export interface SyncJobData {
  type: 'feed-sync' | 'price-check'
}

// Sub acest prag (fata de sincronizarea anterioara) un feed e considerat suspect si respins.
const MIN_FEED_RATIO = 0.5
// Cate produse prioritare verificam prin API per rulare (60 cereri/min => ~3 min la 150).
const PRICE_CHECK_LIMIT = parseInt(process.env.PRICE_CHECK_LIMIT || '150')
// Ofertele nevazute in feed-uri de atatea zile se marcheaza fara stoc (istoricul ramane).
const STALE_OFFER_DAYS = 3

// --- Retaileri din advertiseri Profitshare ---------------------------------

// "eMAG.ro" -> "emag", "Karcher.com/ro/ro" -> "karcher" (pastreaza slugurile existente)
export function advertiserSlug(name: string): string {
  return toSlug(name.toLowerCase().replace(/\.(ro|com|net|eu|org|travel|shop)([/.].*)?$/i, ''))
}

async function upsertRetailer(adv: PsAdvertiser): Promise<number> {
  const slug = advertiserSlug(adv.name)
  const logo = adv.logo?.startsWith('//') ? 'https:' + adv.logo : adv.logo || null
  const config = JSON.stringify({ advertiserHash: adv.advertiser_identifier, affiliateHash: adv.affiliate_identifier })

  // Intai dupa ps_advertiser_id, apoi dupa slug (leaga retailerii istorici), apoi INSERT
  const byPsId = await pool.query<{ id: number }>(`
    UPDATE retailers SET name = $2, logo_url = $3,
      scraper_config = coalesce(scraper_config, '{}'::jsonb) || $4::jsonb
    WHERE ps_advertiser_id = $1 RETURNING id
  `, [adv.id, adv.name, logo, config])
  if (byPsId.rows[0]) return byPsId.rows[0].id

  const bySlug = await pool.query<{ id: number }>(`
    UPDATE retailers SET ps_advertiser_id = $2, name = $3, logo_url = $4,
      scraper_config = coalesce(scraper_config, '{}'::jsonb) || $5::jsonb
    WHERE slug = $1 RETURNING id
  `, [slug, adv.id, adv.name, logo, config])
  if (bySlug.rows[0]) return bySlug.rows[0].id

  const inserted = await pool.query<{ id: number }>(`
    INSERT INTO retailers (name, slug, base_url, scraper_config, is_active, ps_advertiser_id, logo_url)
    VALUES ($1, $2, $3, $4::jsonb, true, $5, $6) RETURNING id
  `, [adv.name, slug, adv.url, config, adv.id, logo])
  return inserted.rows[0].id
}

async function loadCategoryMap(): Promise<Map<string, string>> {
  const { rows } = await pool.query<{ ps_category: string; site_category: string }>(
    'SELECT ps_category, site_category FROM category_map'
  )
  return new Map(rows.map((r) => [r.ps_category, r.site_category]))
}

// --- Sincronizare feed-uri ---------------------------------------------------

async function syncOneFeed(
  feed: PsFeed,
  advertisersById: Map<string, PsAdvertiser>,
  categoryMap: Map<string, string>,
): Promise<{ imported: number; errors: number } | 'skipped' | 'rejected'> {
  const log = logger.child({ feed: feed.name, type: feed.type })

  // Descarcam doar feed-urile regenerate de la ultima sincronizare reusita
  const last = await pool.query<{ ps_updated_at: Date | null; products_count: number | null }>(`
    SELECT ps_updated_at, products_count FROM feed_syncs
    WHERE feed_link = $1 AND status = 'success'
    ORDER BY synced_at DESC LIMIT 1
  `, [feed.link])
  const lastSync = last.rows[0]
  const feedUpdatedAt = new Date(feed.updated_at.replace(' ', 'T') + 'Z')
  if (lastSync?.ps_updated_at && new Date(lastSync.ps_updated_at) >= feedUpdatedAt) {
    log.info('Feed neschimbat — sarit')
    return 'skipped'
  }

  // Retailerii pentru advertiserii din feed (creati automat daca lipsesc)
  const retailerByName = new Map<string, number>()
  for (const fa of feed.advertisers) {
    const adv = advertisersById.get(String(fa.id))
    if (!adv) { log.warn({ advertiser: fa.name }, 'Advertiser din feed lipseste din lista de advertiseri'); continue }
    const retailerId = await upsertRetailer(adv)
    retailerByName.set(adv.name.toLowerCase(), retailerId)
  }
  if (!retailerByName.size) return 'rejected'

  const tmpFile = join(tmpdir(), `ps-feed-${Date.now()}.${feed.type}`)
  try {
    log.info('Descarcare feed...')
    await downloadFeed(feed.link, tmpFile)

    // Pasul 1: numaram randurile valide — nu atingem DB-ul daca feed-ul pare trunchiat
    let validCount = 0
    for await (const row of parseFeedFile(tmpFile, feed.type)) {
      if (mapFeedRow(row, categoryMap)) validCount++
    }
    if (lastSync?.products_count && validCount < lastSync.products_count * MIN_FEED_RATIO) {
      log.error({ validCount, previous: lastSync.products_count }, 'Feed suspect (sub 50% din sincronizarea anterioara) — respins')
      await pool.query(`
        INSERT INTO feed_syncs (feed_link, feed_name, ps_updated_at, products_count, status)
        VALUES ($1, $2, $3, $4, 'rejected')
      `, [feed.link, feed.name, feedUpdatedAt, validCount])
      return 'rejected'
    }

    // Pasul 2: import efectiv
    let imported = 0, errors = 0
    for await (const row of parseFeedFile(tmpFile, feed.type)) {
      const product = mapFeedRow(row, categoryMap)
      if (!product) continue
      const retailerId = retailerByName.get(row.advertiserName.toLowerCase())
        ?? retailerByName.values().next().value
      try {
        await upsertProduct(product, retailerId!)
        imported++
      } catch (err) {
        errors++
        if (errors <= 5) log.error({ slug: product.slug, err }, 'Eroare upsert produs')
      }
    }

    // Ofertele disparute din feed de mai multe zile raman in DB, dar fara stoc
    for (const retailerId of retailerByName.values()) {
      await pool.query(`
        UPDATE offers SET in_stock = false
        WHERE retailer_id = $1 AND in_stock = true
          AND last_checked < now() - make_interval(days => $2)
      `, [retailerId, STALE_OFFER_DAYS])
    }

    await pool.query(`
      INSERT INTO feed_syncs (feed_link, feed_name, ps_updated_at, products_count, status)
      VALUES ($1, $2, $3, $4, 'success')
    `, [feed.link, feed.name, feedUpdatedAt, imported])

    log.info({ imported, errors }, 'Feed importat')
    return { imported, errors }
  } finally {
    await unlink(tmpFile).catch(() => {})
  }
}

export async function runFeedSync(jobId = 'direct') {
  const log = logger.child({ job: jobId, task: 'feed-sync' })
  const startTime = Date.now()

  const [advertisers, feeds, categoryMap] = await Promise.all([
    getAdvertisers(),
    getFeeds(),
    loadCategoryMap(),
  ])
  const advertisersById = new Map(advertisers.map((a) => [String(a.id), a]))
  const activeFeeds = feeds.filter((f) => f.status === 'active')
  log.info({ feeds: activeFeeds.length, advertisers: advertisers.length }, 'Sincronizare feed-uri pornita')

  let totalImported = 0, totalErrors = 0, synced = 0
  for (const feed of activeFeeds) {
    try {
      const result = await syncOneFeed(feed, advertisersById, categoryMap)
      if (typeof result === 'object') {
        totalImported += result.imported
        totalErrors += result.errors
        synced++
      }
    } catch (err) {
      totalErrors++
      log.error({ feed: feed.name, err }, 'Eroare sincronizare feed')
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1)
  log.info({ synced, totalImported, totalErrors, duration: `${duration}s` }, 'Sincronizare feed-uri finalizata')
  return { synced, imported: totalImported, errors: totalErrors, duration }
}

// --- Verificare rapida de pret prin API (filters[part_no]) -------------------

export async function runPriceCheck(jobId = 'direct') {
  const log = logger.child({ job: jobId, task: 'price-check' })
  const startTime = Date.now()

  // Produse prioritare: cu alerte active sau accesate recent, care au cod de produs
  const candidates = await pool.query<{ id: string; part_no: string; brand: string | null; slug: string }>(`
    SELECT DISTINCT p.id, p.part_no, p.brand, p.slug
    FROM products p
    WHERE p.part_no IS NOT NULL AND (
      EXISTS (
        SELECT 1 FROM price_alerts pa JOIN offers o ON o.id = pa.offer_id
        WHERE o.product_id = p.id AND pa.is_active = true AND pa.triggered_at IS NULL
      )
      OR EXISTS (
        SELECT 1 FROM click_events ce JOIN offers o2 ON o2.id = ce.offer_id
        WHERE o2.product_id = p.id AND ce.clicked_at > now() - interval '7 days'
      )
    )
    LIMIT $1
  `, [PRICE_CHECK_LIMIT])

  log.info({ candidates: candidates.rows.length }, 'Verificare preturi pornita')

  const retailers = await pool.query<{ id: number; ps_advertiser_id: number; scraper_config: any }>(`
    SELECT id, ps_advertiser_id, scraper_config FROM retailers WHERE ps_advertiser_id IS NOT NULL
  `)
  const retailerByAdvId = new Map(retailers.rows.map((r) => [r.ps_advertiser_id, r]))

  let updated = 0, errors = 0
  for (const candidate of candidates.rows) {
    try {
      const { products } = await getProductsByPartNo(candidate.part_no)
      for (const psProduct of products) {
        const retailer = retailerByAdvId.get(psProduct.advertiser_id)
        if (!retailer || !psProduct.price_vat) continue

        // Oferte noi doar daca brandul produsului apare in numele din API —
        // SKU-urile interne ale advertiserilor pot coincide pentru produse diferite
        const existing = await pool.query(`
          SELECT 1 FROM offers WHERE product_id = $1 AND retailer_id = $2
        `, [candidate.id, retailer.id])
        if (!existing.rows.length) {
          const brandOk = candidate.brand && psProduct.name.toLowerCase().includes(candidate.brand.toLowerCase())
          if (!brandOk) continue
        }

        const cfg = retailer.scraper_config || {}
        const affiliateUrl = cfg.advertiserHash && cfg.affiliateHash
          ? buildAffiliateUrl(psProduct.link, cfg.affiliateHash, cfg.advertiserHash)
          : psProduct.link
        await upsertOfferPrice(candidate.id, retailer.id, psProduct.price_vat, psProduct.link, affiliateUrl)
        updated++
      }
    } catch (err) {
      errors++
      if (errors <= 5) log.error({ partNo: candidate.part_no, err }, 'Eroare verificare pret')
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1)
  log.info({ checked: candidates.rows.length, updated, errors, duration: `${duration}s` }, 'Verificare preturi finalizata')
  return { checked: candidates.rows.length, updated, errors, duration }
}

// --- Worker BullMQ ------------------------------------------------------------

async function invalidateSiteCache() {
  const siteUrl = process.env.SITE_URL
  const secret = process.env.REVALIDATE_SECRET
  if (!siteUrl || !secret) return
  const res = await fetch(`${siteUrl}/api/revalidate`, {
    method: 'POST',
    headers: { 'x-revalidate-secret': secret },
  })
  if (res.ok) logger.info('Cache site invalidat')
  else logger.warn({ status: res.status }, 'Cache invalidation esuat')
}

export function startSyncWorker() {
  const worker = new Worker<SyncJobData>(
    'sync',
    async (job: Job<SyncJobData>) =>
      job.data.type === 'price-check' ? runPriceCheck(job.id) : runFeedSync(job.id),
    {
      connection,
      concurrency: 1,
      settings: { backoffStrategy: (attempt) => Math.min(attempt * 5000, 60000) },
    }
  )

  worker.on('failed', (job, err) => {
    logger.error({ job: job?.id, err }, 'Job esuat')
  })

  worker.on('completed', (job, result) => {
    logger.info({ job: job.id, ...result }, 'Job completat')
    checkAndSendAlerts().catch((err) => logger.error({ err }, 'Eroare verificare alerte'))
    invalidateSiteCache().catch((err) => logger.warn({ err }, 'Cache invalidation esuat'))
  })

  return worker
}
