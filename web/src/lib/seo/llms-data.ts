import { getPublishedGuideSlugs } from '../guides/queries'
import { getThemeCategories } from './queries'
import type { LlmsData } from './llms'

// Datele comune pentru /llms.txt si /llms-full.txt. .catch: o sursa cazuta nu strica tot fisierul.
export async function loadLlmsData(): Promise<LlmsData> {
  const [guides, themes] = await Promise.all([
    getPublishedGuideSlugs().catch(() => []),
    getThemeCategories().catch(() => []),
  ])
  return { guides, themes }
}
