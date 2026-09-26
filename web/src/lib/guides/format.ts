// Data in format romanesc, ora Romaniei: „27 septembrie 2026”
export function formatGuideDate(iso: string | null): string {
  if (!iso) return ''
  return new Intl.DateTimeFormat('ro-RO', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Bucharest',
  }).format(new Date(iso))
}

// Slug-uri rezervate sub /ghiduri/ (pagini statice care ar umbri un ghid cu acelasi slug)
export const RESERVED_GUIDE_SLUGS = ['metodologie']

// Slugify identic cu worker/src/lib/slug.ts si cu toSlug din lib/admin/actions.ts
// (acolo nu se poate importa: fisierele 'use server' pot exporta doar functii async)
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[șțăî]/g, (c) => ({ ș: 's', ț: 't', ă: 'a', î: 'i' }[c] || c))
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120)
}

// Afirmatii de sanatate interzise (REGULI.md regula 8) — publicarea e blocata daca apar in text.
// Lista e scurta si evidenta; nu inlocuieste citirea atenta a verificatorului.
const HEALTH_CLAIMS = ['vindeca', 'vindecă', 'trateaza', 'tratează', 'detoxifica', 'detoxifică', 'detoxifiere', 'previne boli', 'combate boli', 'elimina toxinele', 'elimină toxinele']

export function findHealthClaims(text: string): string[] {
  const low = text.toLowerCase()
  return [...new Set(HEALTH_CLAIMS.filter((w) => new RegExp(`(^|[^a-zăâîșț])${w}`, 'i').test(low)))]
}
