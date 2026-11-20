// Harti pentru URL-urile vechi, fara dependente (importate si de next.config.ts → redirects).
// Logica completa si motivatia: lib/legacy-urls.ts

// Categorii redenumite: slug vechi → slug nou (folosit si in next.config.ts → redirects)
export const RENAMED_CATEGORIES: Record<string, string> = {
  'incarcatoare-auto': 'incarcatoare-cabluri',
  'incarcatoare-telefon': 'incarcatoare-cabluri',
  'cabluri-de-date': 'incarcatoare-cabluri',
  'pc-periferice-software': 'periferice-software',
  'telefoane-si-accesorii': 'telefoane-accesorii',
  'folii-telefoane': 'folii-protectie-telefon',
  'acumulatori-baterii-noi': 'baterii-telefoane',
  'miere-de-albine': 'miere-apicole',
}

// Vechile „categorii” devenite tag-uri de conditie (Refurbished / Second Hand). Duceau pe /t/<tag>;
// paginile /t/ au disparut la trecerea in blog (20 nov. 2026) → 410 direct, fara lant de redirect
// (src/proxy.ts pentru /c/<slug>, lib/legacy-urls.ts pentru /categorie-produs/…).
export const RETIRED_CATEGORY_SLUGS = ['refurbished', 'second-hand', 'touchscreen-second-hand'] as const
