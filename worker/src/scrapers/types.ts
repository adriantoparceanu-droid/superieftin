import type { ImportedProduct } from '../lib/types.js'

// Un scraper produce produse normalizate (ImportedProduct) pentru un magazin fara feed.
// Afilierea (affiliateUrl/affiliateNetwork) NU se seteaza aici — o rezolva ingestul pe
// baza domeniului. Scraperul lasa aceste campuri pe null.
export interface Scraper {
  readonly name: string         // identificator unic (folosit de jobul 'scrape')
  readonly domain: string       // domeniul magazinului, ex. 'emag.ro'
  run(): AsyncGenerator<ImportedProduct>
}

// Helper pentru scrapere: construieste un ImportedProduct neafiliat (afilierea se adauga la ingest).
export function scrapedProduct(
  fields: Omit<ImportedProduct, 'affiliateUrl' | 'affiliateNetwork'>,
): ImportedProduct {
  return { ...fields, affiliateUrl: null, affiliateNetwork: null }
}
