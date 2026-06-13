import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
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
