import type { NextConfig } from 'next'

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
