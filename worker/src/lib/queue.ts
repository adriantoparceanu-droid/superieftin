import { Queue, QueueEvents } from 'bullmq'

// BullMQ accepta connection options direct (URL string) — evita conflicte de versiune ioredis
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'

export const connection = {
  url: REDIS_URL,
  maxRetriesPerRequest: null as null,
}

export const scrapeQueue = new Queue('scrape', { connection })

export const scrapeQueueEvents = new QueueEvents('scrape', { connection })
