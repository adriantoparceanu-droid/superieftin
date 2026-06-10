import { readFileSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'
import { config } from 'dotenv'

config({ path: join(dirname(fileURLToPath(import.meta.url)), '../.env') })

const { Pool } = pg
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

async function migrate() {
  const client = await pool.connect()
  try {
    // Creeaza tabela de tracking daca nu exista
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)

    const migrationsDir = dirname(fileURLToPath(import.meta.url)) + '/migrations'
    const files = readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort()

    for (const file of files) {
      const version = file.replace('.sql', '')
      const { rows } = await client.query(
        'SELECT version FROM schema_migrations WHERE version = $1',
        [version]
      )
      if (rows.length > 0) {
        console.log(`Skipping (already applied): ${file}`)
        continue
      }

      console.log(`Applying: ${file}`)
      const sql = readFileSync(join(migrationsDir, file), 'utf8')
      await client.query('BEGIN')
      await client.query(sql)
      await client.query(
        'INSERT INTO schema_migrations (version) VALUES ($1)',
        [version]
      )
      await client.query('COMMIT')
      console.log(`Done: ${file}`)
    }

    console.log('\nMigratii aplicate cu succes.')
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('Eroare la migratie:', err.message)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

migrate()
