'use client'

// Helper GA4: trimite evenimente doar daca scriptul gtag a fost incarcat
// (scriptul se injecteaza exclusiv in productie — vezi components/analytics/GoogleAnalytics.tsx)

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
  }
}

export function gaEvent(name: string, params: Record<string, unknown> = {}): void {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return
  window.gtag('event', name, params)
}

// Item in formatul GA4 ecommerce
export interface GaItem {
  item_name: string
  item_category?: string | null
  item_brand?: string | null
  price?: number | null
  affiliation?: string | null
}
