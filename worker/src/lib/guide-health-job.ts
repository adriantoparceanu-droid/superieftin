// Verificarea săptămânală a articolelor publicate — partea cu baza de date și Telegram.
// Regulile (pure, testate) sunt în guide-health.ts. DOAR CITIRE: nu modifică articolele.
//
// Rulează ca job BullMQ `guide-health` în coada `sync` (GUIDE_HEALTH_CRON, implicit luni 07:30,
// Europe/Bucharest) și manual cu `npm run guide-health:now [-- --telegram]`.
//
// Produsele unui articol = UNIUNEA dintre:
//   - guide_products (scrisă la salvarea din admin și la `ghiduri:import`, din marcaje), și
//   - referințele din marcajele corpului ({{oferte:X}}, {{pret:X}}, {{comparatie:X,Y}} …).
// De ce ambele: un produs șters dispare din guide_products (ON DELETE CASCADE), dar marcajul din
// articol rămâne și cardul ar arăta „indisponibil” — doar marcajele îl mai prind („produs-lipsa”).
import pool from './db.js'
import { notifyAdmin } from './admin-telegram.js'
import { fetchProductOffers, summarizeByProduct } from './best-offer-query.js'
import {
  checkGuide, extractMarkerRefs, formatTelegramSummary,
  type GuideHealthProduct, type GuideHealthResult,
} from './guide-health.js'

export interface GuideHealthRun {
  results: GuideHealthResult[]
  guides: number
  withProblems: number
  problems: number
  // câte produse au venit DOAR din marcaje (lipsă din guide_products) — semn că tabela e incompletă
  markerOnlyProducts: number
  telegramSent: boolean
}

export async function runGuideHealth(opts: { telegram?: boolean; now?: Date } = {}): Promise<GuideHealthRun> {
  const guides = await pool.query<{ id: number; slug: string; title: string; updated_at: Date; body_md: string; product_ids: string[] }>(`
    SELECT g.id, g.slug, g.title, g.updated_at, g.body_md,
           COALESCE((SELECT array_agg(gp.product_id::text ORDER BY gp.position) FROM guide_products gp WHERE gp.guide_id = g.id), '{}') AS product_ids
    FROM guides g
    WHERE g.status = 'published'
    ORDER BY g.id
  `)

  // Toate referințele din marcaje (id numeric sau slug), rezolvate într-un singur query
  const refsByGuide = new Map(guides.rows.map((g) => [g.id, extractMarkerRefs(g.body_md)]))
  const allRefs = [...new Set([...refsByGuide.values()].flat())]
  const numericRefs = allRefs.filter((r) => /^\d+$/.test(r))
  const prodRows = await pool.query<{ id: string; slug: string; name: string }>(`
    SELECT id, slug, name FROM products
    WHERE id = ANY($1::bigint[]) OR slug = ANY($2::text[])
       OR id IN (SELECT gp.product_id FROM guide_products gp JOIN guides g ON g.id = gp.guide_id WHERE g.status = 'published')
  `, [numericRefs, allRefs])
  const byId = new Map(prodRows.rows.map((p) => [Number(p.id), p]))
  const bySlug = new Map(prodRows.rows.map((p) => [p.slug, p]))
  const resolve = (ref: string) => (/^\d+$/.test(ref) ? byId.get(Number(ref)) : undefined) ?? bySlug.get(ref)

  const summaries = summarizeByProduct(await fetchProductOffers(pool, [...byId.keys()]))

  let markerOnlyProducts = 0
  const results = guides.rows.map((g) => {
    const linked = new Set(g.product_ids.map(Number))
    const products: GuideHealthProduct[] = []
    const seen = new Set<number>()
    const add = (ref: string, p: { id: string; slug: string; name: string } | undefined) => {
      if (!p) { products.push({ ref, productId: null, slug: null, name: null, bestPrice: null, retailer: null }); return }
      const id = Number(p.id)
      if (seen.has(id)) return
      seen.add(id)
      const best = summaries.get(id)?.best ?? null
      products.push({ ref, productId: id, slug: p.slug, name: p.name, bestPrice: best?.price ?? null, retailer: best?.retailerName ?? null })
    }
    for (const id of linked) add(String(id), byId.get(id))
    for (const ref of refsByGuide.get(g.id) ?? []) {
      const p = resolve(ref)
      if (p && !linked.has(Number(p.id))) markerOnlyProducts++
      add(ref, p)
    }
    return checkGuide({ id: g.id, slug: g.slug, title: g.title, updatedAt: g.updated_at, products }, opts.now)
  })

  let telegramSent = false
  if (opts.telegram) {
    const msg = formatTelegramSummary(results, results.length)
    if (msg) telegramSent = await notifyAdmin(msg, 'verificarea articolelor')
  }
  const bad = results.filter((r) => r.problems.length)
  return {
    results,
    guides: results.length,
    withProblems: bad.length,
    problems: bad.reduce((s, r) => s + r.problems.length, 0),
    markerOnlyProducts,
    telegramSent,
  }
}

// Pentru coada BullMQ: rezultatul jobului rămâne mic (doar cifre) — detaliile pleacă pe Telegram.
export async function runGuideHealthJob(log: (m: string) => void) {
  const r = await runGuideHealth({ telegram: true })
  log(`guide-health: ${r.guides} articole publicate, ${r.withProblems} cu probleme (${r.problems}), Telegram: ${r.telegramSent ? 'trimis' : 'nu'}`)
  return { guides: r.guides, withProblems: r.withProblems, problems: r.problems, markerOnlyProducts: r.markerOnlyProducts, telegramSent: r.telegramSent }
}
