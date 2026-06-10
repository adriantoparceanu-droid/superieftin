import { Queue, QueueEvents } from 'bullmq'
import IORedis from 'ioredis'

export const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
})

export const scrapeQueue = new Queue('scrape', { connection })

export const scrapeQueueEvents = new QueueEvents('scrape', { connection })
