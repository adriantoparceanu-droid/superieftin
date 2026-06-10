import { readFileSync, readdirSync } from 'fs'
import { join, dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import pino from 'pino'
import pool from './lib/db.js'

const logger = pino({ level: 'info' })
const __dirname = dirname(fileURLToPath(import.meta.url))
const MIGRATIONS_DIR = resolve(__dirname, '../../db/migrations')

async function runMigrations() {
  logger.info({ dir: MIGRATIONS_DIR }, 'Rulare migratii...')
  const client = await pool.connect()

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)

    const files = readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort()

    for (const file of files) {
      const version = file.replace('.sql', '')
      const { rows } = await client.query(
        'SELECT version FROM schema_migrations WHERE version = $1',
        [version]
      )
      if (rows.length > 0) {
        logger.info(`Skip (aplicata deja): ${file}`)
        continue
      }

      logger.info(`Aplicare: ${file}`)
      const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8')
      await client.query('BEGIN')
      await client.query(sql)
      await client.query(
        'INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT DO NOTHING',
        [version]
      )
      await client.query('COMMIT')
      logger.info(`Done: ${file}`)
    }

    logger.info('Toate migratiile aplicate cu succes.')
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    logger.error(err, 'Eroare la migratie')
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

runMigrations()
