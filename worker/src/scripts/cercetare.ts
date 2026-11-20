// Unealta internă de cercetare pentru articole (reorganizarea în blog, etapa 3 —
// docs/plans/2026-11-20-reorganizare-blog-plan.md). DOAR CITIRE: nu scrie nimic în baza de date.
//
// Utilizare (local, din worker/):
//   npm run cercetare -- --tema=<slug categorie> [--buget=N] [--limit=N] [--reduceri] [--json]
//     --tema      slug din `categories`; un părinte include toate subcategoriile lui
//     --buget     doar produsele cu cel mai bun preț ≤ N lei
//     --limit     câte produse se afișează (implicit 30)
//     --reduceri  doar reducerile reale (preț < mediana pe 30 de zile × 0,95, regula site-ului)
//     --json      JSON pe stdout (pentru scrierea ciornelor de articole)
// Producție (containerul worker): docker compose exec -T worker node worker/dist/scripts/cercetare.js --tema=…
//
// Candidați = produse din temă cu cel puțin o ofertă DISPONIBILĂ și cu link afiliat. „Cel mai bun
// preț” = regula „cel mai ieftin magazin partener” (lib/best-offer.ts). Mediana/min/max pe 30 de
// zile sunt ale ofertei alese (offer_price_stats, precalculate); min 90 z = cel mai mic preț în stoc
// din price_history pe TOATE ofertele produsului (doar pentru produsele afișate).
// Arborii Sănătate & Naturale și farmacie veterinară sunt excluși (afirmații de sănătate, regula 8).

import pool from '../lib/db.js'
import { ALERT_OFFER_AVAILABLE_SQL } from '../lib/alert-sql.js'
import { fetchProductOffers, summarizeByProduct } from '../lib/best-offer-query.js'
import { compareCandidates, isRealDiscount, withinBudget } from '../lib/best-offer.js'

const EXCLUDED_TREES = ['sanatate-naturale', 'farmacie-veterinara']
const DEFAULT_LIMIT = 30

interface Args { tema: string; buget: number | null; limit: number; reduceri: boolean; json: boolean }

function parseArgs(argv: string[]): Args | string {
  const val = (name: string) => argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=')
  const unknown = argv.filter((a) => !/^--(tema|buget|limit)=/.test(a) && a !== '--reduceri' && a !== '--json')
  if (unknown.length) return `Argumente necunoscute: ${unknown.join(' ')}`
  const tema = val('tema')?.trim()
  if (!tema) return 'Lipsește --tema=<slug categorie> (ex. --tema=telefoane-mobile)'
  let buget: number | null = null
  const b = val('buget')
  if (b != null) {
    buget = Number(b.replace(/[.\s]/g, '').replace(',', '.'))
    if (!Number.isFinite(buget) || buget <= 0) return `--buget invalid: ${b}`
  }
  const l = val('limit')
  const limit = l == null ? DEFAULT_LIMIT : Number(l)
  if (!Number.isInteger(limit) || limit < 1) return `--limit invalid: ${l}`
  return { tema, buget, limit, reduceri: argv.includes('--reduceri'), json: argv.includes('--json') }
}

const lei = (n: number | null) => {
  if (n == null) return '–'
  const d = Number.isInteger(n) ? 0 : 2
  return n.toLocaleString('ro-RO', { minimumFractionDigits: d, maximumFractionDigits: d })
}
const cut = (s: string, n: number) => s.length > n ? s.slice(0, n - 1) + '…' : s

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2))
  if (typeof args === 'string') {
    console.error(args)
    console.error('Utilizare: npm run cercetare -- --tema=<slug> [--buget=N] [--limit=N] [--reduceri] [--json]')
    return 1
  }

  // Categoria + toate subcategoriile ei (orice adâncime), fără arborii excluși.
  const cats = await pool.query<{ id: number; slug: string; name: string; excluded: boolean }>(`
    WITH RECURSIVE excluded AS (
      SELECT id FROM categories WHERE slug = ANY($2::text[])
      UNION SELECT c.id FROM categories c JOIN excluded e ON c.parent_id = e.id
    ), tree AS (
      SELECT id, slug, name FROM categories WHERE slug = $1
      UNION SELECT c.id, c.slug, c.name FROM categories c JOIN tree t ON c.parent_id = t.id
    )
    SELECT t.id, t.slug, t.name, (t.id IN (SELECT id FROM excluded)) AS excluded FROM tree t
  `, [args.tema, EXCLUDED_TREES])
  if (!cats.rows.length) {
    const roots = await pool.query<{ slug: string }>('SELECT slug FROM categories WHERE parent_id IS NULL ORDER BY sort_order, slug')
    console.error(`Tema „${args.tema}” nu există în categories. Părinți disponibili: ${roots.rows.map((r) => r.slug).join(', ')}`)
    return 1
  }
  const allowed = cats.rows.filter((c) => !c.excluded)
  if (!allowed.length) {
    console.error(`Tema „${args.tema}” e în Sănătate & Naturale / farmacie veterinară — exclusă (afirmații de sănătate, regula 8).`)
    return 1
  }
  const catIds = allowed.map((c) => c.id)

  // Produsele din temă cu măcar o ofertă disponibilă cu link afiliat (filtru ieftin, în SQL);
  // alegerea ofertei se face apoi în JS, cu regula testată.
  const prods = await pool.query<{ id: string; slug: string; name: string; brand: string | null; cat_slug: string; cat_name: string }>(`
    SELECT p.id, p.slug, p.name, p.brand, c.slug AS cat_slug, c.name AS cat_name
    FROM products p JOIN categories c ON c.id = p.category_id
    WHERE p.category_id = ANY($1::int[])
      AND EXISTS (
        SELECT 1 FROM offers o JOIN retailers r ON r.id = o.retailer_id
        WHERE o.product_id = p.id AND o.current_price IS NOT NULL
          AND o.affiliate_url IS NOT NULL AND btrim(o.affiliate_url) <> ''
          AND ${ALERT_OFFER_AVAILABLE_SQL}
      )
  `, [catIds])
  const productIds = prods.rows.map((p) => Number(p.id))
  const summaries = summarizeByProduct(await fetchProductOffers(pool, productIds))

  const candidates = prods.rows.flatMap((p) => {
    const s = summaries.get(Number(p.id))
    if (!s?.best || s.best.price == null) return []
    const best = s.best
    const bestPrice = best.price as number
    return [{
      id: Number(p.id), slug: p.slug, name: p.name, brand: p.brand,
      category: { slug: p.cat_slug, name: p.cat_name },
      bestPrice, retailer: best.retailerName, offerId: best.offerId,
      median30d: best.median30d, min30d: best.min30d, max30d: best.max30d, min90d: null as number | null,
      storeCount: s.storeCount, priceChanges60d: s.priceChanges60d,
      realDiscount: isRealDiscount(bestPrice, best.median30d),
      pctVsMedian: best.median30d ? Math.round((bestPrice / best.median30d - 1) * 1000) / 10 : null,
    }]
  })
  const filtered = candidates
    .filter((c) => withinBudget(c.bestPrice, args.buget))
    .filter((c) => !args.reduceri || c.realDiscount)
    .sort(compareCandidates)
  const shown = filtered.slice(0, args.limit)

  // Minimul pe 90 de zile, doar pentru produsele afișate — un singur query (partițiile vechi
  // de price_history sunt sărite datorită condiției pe recorded_at).
  if (shown.length) {
    const min90 = await pool.query<{ product_id: string; min_90d: number }>(`
      SELECT o.product_id, MIN(ph.price)::float AS min_90d
      FROM price_history ph JOIN offers o ON o.id = ph.offer_id
      WHERE o.product_id = ANY($1::bigint[]) AND ph.in_stock AND ph.recorded_at >= now() - INTERVAL '90 days'
      GROUP BY o.product_id
    `, [shown.map((c) => c.id)])
    const byId = new Map(min90.rows.map((r) => [Number(r.product_id), r.min_90d]))
    for (const c of shown) c.min90d = byId.get(c.id) ?? null
  }

  if (args.json) {
    console.log(JSON.stringify({
      tema: args.tema,
      categorii: allowed.map((c) => c.slug),
      buget: args.buget,
      doarReduceri: args.reduceri,
      generatLa: new Date().toISOString(),
      candidatiTotal: candidates.length,
      dupaFiltre: filtered.length,
      produse: shown,
    }, null, 2))
    return 0
  }

  console.log(`Tema: ${args.tema} (${allowed.length} categorii) · candidați disponibili cu afiliat: ${candidates.length}` +
    (args.buget != null ? ` · buget ≤ ${lei(args.buget)} lei` : '') + (args.reduceri ? ' · doar reduceri reale' : '') +
    ` · după filtre: ${filtered.length} · afișate: ${shown.length}`)
  console.log('Prețuri în lei. Med/min/max 30z = ale ofertei alese; min 90z = toate ofertele produsului; mag = magazine disponibile; sch = schimbări de preț în 60 de zile; R = reducere reală.\n')
  const header = ['#', 'preț', 'magazin', 'med 30z', 'min 30z', 'max 30z', 'min 90z', 'mag', 'sch', 'R', 'marcă', 'produs', 'slug']
  const rows = shown.map((c, i) => [
    String(i + 1), lei(c.bestPrice), cut(c.retailer, 14), lei(c.median30d), lei(c.min30d), lei(c.max30d), lei(c.min90d),
    String(c.storeCount), String(c.priceChanges60d), c.realDiscount ? 'R' : '', cut(c.brand ?? '–', 12), cut(c.name, 48), c.slug,
  ])
  const right = new Set([0, 1, 3, 4, 5, 6, 7, 8])
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)))
  const fmt = (r: string[]) => r.map((v, i) => i === r.length - 1 ? v : right.has(i) ? v.padStart(widths[i]) : v.padEnd(widths[i])).join('  ')
  console.log(fmt(header))
  console.log(widths.map((w, i) => '-'.repeat(i === widths.length - 1 ? 4 : w)).join('  '))
  for (const r of rows) console.log(fmt(r))
  if (!shown.length) console.log('(niciun produs)')
  return 0
}

main()
  .then(async (code) => { await pool.end(); process.exit(code) })
  .catch(async (err) => { console.error(err); await pool.end().catch(() => {}); process.exit(1) })
