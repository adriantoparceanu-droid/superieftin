import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '../../../.env'), override: true })

import pool from '../lib/db.js'
import { hashPassword } from '../lib/password.js'

// Creeaza sau reseteaza un utilizator admin.
// Rulare: npm run admin:create -- email@exemplu.ro parola "Nume Optional"
async function main() {
  const [email, password, name = ''] = process.argv.slice(2)
  if (!email || !password) {
    console.error('Utilizare: npm run admin:create -- <email> <parola> [nume]')
    process.exit(1)
  }
  if (password.length < 8) {
    console.error('Parola trebuie sa aiba minimum 8 caractere.')
    process.exit(1)
  }

  const hash = hashPassword(password)
  const { rows } = await pool.query<{ id: number }>(`
    INSERT INTO admin_users (email, password_hash, name)
    VALUES (lower($1), $2, $3)
    ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, is_active = true
    RETURNING id
  `, [email, hash, name])

  console.log(`Admin #${rows[0].id} (${email}) creat/actualizat.`)
  await pool.end()
}

main().catch((err) => { console.error(err); process.exit(1) })
