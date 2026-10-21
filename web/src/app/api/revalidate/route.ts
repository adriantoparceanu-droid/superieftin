import { revalidateTag } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-revalidate-secret')
  if (!secret || secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  revalidateTag('products', 'max')
  revalidateTag('discounts', 'max')
  revalidateTag('price-history', 'max')
  revalidateTag('categories', 'max')
  revalidateTag('menu', 'max')
  revalidateTag('banners', 'max')
  // Observatorul (migratiile 036/037): worker-ul cheama ruta dupa feed-sync (snapshot → tracker
  // evenimente) si dupa jobul price-index — fara ele paginile asteptau expirarea cache-ului (1 h)
  revalidateTag('event-tracker', 'max')
  revalidateTag('price-index', 'max')

  return NextResponse.json({ revalidated: true })
}
