import { NextResponse } from 'next/server'
import { getProductsForFeed } from '@/lib/queries'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://superieftin.ro'

const CATEGORY_MAP: Record<string, string> = {
  'telefoane-mobile': 'Electronics > Communications > Telephony > Mobile Phones',
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export const revalidate = 86400

export async function GET() {
  const products = await getProductsForFeed()

  const items = products
    .filter(p => p.current_price && p.affiliate_url)
    .map(p => {
      const googleCategory = CATEGORY_MAP[p.category] || p.category.replace(/-/g, ' ')
      return `
  <entry>
    <g:id>${escapeXml(p.id)}</g:id>
    <g:title>${escapeXml(p.name)}</g:title>
    <g:link>${escapeXml(`${SITE_URL}/go/${p.offer_id}`)}</g:link>
    ${p.image_url ? `<g:image_link>${escapeXml(p.image_url)}</g:image_link>` : ''}
    <g:price>${(p.current_price as number).toFixed(2)} RON</g:price>
    <g:availability>in_stock</g:availability>
    <g:condition>new</g:condition>
    <g:google_product_category>${escapeXml(googleCategory)}</g:google_product_category>
    ${p.brand ? `<g:brand>${escapeXml(p.brand)}</g:brand>` : ''}
  </entry>`
    }).join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:g="http://base.google.com/ns/1.0">
  <title>superieftin.ro — Feed produse</title>
  <link href="${SITE_URL}/feeds/products.xml" rel="self"/>
  <updated>${new Date().toISOString()}</updated>
${items}
</feed>`

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
    },
  })
}
