import { NextResponse } from 'next/server'

// /shop, /shop/page/N (listarea veche WooCommerce) → homepage, echivalentul catalogului.
// Restul sub /shop/ (ex. /shop/.env de la scannere) → 410.
export async function GET(_req: Request, { params }: { params: Promise<{ path?: string[] }> }) {
  const path = (await params).path ?? []
  const isListing = path.length === 0 || (path[0] === 'page' && /^\d+$/.test(path[1] ?? ''))
  if (!isListing) return new NextResponse('Pagina nu mai există.', { status: 410, headers: { 'X-Robots-Tag': 'noindex' } })
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.superieftin.ro'
  return NextResponse.redirect(new URL('/', base), 308)
}
