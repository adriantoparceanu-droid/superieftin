import { legacyProduct } from '@/lib/legacy-urls'

// URL vechi de produs (WooCommerce) → /p/<slug> daca exista, altfel 410. Vezi lib/legacy-urls.ts
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  return legacyProduct((await params).path)
}
