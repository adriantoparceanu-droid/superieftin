import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '../../.env'), override: true })

import pino from 'pino'
import { scrapeQueue, scrapeQueueEvents } from './lib/queue.js'
import { startScrapeWorker } from './workers/scrape.worker.js'
import pool from './lib/db.js'

const logger = pino({ level: 'info' })
const SCRAPE_INTERVAL_HOURS = parseFloat(process.env.SCRAPE_INTERVAL_HOURS || '8')

async function getActiveRetailer(slug: string) {
  const result = await pool.query(
    'SELECT id, slug, scraper_config FROM retailers WHERE slug = $1 AND is_active = true',
    [slug]
  )
  return result.rows[0]
}

async function scheduleRepeatingJobs() {
  const retailer = await getActiveRetailer('emag')
  if (!retailer) {
    logger.warn('Retailer emag nu este activ in DB')
    return
  }

  // Job repeating — ruleaza la fiecare N ore
  await scrapeQueue.add(
    'emag-telefoane-mobile',
    {
      retailerId: retailer.id,
      retailerSlug: retailer.slug,
      categoryPath: 'telefoane-mobile',
      maxPages: 10,
    },
    {
      repeat: { every: SCRAPE_INTERVAL_HOURS * 3600 * 1000 },
      jobId: 'emag-telefoane-mobile-repeat',
    }
  )

  logger.info({ interval: `${SCRAPE_INTERVAL_HOURS}h` }, 'Job repeating programat: emag-telefoane-mobile')
}

async function scrapeNow() {
  const retailer = await getActiveRetailer('emag')
  if (!retailer) {
    logger.error('Retailer emag nu exista sau nu e activ')
    process.exit(1)
  }

  // Rulam direct, fara coada BullMQ, pentru a evita probleme de timing
  const { runScrapeJob } = await import('./workers/scrape.worker.js')
  logger.info('Scraping manual pornit (direct)...')
  const result = await runScrapeJob({
    retailerId: retailer.id,
    retailerSlug: retailer.slug,
    categoryPath: 'telefoane-mobile',
    maxPages: 10,
  })
  logger.info(result, 'Scraping finalizat')
  await pool.end()
  process.exit(0)
}

async function main() {
  logger.info('Worker pornit')

  startScrapeWorker()

  if (process.argv.includes('--now')) {
    await scrapeNow()
  } else {
    await scheduleRepeatingJobs()
  }
}

main().catch((err) => {
  logger.error(err, 'Eroare fatala la pornire worker')
  process.exit(1)
})
