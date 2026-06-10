import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'
import { config } from 'dotenv'

config({ path: join(dirname(fileURLToPath(import.meta.url)), '../.env') })

const { Pool } = pg
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

async function seed() {
  const client = await pool.connect()
  try {
    const result = await client.query(`
      INSERT INTO retailers (name, slug, base_url, scraper_config, is_active)
      VALUES
        ('eMAG', 'emag', 'https://www.emag.ro', '{"rate_limit_ms": 2000, "categories": []}', true),
        ('Altex', 'altex', 'https://altex.ro', '{"rate_limit_ms": 2000, "categories": []}', false)
      ON CONFLICT (slug) DO NOTHING
      RETURNING name
    `)
    if (result.rows.length > 0) {
      console.log('Seed: retaileri adaugati —', result.rows.map(r => r.name).join(', '))
    } else {
      console.log('Seed: retailerii exista deja, nimic de adaugat.')
    }
  } catch (err) {
    console.error('Eroare la seed:', err.message)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

seed()
