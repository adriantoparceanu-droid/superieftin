import { legacyCategory } from '@/lib/legacy-urls'

// URL vechi de categorie (WooCommerce) → /c/<slug> sau /t/<tag> daca exista, altfel 410
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  return legacyCategory((await params).path)
}
