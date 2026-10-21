import { getPublishedGuideSlugs } from '../guides/queries'
import { getCategoryTreeStats } from './queries'
import { getSiteFacts } from './site-facts'
import { indexableCategories, landingCategories } from './categories'
import type { LlmsData } from './llms'
import { getPublishedEditions, getTimingEligible } from '../observator/queries'

// Datele comune pentru /llms.txt si /llms-full.txt. .catch: o sursa cazuta (ex. tabela guides
// lipsa) nu strica tot fisierul.
export async function loadLlmsData(): Promise<LlmsData> {
  const [facts, guides, stats, editions, timing] = await Promise.all([
    getSiteFacts().catch(() => null),
    getPublishedGuideSlugs().catch(() => []),
    getCategoryTreeStats().catch(() => []),
    getPublishedEditions().catch(() => []),
    getTimingEligible().catch(() => []),
  ])
  return {
    facts,
    observator: { latestEdition: editions[0] ?? null, timing: timing.map((c) => ({ slug: c.slug, name: c.name })) },
    guides,
    categories: indexableCategories(stats),
    landings: landingCategories(stats),
  }
}
