// Regulile din /robots.txt (folosite de app/robots.ts). Pure — testate in robots.test.ts.
//
// De ce un grup separat pentru robotii AI: e un semnal EXPLICIT ca ii lasam sa citeasca site-ul
// (decizia proprietarului: „îi permitem”) si ne protejeaza daca Cloudflare activeaza vreodata
// un robots.txt gestionat. ATENTIE: un robot care are grup propriu NU mai citeste grupul `*`,
// deci Disallow-urile (/go/ = redirect de afiliere, /api/) se repeta in fiecare grup — altfel
// le-am deschide /go/ (interzis: protectia anti-roboti, CLAUDE.md).
//
// Blocajul real (403 pentru GPTBot/ClaudeBot) e in Cloudflare, nu aici — vezi raportul SEO, E1.

export const ROBOTS_DISALLOW = ['/go/', '/api/']

// Robotii AI / de cautare numiti explicit (raport SEO 2026-10-04, D1)
export const AI_BOTS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-SearchBot',
  'Claude-User',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'Applebot-Extended',
  'CCBot',
  'Bingbot',
]

export interface RobotsGroup { userAgent: string | string[]; allow: string; disallow: string[] }

export function robotsRules(): RobotsGroup[] {
  return [
    { userAgent: '*', allow: '/', disallow: [...ROBOTS_DISALLOW] },
    { userAgent: [...AI_BOTS], allow: '/', disallow: [...ROBOTS_DISALLOW] },
  ]
}
