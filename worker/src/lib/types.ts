// Produs normalizat, indiferent de sursa (feed CSV/XML sau API Profitshare).
export interface ImportedProduct {
  name: string
  slug: string
  brand: string | null
  category: string
  partNo: string | null
  imageUrl: string | null
  url: string
  affiliateUrl: string
  price: number | null   // pret final cu TVA (cel redus, daca exista)
  inStock: boolean
}
