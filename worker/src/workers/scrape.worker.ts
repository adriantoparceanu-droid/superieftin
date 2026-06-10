import { Worker, Job } from 'bullmq'
import pino from 'pino'
import pool from '../lib/db.js'
import { connection } from '../lib/queue.js'
import { scrapeEmagCategory, ScrapedProduct } from '../scrapers/emag.js'

const logger = pino({ level: 'info' })

export interface ScrapeJobData {
  retailerId: number
  retailerSlug: string
  categoryPath: string
  maxPages?: number
}

async function upsertProduct(product: ScrapedProduct, retailerId: number): Promise<void> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Upsert produs canonic
    const productResult = await client.query<{ id: bigint }>(`
      INSERT INTO products (name, slug, category, brand, image_url, updated_at)
      VALUES ($1, $2, $3, $4, $5, now())
      ON CONFLICT (slug) DO UPDATE SET
        name = EXCLUDED.name,
        brand = COALESCE(EXCLUDED.brand, products.brand),
        image_url = COALESCE(EXCLUDED.image_url, products.image_url),
        updated_at = now()
      RETURNING id
    `, [product.name, product.slug, product.category, product.brand, product.imageUrl])

    const productId = productResult.rows[0].id

    // Upsert oferta curenta
    const offerResult = await client.query<{ id: bigint; current_price: string | null }>(`
      INSERT INTO offers (product_id, retailer_id, url, affiliate_url, current_price, in_stock, last_checked)
      VALUES ($1, $2, $3, $4, $5, $6, now())
      ON CONFLICT (product_id, retailer_id) DO UPDATE SET
        url = EXCLUDED.url,
        affiliate_url = EXCLUDED.affiliate_url,
        current_price = EXCLUDED.current_price,
        in_stock = EXCLUDED.in_stock,
        last_checked = now()
      RETURNING id, current_price
    `, [productId, retailerId, product.url, product.affiliateUrl, product.price, product.inStock])

    const offerId = offerResult.rows[0].id
    const prevPrice = offerResult.rows[0].current_price
      ? parseFloat(offerResult.rows[0].current_price)
      : null

    // Scrie in price_history doar la schimbare de pret sau o data pe zi
    const priceChanged = product.price !== null && product.price !== prevPrice
    const lastHistory = await client.query<{ recorded_at: Date }>(`
      SELECT recorded_at FROM price_history
      WHERE offer_id = $1
      ORDER BY recorded_at DESC LIMIT 1
    `, [offerId])

    const lastRecorded = lastHistory.rows[0]?.recorded_at
    const hoursSinceLast = lastRecorded
      ? (Date.now() - new Date(lastRecorded).getTime()) / 3600000
      : Infinity

    if (priceChanged || hoursSinceLast >= 24) {
      await client.query(`
        INSERT INTO price_history (offer_id, price, in_stock, recorded_at)
        VALUES ($1, $2, $3, now())
        ON CONFLICT DO NOTHING
      `, [offerId, product.price, product.inStock])
    }

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

export async function runScrapeJob(data: ScrapeJobData, jobId = 'direct') {
  const { retailerId, retailerSlug, categoryPath, maxPages = 5 } = data
  const log = logger.child({ job: jobId, retailer: retailerSlug, category: categoryPath })

  log.info('Scraping inceput')
  const startTime = Date.now()
  let processed = 0, updated = 0, errors = 0

  const products = await scrapeEmagCategory(categoryPath, maxPages)
  log.info({ found: products.length }, 'Produse gasite')

  for (const product of products) {
    try {
      await upsertProduct(product, retailerId)
      processed++
      if (product.price !== null) updated++
    } catch (err) {
      errors++
      log.error({ slug: product.slug, err }, 'Eroare upsert produs')
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1)
  const errorRate = products.length ? errors / products.length : 0
  log.info({ processed, updated, errors, duration: `${duration}s`, errorRate }, 'Scraping finalizat')
  if (errorRate > 0.5) log.error({ errorRate }, 'RATE DE ERORI DEPASIT 50%')
  return { processed, updated, errors, duration }
}

export function startScrapeWorker() {
  const worker = new Worker<ScrapeJobData>(
    'scrape',
    async (job: Job<ScrapeJobData>) => runScrapeJob(job.data, job.id),
    {
      connection,
      concurrency: 1,
      // Retry cu backoff exponential
      settings: { backoffStrategy: (attempt) => Math.min(attempt * 5000, 60000) },
    }
  )

  worker.on('failed', (job, err) => {
    logger.error({ job: job?.id, err }, 'Job esuat')
  })

  worker.on('completed', (job, result) => {
    logger.info({ job: job.id, ...result }, 'Job completat')
  })

  return worker
}
