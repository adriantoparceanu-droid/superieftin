// Ce categorii apar in sitemap / llms.txt / hubul /reduceri-reale. Pure — testate.
// Aceeasi regula peste tot, ca sitemap-ul sa nu listeze pagini pe care /c/ le marcheaza noindex.

import { EXCLUDED_AD_ROOTS } from './site'

export interface CategoryLike {
  slug: string
  name: string
  parent_slug: string | null
  visible: boolean
  products: number       // produse disponibile, inclusiv subcategoriile
}

// /c/<slug> indexabil: vizibil si cu cel putin un produs disponibil (inclusiv subcategoriile).
// Sanatate & Naturale RAMANE (SEO organic e permis; regula 8 priveste doar reclamele).
export function isIndexableCategory(c: CategoryLike): boolean {
  return c.visible && c.products > 0
}

export function indexableCategories<T extends CategoryLike>(all: T[]): T[] {
  return all.filter(isIndexableCategory)
}

// Sanatate & Naturale si subcategoriile ei: fara reclame si fara landing /reduceri-reale/ (regula 8)
export function isExcludedFromAds(slug: string, parentSlug: string | null): boolean {
  return EXCLUDED_AD_ROOTS.includes(slug) || EXCLUDED_AD_ROOTS.includes(parentSlug ?? '')
}

// Categoriile care au landing /reduceri-reale/<slug>: indexabile si in afara radacinilor excluse.
export function isLandingCategory(c: CategoryLike): boolean {
  return isIndexableCategory(c) && !isExcludedFromAds(c.slug, c.parent_slug)
}

export function landingCategories<T extends CategoryLike>(all: T[]): T[] {
  return all.filter(isLandingCategory)
}
