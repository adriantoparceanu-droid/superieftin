import { Queue, QueueEvents } from 'bullmq'

// BullMQ accepta connection options direct (URL string) — evita conflicte de versiune ioredis
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'

export const connection = {
  url: REDIS_URL,
  maxRetriesPerRequest: null as null,
}

export const syncQueue = new Queue('sync', { connection })

export const syncQueueEvents = new QueueEvents('sync', { connection })

// Alertele pe email (workers/email.worker.ts): coada separata, ca un feed-sync lung sa nu
// intarzie emailul de confirmare. Site-ul adauga aici joburile 'confirm' si 'manage-link'.
export const emailQueue = new Queue('email', { connection })

// Curata coada veche de scraping (joburile repeating ramase in Redis de la versiunea anterioara)
export async function cleanupLegacyScrapeQueue(): Promise<void> {
  const legacy = new Queue('scrape', { connection })
  try {
    await legacy.obliterate({ force: true })
  } catch {
    // coada poate sa nu existe — ignoram
  } finally {
    await legacy.close()
  }
}
