import { NextRequest, NextResponse, after } from 'next/server'
import pool from '@/lib/db'
import { trackClick } from '@/lib/queries'
import { generateClickId, detectNetwork, withSubId } from '@/lib/subid'
import { OFFER_AVAILABLE_SQL } from '@/lib/availability'

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
    available: boolean; product_slug: string
  }>(
    `SELECT o.affiliate_url, o.url, o.product_id, o.retailer_id, p.slug AS product_slug,
            ${OFFER_AVAILABLE_SQL} AS available
     FROM offers o JOIN products p ON p.id = o.product_id
     WHERE o.id = $1`,
    [id]
  )

  if (result.rows.length === 0) {
    return NextResponse.redirect('https://www.superieftin.ro', { status: 302 })
  }

  const { affiliate_url, url, product_id, retailer_id, available, product_slug } = result.rows[0]

  // Oferta negasita recent in feed-uri / scanari: linkul spre magazin probabil nu mai duce
  // nicaieri (produs scos, pret vechi). Trimitem vizitatorul inapoi pe pagina produsului
  // (linkuri vechi, pagini ramase deschise) — fara click inregistrat.
  if (!available) {
    const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.superieftin.ro'
    return NextResponse.redirect(new URL(`/p/${encodeURIComponent(product_slug)}`, base), {
      status: 302,
      headers: { 'Cache-Control': 'no-store' },
    })
  }

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
