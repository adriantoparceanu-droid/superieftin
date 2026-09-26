// Poarta policy-reviewer (REGULI.md regula 10): ads:apply NU scrie in cont fara un verdict PASS
// recent pentru EXACT continutul fisierului de campanie.
//
// Fisierul: ads/campaigns/.review/<campanie>.pass   (<campanie> = numele fisierului YAML fara .yaml)
// Il scrie policy-reviewer (sau coordonatorul, dupa verdictul lui). Format YAML:
//
//   verdict: PASS
//   date: 2026-09-27T14:00:00Z          # momentul verificarii (ISO)
//   reviewer: policy-reviewer
//   file: ads/campaigns/samsung-pliabile.yaml
//   sha256: <hash>                       # din `npm run ads:validate` (coloana „hash review”)
//   notes: ...                           # optional
//
// Hash-ul e al CONTINUTULUI (fara campurile id/budget_id, vezi schema.ts → contentHash), deci:
//  - orice modificare de text/URL/buget/cuvinte dupa verdict → hash diferit → apply refuza;
//  - ID-urile scrise de ads:apply dupa creare NU invalideaza verdictul.
// „Recent” = cel mult REVIEW_MAX_AGE_DAYS zile: afirmatiile de pe landing se schimba (preturi).

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { parse } from 'yaml'
import { REVIEW_DIR, REPO_ROOT, contentHash, type CampaignFile } from './schema.js'

export const REVIEW_MAX_AGE_DAYS = 7

export interface ReviewStatus { ok: boolean; reason: string; passFile: string }

export function checkReview(cf: CampaignFile, now = new Date(), dir = REVIEW_DIR): ReviewStatus {
  const passFile = path.join(dir, `${cf.slug}.pass`)
  const rel = path.relative(REPO_ROOT, passFile)
  const failFile = path.join(dir, `${cf.slug}.fail`)
  if (!existsSync(passFile)) {
    const extra = existsSync(failFile) ? ' (există un verdict .fail)' : ''
    return { ok: false, reason: `lipsește verdictul PASS ${rel}${extra}`, passFile }
  }
  let data: any
  try { data = parse(readFileSync(passFile, 'utf8')) } catch (e) {
    return { ok: false, reason: `${rel} nu e YAML valid: ${(e as Error).message}`, passFile }
  }
  if (String(data?.verdict ?? '').toUpperCase() !== 'PASS') return { ok: false, reason: `${rel}: verdict „${data?.verdict}”, nu PASS`, passFile }
  const expected = contentHash(cf.raw)
  if (String(data?.sha256 ?? '').trim() !== expected) {
    return { ok: false, reason: `${rel}: hash-ul nu corespunde (fișierul s-a schimbat după verificare) — verdict pentru ${String(data?.sha256 ?? '-').slice(0, 12)}…, acum ${expected.slice(0, 12)}…`, passFile }
  }
  const date = new Date(data?.date)
  if (Number.isNaN(date.getTime())) return { ok: false, reason: `${rel}: câmpul date lipsește sau e invalid`, passFile }
  const ageDays = (now.getTime() - date.getTime()) / 86_400_000
  if (ageDays > REVIEW_MAX_AGE_DAYS) return { ok: false, reason: `${rel}: verdict vechi de ${Math.floor(ageDays)} zile (max ${REVIEW_MAX_AGE_DAYS}) — cere o reverificare`, passFile }
  if (ageDays < -1) return { ok: false, reason: `${rel}: data verdictului e în viitor`, passFile }
  return { ok: true, reason: `PASS din ${date.toISOString().slice(0, 16).replace('T', ' ')}, hash OK`, passFile }
}
