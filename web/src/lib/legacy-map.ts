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

// Vechile „categorii” care au devenit tag-uri de conditie (Refurbished / Second Hand)
export const CATEGORIES_TO_TAGS: Record<string, string> = {
  'refurbished': 'refurbished',
  'second-hand': 'second-hand',
  'touchscreen-second-hand': 'second-hand',
}
