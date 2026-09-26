import type { NextConfig } from 'next'
import { RENAMED_CATEGORIES, CATEGORIES_TO_TAGS } from './src/lib/legacy-map'

const nextConfig: NextConfig = {
  output: 'standalone',
  // Dev local prin Herd (.test): permite resursele /_next/* si HMR de pe domeniul proxy,
  // altfel Next 16 le blocheaza ca fiind cross-origin (HMR esueaza, bundle-ul client poate
  // sa nu se incarce => fara hidratare => fara drag-and-drop).
  allowedDevOrigins: ['superieftin.test', 'www.superieftin.test', '*.superieftin.test'],
  env: {
    // Domeniul canonic vine din SITE_URL (build arg, ex. https://www.superieftin.ro).
    // DOMAIN rămâne fallback pentru dev local (ex. superieftin.test).
    NEXT_PUBLIC_SITE_URL:
      process.env.NEXT_PUBLIC_SITE_URL ||
      (process.env.DOMAIN ? `https://${process.env.DOMAIN}` : 'https://www.superieftin.ro'),
  },
  // Slug-uri de categorii redenumite / devenite tag-uri → noua pagina (308 = permanent,
  // tratat de Google ca 301). URL-urile vechi WooCommerce: route handlers, vezi lib/legacy-urls.ts
  async redirects() {
    return [
      ...Object.entries(RENAMED_CATEGORIES).map(([from, to]) => ({
        source: `/c/${from}`, destination: `/c/${to}`, permanent: true,
      })),
      ...Object.entries(CATEGORIES_TO_TAGS).map(([from, to]) => ({
        source: `/c/${from}`, destination: `/t/${to}`, permanent: true,
      })),
    ]
  },
  images: {
    // Permite imagini de pe CDN-ul eMAG
    remotePatterns: [
      { protocol: 'https', hostname: '*.akamaized.net' },
      { protocol: 'https', hostname: '*.emag.ro' },
      { protocol: 'https', hostname: 'emagst.akamaized.net' },
    ],
  },
}

export default nextConfig
