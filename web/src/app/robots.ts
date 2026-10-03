import type { MetadataRoute } from 'next'
import { robotsRules } from '@/lib/seo/robots'
import { SITE_URL } from '@/lib/seo/site'

// Runtime, ca să folosească mereu domeniul canonic (env-ul nu e inline-uit la build)
export const dynamic = 'force-dynamic'

// Regulile (inclusiv grupul explicit pentru roboții AI) stau în lib/seo/robots.ts.
// /sitemap.xml e un sitemap index (vezi app/sitemap.xml/route.ts).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: robotsRules(),
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
