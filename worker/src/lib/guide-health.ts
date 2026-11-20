// Verificarea săptămânală a articolelor publicate (reorganizarea în blog, etapa 4 —
// docs/plans/2026-11-20-reorganizare-blog-plan.md). Modul PUR (fără DB), testat în
// guide-health.test.ts. Încărcarea din DB + jobul + Telegram: guide-health-job.ts.
//
// Doar SEMNALEAZĂ — nu modifică articolele. Corecția o propune Claude și o aprobă proprietarul.
// Probleme căutate:
//   - produs fără ofertă disponibilă cu link afiliat (cardul ar arăta „Momentan indisponibil”);
//   - produs din marcaje care nu mai există în baza de date;
//   - prețul cel mai bun peste bugetul din titlu („… sub 1.500 de lei”);
//   - articol neactualizat de peste 90 de zile.

export const STALE_GUIDE_DAYS = 90

export interface GuideHealthProduct {
  ref: string                 // cum apare în articol (id sau slug)
  productId: number | null    // null = referința nu mai corespunde niciunui produs
  slug: string | null
  name: string | null
  bestPrice: number | null    // prețul ofertei alese de pickBestOffer; null = nicio ofertă eligibilă
  retailer: string | null
}

export interface GuideHealthInput {
  id: number
  slug: string
  title: string
  updatedAt: Date
  products: GuideHealthProduct[]
}

export type GuideProblem =
  | { kind: 'produs-lipsa'; ref: string }
  | { kind: 'fara-oferta'; ref: string; slug: string; name: string }
  | { kind: 'peste-buget'; slug: string; name: string; price: number; budget: number; retailer: string | null }
  | { kind: 'neactualizat'; days: number }

export interface GuideHealthResult {
  id: number
  slug: string
  title: string
  problems: GuideProblem[]
}

// Fără diacritice (ș/ş, ț/ţ, ă, â, î), litere mici, spațiile neobișnuite → spațiu simplu.
export function normalizeText(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[şș]/gi, 's').replace(/[ţț]/gi, 't')
    .replace(/[   ]/g, ' ')
    .toLowerCase()
}

// „sub 1.500 de lei”, „sub 1500 lei”, „Sub 1 500 RON”, „până în 2.000 de lei”, „maxim 800 lei”.
// Separatorul de mii: punct sau spațiu; zecimalele (rare în titluri) sunt ignorate.
const BUDGET_RE = /(?:^|[^a-z])(?:sub|pana (?:in|la)|maxim(?:um)?)\s+(\d{1,3}(?:[. ]\d{3})+|\d+)(?:,\d+)?\s*(?:de\s+)?(?:lei|ron)\b/

// Bugetul din titlu, în lei; null dacă titlul nu are buget. La mai multe bugete îl ia pe primul.
export function parseTitleBudget(title: string): number | null {
  const m = normalizeText(title).match(BUDGET_RE)
  if (!m) return null
  const n = Number(m[1].replace(/[. ]/g, ''))
  return Number.isFinite(n) && n > 0 ? n : null
}

// Referințele de produs din marcajele corpului: {{oferte:X}}, {{pret:X}}, {{comparatie:X,Y}} și
// orice alt marcaj {{tip:…}} (inclusiv cele scoase din setul public — tot spun ce produs e citat).
// Unice, în ordinea apariției.
const MARKER_RE = /\{\{\s*([a-z-]+)\s*:\s*([^{}\n]*?)\s*\}\}/gi

export function extractMarkerRefs(body: string): string[] {
  const refs = new Set<string>()
  for (const m of body.matchAll(MARKER_RE)) {
    for (const r of m[2].split(',')) {
      const ref = r.trim()
      if (ref) refs.add(ref)
    }
  }
  return [...refs]
}

const DAY_MS = 24 * 3600 * 1000

export function checkGuide(g: GuideHealthInput, now: Date = new Date()): GuideHealthResult {
  const problems: GuideProblem[] = []
  const budget = parseTitleBudget(g.title)
  for (const p of g.products) {
    if (p.productId == null || p.slug == null) {
      problems.push({ kind: 'produs-lipsa', ref: p.ref })
      continue
    }
    const name = p.name ?? p.slug
    if (p.bestPrice == null) {
      problems.push({ kind: 'fara-oferta', ref: p.ref, slug: p.slug, name })
    } else if (budget != null && p.bestPrice > budget) {
      problems.push({ kind: 'peste-buget', slug: p.slug, name, price: p.bestPrice, budget, retailer: p.retailer })
    }
  }
  const days = Math.floor((now.getTime() - g.updatedAt.getTime()) / DAY_MS)
  if (days > STALE_GUIDE_DAYS) problems.push({ kind: 'neactualizat', days })
  return { id: g.id, slug: g.slug, title: g.title, problems }
}

const lei = (n: number) => n.toLocaleString('ro-RO', { maximumFractionDigits: 2 })

export function describeProblem(p: GuideProblem): string {
  switch (p.kind) {
    case 'produs-lipsa': return `produsul „${p.ref}” din marcaje nu mai există în baza de date`
    case 'fara-oferta': return `${p.name} — nicio ofertă disponibilă cu link afiliat`
    case 'peste-buget': return `${p.name} — ${lei(p.price)} lei${p.retailer ? ` (${p.retailer})` : ''}, peste bugetul din titlu (${lei(p.budget)} lei)`
    case 'neactualizat': return `neactualizat de ${p.days} de zile (> ${STALE_GUIDE_DAYS})`
  }
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Limita Telegram e 4096 de caractere; păstrăm loc pentru ultima linie.
const TELEGRAM_MAX = 3900

// Rezumatul Telegram (HTML). null când nu există probleme — atunci nu se trimite nimic.
export function formatTelegramSummary(results: readonly GuideHealthResult[], total: number): string | null {
  const bad = results.filter((r) => r.problems.length)
  if (!bad.length) return null
  const nProblems = bad.reduce((s, r) => s + r.problems.length, 0)
  const lines = [`📝 <b>Verificare articole</b>: ${bad.length} din ${total} publicate au probleme (${nProblems} în total)`]
  let used = lines[0].length
  let shown = 0
  for (const r of bad) {
    const block = ['', `<b>${esc(r.title)}</b> (/ghiduri/${esc(r.slug)})`, ...r.problems.map((p) => `• ${esc(describeProblem(p))}`)].join('\n')
    if (used + block.length > TELEGRAM_MAX) break
    lines.push(block)
    used += block.length + 1
    shown++
  }
  if (shown < bad.length) lines.push(`\n… și încă ${bad.length - shown} articole (npm run guide-health:now pentru lista completă)`)
  lines.push('\nArticolele nu au fost modificate.')
  return lines.join('\n')
}

// Raportul pentru terminal (npm run guide-health:now).
export function formatTextReport(results: readonly GuideHealthResult[]): string {
  if (!results.length) return 'Niciun articol publicat.'
  const bad = results.filter((r) => r.problems.length)
  const out = [`Articole publicate: ${results.length} · cu probleme: ${bad.length}`]
  for (const r of bad) {
    out.push('', `${r.title}  (/ghiduri/${r.slug}, #${r.id})`)
    for (const p of r.problems) out.push(`  - ${describeProblem(p)}`)
  }
  if (!bad.length) out.push('Nicio problemă găsită.')
  return out.join('\n')
}
