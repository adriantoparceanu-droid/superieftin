import { gone } from '@/lib/legacy-urls'

// /shop, /shop/page/N (listarea veche WooCommerce) si orice altceva sub /shop/ → 410.
// Pana la 20 nov. 2026 listarea ducea pe homepage (era „catalogul”); site-ul e acum blog de
// recomandari, fara catalog de produse → nu mai exista un echivalent real (homepage = soft 404).
export async function GET() {
  return gone()
}
