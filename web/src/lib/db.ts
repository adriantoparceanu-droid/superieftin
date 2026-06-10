import { Pool } from 'pg'

declare global {
  // eslint-disable-next-line no-var
  var _pgPool: Pool | undefined
}

// Reutilizeaza pool-ul in development (hot reload Next.js)
const pool = global._pgPool ?? new Pool({
  connectionString: process.env.DATABASE_URL,
})

if (process.env.NODE_ENV !== 'production') {
  global._pgPool = pool
}

export default pool
