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
const FEED_SYNC_CRON = process.env.FEED_SYNC_CRON || '0 4 * * *'
const PRICE_CHECK_INTERVAL_HOURS = parseFloat(process.env.PRICE_CHECK_INTERVAL_HOURS || '3')

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
}

async function invalidateCache() {
  const siteUrl = process.env.SITE_URL
  const secret = process.env.REVALIDATE_SECRET
  if (!siteUrl || !secret) return
  try {
    const res = await fetch(`${siteUrl}/api/revalidate`, {
      method: 'POST',
      headers: { 'x-revalidate-secret': secret },
    })
    if (res.ok) logger.info('Cache site invalidat')
    else logger.warn({ status: res.status }, 'Cache invalidation esuat')
  } catch (err) {
    logger.warn({ err }, 'Nu s-a putut contacta site-ul pentru invalidare cache')
  }
}

// Rulare manuala imediata: npm run sync:now [-- --price-check | --file=/cale/feed.xml [--retailer=slug]]
async function syncNow() {
  const { runFeedSync, runPriceCheck, runFileImport } = await import('./workers/sync.worker.js')
  const fileArg = process.argv.find((a) => a.startsWith('--file='))?.split('=')[1]
  if (fileArg) {
    const retailerSlug = process.argv.find((a) => a.startsWith('--retailer='))?.split('=')[1]
    const result = await runFileImport(fileArg, retailerSlug)
    logger.info(result, 'import din fisier finalizat')
  } else if (process.argv.includes('--price-check')) {
    const result = await runPriceCheck()
    logger.info(result, 'price-check finalizat')
  } else {
    const result = await runFeedSync()
    logger.info(result, 'feed-sync finalizat')
  }
  const { checkAndSendAlerts } = await import('./workers/alerts.worker.js')
  await checkAndSendAlerts().catch((err) => logger.error({ err }, 'Eroare verificare alerte'))
  await invalidateCache()
  await pool.end()
  process.exit(0)
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
