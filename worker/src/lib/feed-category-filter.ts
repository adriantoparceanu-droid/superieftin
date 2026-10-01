// Filtrul de categorii per feed extern (external_feeds.category_filter, migratia 028).
// ATENTIE: aceeasi normalizare e si in web/src/lib/admin/feed-categories.ts (lista de
// categorii din admin) — modifica-le impreuna, altfel o categorie bifata in admin n-ar mai
// fi recunoscuta la import.
//
//   null  → se importa toate categoriile (comportamentul vechi)
//   []    → nu se importa nimic (feed-ul se sare complet)
//   lista → doar categoriile din lista

// Comparatie fara diferenta de majuscule si fara spatiile de la capete
// („ Huse Telefoane ” == „huse telefoane”). Aceeasi regula ca la feed_category_map.
export function normalizeFeedCategory(s: string | null | undefined): string {
  return (s ?? '').trim().toLowerCase()
}

// Filtru gol = feed-ul nu importa nimic pana alegi categoriile din admin
export function importsNothing(filter: string[] | null | undefined): boolean {
  return Array.isArray(filter) && filter.length === 0
}

// Intoarce o functie „se importa categoria asta?”. Setul se construieste o singura data per
// feed, ca verificarea pe fiecare din cele zeci de mii de randuri sa fie instantanee.
export function compileCategoryFilter(filter: string[] | null | undefined): (category: string) => boolean {
  if (filter == null) return () => true
  const allowed = new Set(filter.map(normalizeFeedCategory))
  return (category) => allowed.has(normalizeFeedCategory(category))
}
