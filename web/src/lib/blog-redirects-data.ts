import pool from './db'
import { buildProductGuides, type ProductGuideRow, type RedirectData } from './blog-redirects'

// Datele pentru redirecturile /p/ → articol (lib/blog-redirects.ts): TOATA harta
// „slug produs → articol publicat” + lista articolelor publicate, citite din DB cel mult o data
// pe minut (doua query-uri mici: zeci–sute de randuri). Avantaj fata de un query per cerere:
// valurile de roboti pe ~18.000 de adrese /p/ vechi nu ating DB-ul deloc.
//
// De ce 60 s si nu 10 min: un 410 e „permanent” pentru Google. Dupa publicarea unui articol,
// produsele din el pot primi 410 cel mult cat dureaza cache-ul — tinem fereastra scurta.
// (Proxy-ul are bundle propriu in Next 16, deci adminul nu poate goli cache-ul de aici.)
//
// La eroare de DB: intoarcem ultima harta reusita marcata `fresh: false` (sau null daca n-am
// avut niciodata una). Apelantii servesc 308 din harta veche, dar NU dau 410 pe date vechi
// sau lipsa — raspund 503 + Retry-After (vezi src/proxy.ts).

const TTL_MS = 60_000

let cached: { data: RedirectData; loadedAt: number } | null = null
let inflight: Promise<RedirectData> | null = null

async function load(): Promise<RedirectData> {
  const [links, guides] = await Promise.all([
    pool.query<ProductGuideRow>(`
      SELECT p.slug AS product_slug, g.slug AS guide_slug, g.updated_at, g.id AS guide_id
      FROM guide_products gp
      JOIN guides g ON g.id = gp.guide_id AND g.status = 'published'
      JOIN products p ON p.id = gp.product_id
    `),
    pool.query<{ slug: string }>(`SELECT slug FROM guides WHERE status = 'published'`),
  ])
  return {
    productGuides: buildProductGuides(links.rows),
    publishedGuides: new Set(guides.rows.map((r) => r.slug)),
  }
}

export async function getRedirectData(): Promise<{ data: RedirectData; fresh: boolean } | null> {
  if (cached && Date.now() - cached.loadedAt < TTL_MS) return { data: cached.data, fresh: true }
  try {
    // O singura reincarcare odata, oricate cereri sosesc simultan
    inflight ??= load().finally(() => { inflight = null })
    const data = await inflight
    cached = { data, loadedAt: Date.now() }
    return { data, fresh: true }
  } catch (err) {
    console.error('[blog-redirects] harta articol ↔ produs indisponibila:', (err as Error).message)
    return cached ? { data: cached.data, fresh: false } : null
  }
}
