import { splitGuideBody } from './markers'
import { collectHeadings, newHeadingEnv } from './markdown'

// Cuprinsul unui ghid: H2-urile din corp (si „# …”, randate tot ca H2), cu aceleasi id-uri pe care
// le pune GuideBody la randare. Ambele pornesc de la newHeadingEnv() si parcurg bucatile Markdown
// in aceeasi ordine → id-urile coincid fara sa fie transmise intre componente.
export function guideToc(body: string): { id: string; text: string }[] {
  const texts = splitGuideBody(body).flatMap((s) => (s.kind === 'md' ? [s.text] : []))
  return collectHeadings(texts, newHeadingEnv())
}
