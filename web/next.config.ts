import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_SITE_URL: process.env.DOMAIN
      ? `https://${process.env.DOMAIN}`
      : 'https://superieftin.ro',
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
