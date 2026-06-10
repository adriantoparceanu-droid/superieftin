import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { trackClick } from '@/lib/queries'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ offerId: string }> }
) {
  const { offerId } = await params

  const id = parseInt(offerId, 10)
  if (isNaN(id) || id <= 0) {
    return NextResponse.redirect('https://superieftin.ro', { status: 302 })
  }

  const result = await pool.query<{ affiliate_url: string | null; url: string }>(
    'SELECT affiliate_url, url FROM offers WHERE id = $1',
    [id]
  )

  if (result.rows.length === 0) {
    return NextResponse.redirect('https://superieftin.ro', { status: 302 })
  }

  const { affiliate_url, url } = result.rows[0]
  const destination = affiliate_url || url

  // Track click non-blocking
  trackClick(offerId)

  return NextResponse.redirect(destination, {
    status: 302,
    headers: {
      'Cache-Control': 'no-store',
    },
  })
}
