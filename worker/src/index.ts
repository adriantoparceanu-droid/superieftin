import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '../../.env'), override: true })

import pino from 'pino'
import { syncQueue, cleanupLegacyScrapeQueue } from './lib/queue.js'
import { startSyncWorker } from './workers/sync.worker.js'
import { startBotWorker } from './workers/bot.worker.js'
import pool from './lib/db.js'

const logger = pino({ level: 'info' })

// Feed-urile Profitshare se regenereaza in jurul orei 03:00 — sincronizam dupa.
// Snapshot-ul de istoric ruleaza la finalul feed-sync-ului (preturi proaspete, fara resync).
const FEED_SYNC_CRON = process.env.FEED_SYNC_CRON || '0 4 * * *'
const PRICE_CHECK_INTERVAL_HOURS = parseFloat(process.env.PRICE_CHECK_INTERVAL_HOURS || '3')
// Dupa feed-sync (04:00) — completeaza imaginile produselor noi de la CDN-uri blocate (Cloudflare).
const IMAGE_BACKFILL_CRON = process.env.IMAGE_BACKFILL_CRON || '30 5 * * *'
// Inainte de feed-sync, ca sa nu se suprapuna (scraping conservator, poate dura zeci de minute).
const EMAG_SCRAPE_CRON = process.env.EMAG_SCRAPE_CRON || '0 2 * * *'
// Comisioane Profitshare → Google Ads, dupa feed-sync (04:00) si backfill (05:30). Implicit
// DOAR validate_only — vezi runTrackingSyncJob in tracking/sync.ts.
const TRACKING_SYNC_CRON = process.env.TRACKING_SYNC_CRON || '30 6 * * *'
// Garda reclamelor: dupa feed-sync (04:00), snapshot/mediana si price-check — verifica landing-urile
// grupurilor active si pune pe pauza ce nu mai corespunde. Pauza e reala doar cu ADS_ENV=prod sau
// ADS_GUARD_REAL_PAUSE=1; altfel doar alerteaza pe Telegram. Vezi ads/campaigns/guard.ts.
const ADS_GUARD_CRON = process.env.ADS_GUARD_CRON || '0 7 * * *'

async function scheduleRepeatingJobs() {
  await syncQueue.add(
    'feed-sync',
    { type: 'feed-sync' },
    { repeat: { pattern: FEED_SYNC_CRON }, jobId: 'feed-sync-repeat' }
  )
  logger.info({ cron: FEED_SYNC_CRON }, 'Job repeating programat: feed-sync')

  await syncQueue.add(
    'price-check',
    { type: 'price-check' },
    { repeat: { every: PRICE_CHECK_INTERVAL_HOURS * 3600 * 1000 }, jobId: 'price-check-repeat' }
  )
  logger.info({ interval: `${PRICE_CHECK_INTERVAL_HOURS}h` }, 'Job repeating programat: price-check')

  await syncQueue.add(
    'image-backfill',
    { type: 'image-backfill' },
    { repeat: { pattern: IMAGE_BACKFILL_CRON }, jobId: 'image-backfill-repeat' }
  )
  logger.info({ cron: IMAGE_BACKFILL_CRON }, 'Job repeating programat: image-backfill')

  await syncQueue.add(
    'emag-scrape',
    { type: 'scrape', scraperName: 'emag' },
    { repeat: { pattern: EMAG_SCRAPE_CRON }, jobId: 'emag-scrape-repeat' }
  )
  logger.info({ cron: EMAG_SCRAPE_CRON }, 'Job repeating programat: emag-scrape')

  await syncQueue.add(
    'tracking-sync',
    { type: 'tracking-sync' },
    { repeat: { pattern: TRACKING_SYNC_CRON }, jobId: 'tracking-sync-repeat' }
  )
  logger.info({ cron: TRACKING_SYNC_CRON }, 'Job repeating programat: tracking-sync')

  await syncQueue.add(
    'ads-guard',
    { type: 'ads-guard' },
    { repeat: { pattern: ADS_GUARD_CRON }, jobId: 'ads-guard-repeat' }
  )
  logger.info({ cron: ADS_GUARD_CRON }, 'Job repeating programat: ads-guard')
}

async function invalidateCache() {
  const siteUrl = process.env.SITE_URL
  const secret = process.env.REVALIDATE_SECRET
  if (!siteUrl || !secret) return
  try {
    const res = await fetch(`${siteUrl}/api/revalidate`, {
      method: 'POST',
      headers: { 'x-revalidate-secret': secret },
      signal: AbortSignal.timeout(30000),  // altfel un site nereactiv blocheaza process.exit
    })
    if (res.ok) logger.info('Cache site invalidat')
    else logger.warn({ status: res.status }, 'Cache invalidation esuat')
  } catch (err) {
    logger.warn({ err }, 'Nu s-a putut contacta site-ul pentru invalidare cache')
  }
}

// Rulare manuala imediata: npm run sync:now [-- --price-check | --file=/cale/feed.xml [--retailer=slug]]
async function syncNow() {
  let exitCode = 0
  const { runFeedSync, runPriceCheck, runPriceSnapshot, runFileImport, runImageBackfill, runScrape, runCatalogRefresh } = await import('./workers/sync.worker.js')
  const fileArg = process.argv.find((a) => a.startsWith('--file='))?.split('=')[1]
  if (fileArg) {
    const retailerSlug = process.argv.find((a) => a.startsWith('--retailer='))?.split('=')[1]
    const result = await runFileImport(fileArg, retailerSlug)
    logger.info(result, 'import din fisier finalizat')
  } else if (process.argv.includes('--scrape-emag')) {
    const result = await runScrape('emag')
    logger.info(result, 'scraping emag finalizat')
    // 0 produse salvate = scanare esuata (WAF, browser lipsa, eroare DB). Codul de iesire
    // nenul opreste emag-scrape-sync.sh inainte sa urce date vechi pe productie.
    if (result.imported === 0) {
      logger.error(result, 'EROARE: 0 produse eMAG salvate — scanarea a esuat')
      exitCode = 2
    }
  } else if (process.argv.includes('--catalog')) {
    const result = await runCatalogRefresh()
    logger.info(result, 'catalog categorii finalizat')
  } else if (process.argv.includes('--price-check')) {
    const result = await runPriceCheck()
    logger.info(result, 'price-check finalizat')
  } else if (process.argv.includes('--image-backfill')) {
    const result = await runImageBackfill()
    logger.info(result, 'backfill imagini finalizat')
  } else if (process.argv.includes('--snapshot')) {
    const result = await runPriceSnapshot()
    logger.info(result, 'snapshot preturi finalizat')
  } else {
    const result = await runFeedSync()
    logger.info(result, 'feed-sync finalizat')
  }
  const { checkAndSendAlerts } = await import('./workers/alerts.worker.js')
  await checkAndSendAlerts().catch((err) => logger.error({ err }, 'Eroare verificare alerte'))
  await invalidateCache()
  await pool.end()
  process.exit(exitCode)
}

async function main() {
  logger.info('Worker pornit')

  await cleanupLegacyScrapeQueue()

  if (process.argv.includes('--now')) {
    await syncNow()
  } else {
    startSyncWorker()
    startBotWorker() // ruleaza in background — loop infinit non-blocking
    await scheduleRepeatingJobs()
  }
}

main().catch((err) => {
  logger.error(err, 'Eroare fatala la pornire worker')
  process.exit(1)
})
