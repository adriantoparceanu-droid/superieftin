import { getPublishedGuideSlugs } from '../guides/queries'
import { getCategoryTreeStats } from './queries'
import { getSiteFacts } from './site-facts'
import { indexableCategories, landingCategories } from './categories'
import type { LlmsData } from './llms'

// Datele comune pentru /llms.txt si /llms-full.txt. .catch: o sursa cazuta (ex. tabela guides
// lipsa) nu strica tot fisierul.
export async function loadLlmsData(): Promise<LlmsData> {
  const [facts, guides, stats] = await Promise.all([
    getSiteFacts().catch(() => null),
    getPublishedGuideSlugs().catch(() => []),
    getCategoryTreeStats().catch(() => []),
  ])
  return {
    facts,
    guides,
    categories: indexableCategories(stats),
    landings: landingCategories(stats),
  }
}
