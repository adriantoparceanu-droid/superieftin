import { NextResponse } from 'next/server'
import pool from '@/lib/db'
import redis from '@/lib/redis'

export async function GET() {
  const status = { db: 'error', redis: 'error' }

  try {
    await pool.query('SELECT 1')
    status.db = 'ok'
  } catch {}

  try {
    await redis.ping()
    status.redis = 'ok'
  } catch {}

  const allOk = status.db === 'ok' && status.redis === 'ok'
  return NextResponse.json(status, { status: allOk ? 200 : 503 })
}
