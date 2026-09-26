import { NextRequest, NextResponse, after } from 'next/server'
import pool from '@/lib/db'
import { trackClick } from '@/lib/queries'
import { generateClickId, detectNetwork, withSubId } from '@/lib/subid'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ offerId: string }> }
) {
  const { offerId } = await params

  const id = parseInt(offerId, 10)
  if (isNaN(id) || id <= 0) {
    return NextResponse.redirect('https://www.superieftin.ro', { status: 302 })
  }

  const result = await pool.query<{
    affiliate_url: string | null; url: string; product_id: string; retailer_id: number
  }>(
    'SELECT affiliate_url, url, product_id, retailer_id FROM offers WHERE id = $1',
    [id]
  )

  if (result.rows.length === 0) {
    return NextResponse.redirect('https://www.superieftin.ro', { status: 302 })
  }

  const { affiliate_url, url, product_id, retailer_id } = result.rows[0]

  // click_id unic per click, trimis ca subID catre retea (doar pe linkurile afiliate)
  const clickId = generateClickId()
  const network = affiliate_url ? detectNetwork(affiliate_url) : null
  const destination = affiliate_url ? withSubId(affiliate_url, network, clickId) : url

  // Scrierile in DB ruleaza DUPA ce redirectul a plecat — clickul ramane rapid
  after(async () => {
    await trackClick(offerId)
    try {
      await pool.query(
        `INSERT INTO ad_clicks (click_id, offer_id, product_id, retailer_id, network)
         VALUES ($1, $2, $3, $4, $5)`,
        [clickId, id, product_id, retailer_id, network]
      )
    } catch (err) {
      // Non-critic pentru utilizator, dar pierdem potrivirea comisionului — il logam
      console.error('ad_clicks insert esuat', err)
    }
  })

  return NextResponse.redirect(destination, {
    status: 302,
    headers: {
      'Cache-Control': 'no-store',
    },
  })
}
