// CDN-uri de imagini care blocheaza hotlinking prin Cloudflare (challenge => HTTP 403).
// Imaginile de pe aceste domenii nu se incarca in browser dintr-un alt origine (superieftin.ro),
// deci nu le stocam din feed. Le inlocuim cu varianta de pe CDN-ul Profitshare (profitsmart.ro),
// preluata din API in `runImageBackfill` (o data + periodic pentru produse noi).
export const BLOCKED_IMAGE_HOSTS = ['forit.ro', 'vexio.ro']

// Adevarat daca URL-ul de imagine e gazduit pe un host blocat (sau subdomeniu al lui).
export function isBlockedImageHost(url: string | null | undefined): boolean {
  if (!url) return false
  try {
    const host = new URL(url.startsWith('//') ? 'https:' + url : url).hostname.toLowerCase()
    return BLOCKED_IMAGE_HOSTS.some((h) => host === h || host.endsWith('.' + h))
  } catch {
    return false
  }
}

// Regex pentru operatorul `~` din Postgres — gaseste imaginile pe hosturi blocate (pentru backfill).
export function blockedImageHostRegex(): string {
  const alt = BLOCKED_IMAGE_HOSTS.map((h) => h.replace(/\./g, '\\.')).join('|')
  return `^https?://([a-z0-9-]+\\.)*(${alt})/`
}
