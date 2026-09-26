import { Worker, Job } from 'bullmq'
import pino from 'pino'
import { tmpdir } from 'os'
import { join } from 'path'
import { unlink } from 'fs/promises'
import pool from '../lib/db.js'
import { ensurePriceHistoryPartitions } from '../lib/partitions.js'
import { markStaleOffers } from '../lib/stale.js'
import { updateRetailerStatuses } from '../lib/retailer-status.js'
import { refreshOfferPriceStats } from '../lib/price-stats.js'
import { connection } from '../lib/queue.js'
import { getAdvertisers, getFeeds, getProductsByPartNo, PsApiError, type PsAdvertiser, type PsFeed } from '../lib/profitshare.js'
import { downloadFeed, parseFeedFile, mapFeedRow } from '../importers/feed.js'
import { parseTpFeed, mapTpFeedRow } from '../importers/twoperformant-feed.js'
import { upsertProduct, upsertOfferPrice, upsertRetailerByDomain } from '../lib/upsert.js'
import { loadFeedRules, type RuleLookup } from '../lib/feedRules.js'
import { resolver, syncAffiliateAdvertisers, extractDomain } from '../lib/affiliate/index.js'
import { isBlockedImageHost, blockedImageHostRegex } from '../lib/images.js'
import type { ImportedProduct } from '../lib/types.js'
import { toSlug } from '../lib/slug.js'
import { checkAndSendAlerts } from './alerts.worker.js'

const logger = pino({ level: 'info' })

export type SyncJobData =
  | { type: 'feed-sync' }
  | { type: 'price-check' }
  | { type: 'price-snapshot' }
  | { type: 'image-backfill' }
  | { type: 'file-import'; filePath: string; retailerSlug?: string; filename?: string }
  | { type: 'scrape'; scraperName: string }
  | { type: 'catalog-refresh' }

// Sub acest prag (fata de sincronizarea anterioara) un feed e considerat suspect si respins.
const MIN_FEED_RATIO = 0.5
// Cate produse prioritare verificam prin API per rulare (60 cereri/min => ~3 min la 150).
const PRICE_CHECK_LIMIT = parseInt(process.env.PRICE_CHECK_LIMIT || '150')
// Cate imagini blocate reparam prin API per rulare (60 cereri/min => ~10 min la 600).
const IMAGE_BACKFILL_LIMIT = parseInt(process.env.IMAGE_BACKFILL_LIMIT || '600')
// Ofertele nevazute in feed-uri de atatea zile se marcheaza fara stoc (istoricul ramane).
const STALE_OFFER_DAYS = 3

// --- Retaileri din advertiseri Profitshare ---------------------------------

// "eMAG.ro" -> "emag", "Karcher.com/ro/ro" -> "karcher" (pastreaza slugurile existente)
export function advertiserSlug(name: string): string {
  return toSlug(name.toLowerCase().replace(/\.(ro|com|net|eu|org|travel|shop)([/.].*)?$/i, ''))
}

async function upsertRetailer(adv: PsAdvertiser): Promise<number> {
  const slug = advertiserSlug(adv.name)
  const logo = adv.logo?.startsWith('//') ? 'https:' + adv.logo : adv.logo || null
  const config = JSON.stringify({ advertiserHash: adv.advertiser_identifier, affiliateHash: adv.affiliate_identifier })

  // Intai dupa ps_advertiser_id, apoi dupa slug (leaga retailerii istorici), apoi INSERT
  const byPsId = await pool.query<{ id: number }>(`
    UPDATE retailers SET name = $2, logo_url = $3, is_active = true,
      scraper_config = coalesce(scraper_config, '{}'::jsonb) || $4::jsonb
    WHERE ps_advertiser_id = $1 RETURNING id
  `, [adv.id, adv.name, logo, config])
  if (byPsId.rows[0]) return byPsId.rows[0].id

  const bySlug = await pool.query<{ id: number }>(`
    UPDATE retailers SET ps_advertiser_id = $2, name = $3, logo_url = $4, is_active = true,
      scraper_config = coalesce(scraper_config, '{}'::jsonb) || $5::jsonb
    WHERE slug = $1 RETURNING id
  `, [slug, adv.id, adv.name, logo, config])
  if (bySlug.rows[0]) return bySlug.rows[0].id

  const inserted = await pool.query<{ id: number }>(`
    INSERT INTO retailers (name, slug, base_url, scraper_config, is_active, ps_advertiser_id, logo_url)
    VALUES ($1, $2, $3, $4::jsonb, true, $5, $6) RETURNING id
  `, [adv.name, slug, adv.url, config, adv.id, logo])
  return inserted.rows[0].id
}

async function recordFeedSync(params: {
  feedLink: string
  feedName: string | null
  psUpdatedAt: Date | null
  productsCount: number
  status: 'success' | 'rejected'
  source: 'profitshare' | 'upload' | 'scraper' | 'snapshot' | '2performant'
  filename?: string | null
  unmappedCount?: number | null
  retailerId?: number | null   // magazinul atins (pentru starea din Admin → Magazine & surse)
}): Promise<void> {
  await pool.query(`
    INSERT INTO feed_syncs (feed_link, feed_name, ps_updated_at, products_count, status, source, filename, unmapped_count, retailer_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
  `, [params.feedLink, params.feedName, params.psUpdatedAt, params.productsCount,
      params.status, params.source, params.filename ?? null, params.unmappedCount ?? null,
      params.retailerId ?? null])
}

// Mediana/ultimul pret precalculate pentru site (offer_price_stats, migratia 019) — dupa orice
// scriere in price_history. Best-effort: o eroare aici nu trebuie sa pice jobul.
async function refreshPriceStats(log: pino.Logger): Promise<void> {
  try {
    const t = Date.now()
    const rows = await refreshOfferPriceStats()
    log.info({ rows, ms: Date.now() - t }, 'Statistici pret recalculate')
  } catch (err) {
    log.error({ err }, 'Recalculare statistici pret esuata')
  }
}

// Verifica afilierea pe baza domeniului si suprascrie linkul/reteaua produsului.
// Daca rezolverul nu gaseste un advertiser, pastram ce a setat mapFeedRow (linkul din
// feed, daca exista) — altfel produsul ramane neafiliat si se afiseaza fara comision.
function applyAffiliate(product: ImportedProduct): void {
  const aff = resolver.resolve(product.url)
  if (aff) {
    product.affiliateUrl = aff.affiliateUrl
    product.affiliateNetwork = aff.network
  }
}

// --- Sincronizare feed-uri ---------------------------------------------------

async function syncOneFeed(
  feed: PsFeed,
  advertisersById: Map<string, PsAdvertiser>,
  resolveRule: RuleLookup,
): Promise<{ imported: number; errors: number } | 'skipped' | 'rejected'> {
  const log = logger.child({ feed: feed.name, type: feed.type })

  // Descarcam doar feed-urile regenerate de la ultima sincronizare reusita
  const last = await pool.query<{ ps_updated_at: Date | null; products_count: number | null }>(`
    SELECT ps_updated_at, products_count FROM feed_syncs
    WHERE feed_link = $1 AND status = 'success'
    ORDER BY synced_at DESC LIMIT 1
  `, [feed.link])
  const lastSync = last.rows[0]
  const feedUpdatedAt = new Date(feed.updated_at.replace(' ', 'T') + 'Z')
  if (lastSync?.ps_updated_at && new Date(lastSync.ps_updated_at) >= feedUpdatedAt) {
    log.info('Feed neschimbat — sarit')
    return 'skipped'
  }

  // Retailerii pentru advertiserii din feed (creati automat daca lipsesc)
  const retailerByName = new Map<string, number>()
  for (const fa of feed.advertisers) {
    const adv = advertisersById.get(String(fa.id))
    if (!adv) { log.warn({ advertiser: fa.name }, 'Advertiser din feed lipseste din lista de advertiseri'); continue }
    const retailerId = await upsertRetailer(adv)
    retailerByName.set(adv.name.toLowerCase(), retailerId)
  }
  if (!retailerByName.size) return 'rejected'

  const tmpFile = join(tmpdir(), `ps-feed-${Date.now()}.${feed.type}`)
  try {
    log.info('Descarcare feed...')
    await downloadFeed(feed.link, tmpFile)

    // Pasul 1: numaram randurile valide — nu atingem DB-ul daca feed-ul pare trunchiat
    let validCount = 0
    for await (const row of parseFeedFile(tmpFile, feed.type)) {
      if (mapFeedRow(row)) validCount++
    }
    if (lastSync?.products_count && validCount < lastSync.products_count * MIN_FEED_RATIO) {
      log.error({ validCount, previous: lastSync.products_count }, 'Feed suspect (sub 50% din sincronizarea anterioara) — respins')
      await recordFeedSync({
        feedLink: feed.link, feedName: feed.name, psUpdatedAt: feedUpdatedAt,
        productsCount: validCount, status: 'rejected', source: 'profitshare',
        retailerId: retailerByName.values().next().value ?? null,
      })
      return 'rejected'
    }

    // Pasul 2: import efectiv
    let imported = 0, errors = 0, unmapped = 0
    for await (const row of parseFeedFile(tmpFile, feed.type)) {
      const product = mapFeedRow(row)
      if (!product) continue
      const retailerId = (retailerByName.get(row.advertiserName.toLowerCase())
        ?? retailerByName.values().next().value)!
      const rule = resolveRule(retailerId, product.feedCategory)
      if (!rule) unmapped++
      applyAffiliate(product)
      try {
        await upsertProduct(product, retailerId, rule)
        imported++
      } catch (err) {
        errors++
        if (errors <= 5) log.error({ slug: product.slug, err }, 'Eroare upsert produs')
      }
    }

    // Ofertele disparute din feed de mai multe zile raman in DB, dar fara stoc
    for (const retailerId of retailerByName.values()) {
      await pool.query(`
        UPDATE offers SET in_stock = false
        WHERE retailer_id = $1 AND in_stock = true
          AND last_checked < now() - make_interval(days => $2)
      `, [retailerId, STALE_OFFER_DAYS])
    }

    await recordFeedSync({
      feedLink: feed.link, feedName: feed.name, psUpdatedAt: feedUpdatedAt,
      productsCount: imported, status: 'success', source: 'profitshare', unmappedCount: unmapped,
      retailerId: retailerByName.values().next().value ?? null,
    })

    log.info({ imported, errors, unmapped }, 'Feed importat')
    return { imported, errors }
  } finally {
    await unlink(tmpFile).catch(() => {})
  }
}

// Import dintr-un fisier de feed local (XML/CSV in formatul Profitshare) — plasa de
// siguranta cand feed-ul nu poate fi descarcat. Retailerul se identifica din adv_name
// (rezolvat in DB), sau explicit prin retailerSlug.
export async function runFileImport(filePath: string, retailerSlug?: string, jobId = 'direct', filename?: string) {
  const log = logger.child({ job: jobId, task: 'file-import', file: filePath })
  const startTime = Date.now()

  const resolveRule = await loadFeedRules()
  await resolver.refresh()  // import standalone: harta de advertiseri poate fi neincarcata
  const type = filePath.toLowerCase().endsWith('.csv') ? 'csv' : 'xml'

  const { rows: retailers } = await pool.query<{ id: number; name: string; slug: string }>(
    'SELECT id, name, slug FROM retailers'
  )
  const byName = new Map(retailers.map((r) => [r.name.toLowerCase(), r.id]))
  const bySlug = new Map(retailers.map((r) => [r.slug, r.id]))
  const forcedRetailerId = retailerSlug ? bySlug.get(retailerSlug) : undefined
  if (retailerSlug && !forcedRetailerId) {
    throw new Error(`Retailerul '${retailerSlug}' nu exista in DB`)
  }

  log.info({ type }, 'Import din fisier pornit')
  let imported = 0, errors = 0, skipped = 0, unmapped = 0
  const touchedRetailers = new Set<number>()

  for await (const row of parseFeedFile(filePath, type)) {
    const product = mapFeedRow(row)
    if (!product) continue
    const retailerId = forcedRetailerId
      ?? byName.get(row.advertiserName.toLowerCase())
      ?? bySlug.get(advertiserSlug(row.advertiserName))
    if (!retailerId) {
      skipped++
      if (skipped === 1) log.warn({ advertiser: row.advertiserName }, 'Advertiser necunoscut — randuri sarite (foloseste --retailer=<slug>)')
      continue
    }
    const rule = resolveRule(retailerId, product.feedCategory)
    if (!rule) unmapped++
    applyAffiliate(product)
    try {
      await upsertProduct(product, retailerId, rule)
      touchedRetailers.add(retailerId)
      imported++
    } catch (err) {
      errors++
      if (errors <= 5) log.error({ slug: product.slug, err }, 'Eroare upsert produs')
    }
  }

  for (const retailerId of touchedRetailers) {
    await pool.query(`
      UPDATE offers SET in_stock = false
      WHERE retailer_id = $1 AND in_stock = true
        AND last_checked < now() - make_interval(days => $2)
    `, [retailerId, STALE_OFFER_DAYS])
  }

  await recordFeedSync({
    feedLink: `upload:${filename ?? filePath}`, feedName: filename ?? filePath.split('/').pop() ?? null,
    psUpdatedAt: null, productsCount: imported, status: 'success', source: 'upload',
    filename: filename ?? null, unmappedCount: unmapped,
    retailerId: touchedRetailers.values().next().value ?? null,
  })

  const duration = ((Date.now() - startTime) / 1000).toFixed(1)
  await refreshPriceStats(log)
  log.info({ imported, errors, skipped, unmapped, duration: `${duration}s` }, 'Import din fisier finalizat')
  return { imported, errors, skipped, unmapped, duration }
}

export async function runFeedSync(jobId = 'direct') {
  const log = logger.child({ job: jobId, task: 'feed-sync' })
  const startTime = Date.now()

  const [advertisers, feeds, resolveRule] = await Promise.all([
    getAdvertisers(),
    getFeeds(),
    loadFeedRules(),
  ])

  // Populeaza harta domeniu->advertiser (toate retelele) si o incarca in rezolver,
  // ca afilierea sa se verifice la fiecare produs cu date proaspete.
  await syncAffiliateAdvertisers()
  await resolver.refresh()

  const advertisersById = new Map(advertisers.map((a) => [String(a.id), a]))
  const activeFeeds = feeds.filter((f) => f.status === 'active')
  log.info({ feeds: activeFeeds.length, advertisers: advertisers.length }, 'Sincronizare feed-uri pornita')

  let totalImported = 0, totalErrors = 0, synced = 0
  for (const feed of activeFeeds) {
    try {
      const result = await syncOneFeed(feed, advertisersById, resolveRule)
      if (typeof result === 'object') {
        totalImported += result.imported
        totalErrors += result.errors
        synced++
      }
    } catch (err) {
      totalErrors++
      log.error({ feed: feed.name, err }, 'Eroare sincronizare feed')
    }
  }

  // Feed-uri externe (produse 2Performant per advertiser), dupa feed-urile Profitshare.
  const external = await syncExternalFeeds(resolveRule)
  totalImported += external.imported
  totalErrors += external.errors

  // Bulk-ul catch-all (CITGrup: refurbished/second-hand cu tipuri amestecate sub o singura
  // categorie de feed) se imparte pe tip dupa denumire + tag de conditie. Best-effort:
  // functia e creata de migratia 015; daca lipseste, sync-ul nu trebuie sa cada.
  try {
    await pool.query('SELECT reclassify_catchall_products()')
  } catch (err) {
    log.warn({ err }, 'Reclasificare catch-all esuata (migratia 015 aplicata?)')
  }

  // Dupa ce preturile proaspete au fost importate, consemneaza istoricul zilnic pentru toate
  // ofertele cu pret (foloseste pretul curent proaspat — fara snapshot stale, fara resync).
  // Garda de 20h din runPriceSnapshot sare peste ofertele deja consemnate de feed-sync.
  // Siguranta globala: orice oferta negasita de OFFER_STALE_DAYS in NICIUN feed/scanare trece
  // pe „fara stoc” — indiferent daca feed-ul retailerului a reusit, a fost respins sau a
  // disparut (altfel ofertele unui feed mort raman afisate la infinit cu pret vechi).
  const stale = await markStaleOffers()
  log.info({ hidden: stale }, 'Oferte vechi marcate fara stoc (global)')

  // Starea fiecarui magazin (Admin → Magazine & surse) + avertizare Telegram la schimbari.
  // Magazinele acoperite azi de un feed Profitshare activ; cele care aveau feed si nu mai
  // apar aici au feed-ul dezactivat/sters de retea.
  try {
    const profitshareCoveredIds = new Set<number>()
    for (const feed of activeFeeds) {
      for (const fa of feed.advertisers) {
        const adv = advertisersById.get(String(fa.id))
        if (adv) profitshareCoveredIds.add(await upsertRetailer(adv))
      }
    }
    await updateRetailerStatuses({ profitshareCoveredIds })
  } catch (err) {
    log.error({ err }, 'Calcul stare magazine esuat')   // nu opreste snapshot-ul de preturi
  }

  const snapshot = await runPriceSnapshot(jobId)

  const duration = ((Date.now() - startTime) / 1000).toFixed(1)
  log.info({ synced, totalImported, totalErrors, external: external.imported, snapshot: snapshot.recorded, duration: `${duration}s` }, 'Sincronizare feed-uri finalizata')
  return { synced, imported: totalImported, errors: totalErrors, external: external.imported, snapshot: snapshot.recorded, duration }
}

// --- Verificare rapida de pret prin API (filters[part_no]) -------------------

export async function runPriceCheck(jobId = 'direct') {
  const log = logger.child({ job: jobId, task: 'price-check' })
  const startTime = Date.now()

  await resolver.refresh()  // harta de advertiseri pentru afiliere

  // Produse prioritare: cu alerte active sau accesate recent, care au cod de produs
  const candidates = await pool.query<{ id: string; part_no: string; brand: string | null; slug: string }>(`
    SELECT DISTINCT p.id, p.part_no, p.brand, p.slug
    FROM products p
    WHERE p.part_no IS NOT NULL AND (
      EXISTS (
        SELECT 1 FROM price_alerts pa JOIN offers o ON o.id = pa.offer_id
        WHERE o.product_id = p.id AND pa.is_active = true AND pa.triggered_at IS NULL
      )
      OR EXISTS (
        SELECT 1 FROM click_events ce JOIN offers o2 ON o2.id = ce.offer_id
        WHERE o2.product_id = p.id AND ce.clicked_at > now() - interval '7 days'
      )
    )
    LIMIT $1
  `, [PRICE_CHECK_LIMIT])

  log.info({ candidates: candidates.rows.length }, 'Verificare preturi pornita')

  const retailers = await pool.query<{ id: number; ps_advertiser_id: number }>(`
    SELECT id, ps_advertiser_id FROM retailers WHERE ps_advertiser_id IS NOT NULL
  `)
  const retailerByAdvId = new Map(retailers.rows.map((r) => [r.ps_advertiser_id, r]))

  let updated = 0, errors = 0
  for (const candidate of candidates.rows) {
    try {
      const { products } = await getProductsByPartNo(candidate.part_no)
      for (const psProduct of products) {
        const retailer = retailerByAdvId.get(psProduct.advertiser_id)
        if (!retailer || !psProduct.price_vat) continue

        // Oferte noi doar daca brandul produsului apare in numele din API —
        // SKU-urile interne ale advertiserilor pot coincide pentru produse diferite
        const existing = await pool.query(`
          SELECT 1 FROM offers WHERE product_id = $1 AND retailer_id = $2
        `, [candidate.id, retailer.id])
        if (!existing.rows.length) {
          const brandOk = candidate.brand && psProduct.name.toLowerCase().includes(candidate.brand.toLowerCase())
          if (!brandOk) continue
        }

        // Afilierea se rezolva pe domeniu (comision maxim intre retele); fara afiliere
        // oferta se salveaza oricum, cu link brut.
        const aff = resolver.resolve(psProduct.link)
        await upsertOfferPrice(
          candidate.id, retailer.id, psProduct.price_vat, psProduct.link,
          aff?.affiliateUrl ?? null, aff?.network ?? null,
        )
        updated++
      }
    } catch (err) {
      errors++
      if (errors <= 5) log.error({ partNo: candidate.part_no, err }, 'Eroare verificare pret')
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1)
  if (updated > 0) await refreshPriceStats(log)
  log.info({ checked: candidates.rows.length, updated, errors, duration: `${duration}s` }, 'Verificare preturi finalizata')
  return { checked: candidates.rows.length, updated, errors, duration }
}

// --- Backfill imagini (CDN-uri blocate de Cloudflare) ------------------------

// Repara imaginile produselor de la retaileri cu CDN blocat (forit.ro, vexio.ro): feed-ul da doar
// URL-uri blocate (403 in browser), asa ca luam imaginea de pe CDN-ul Profitshare (profitsmart.ro)
// prin API-ul affiliate-products si o salvam. Tinteste produsele fara imagine sau cu imagine blocata.
// Ruleaza o data (backfill istoric) si periodic (produse noi ramase fara imagine dupa feed-sync).
export async function runImageBackfill(jobId = 'direct') {
  const log = logger.child({ job: jobId, task: 'image-backfill' })
  const startTime = Date.now()

  // Produse cu cod de produs care nu au o imagine utilizabila (lipsa sau pe host blocat),
  // impreuna cu advertiserii Profitshare de la care sunt vandute (pentru a alege imaginea corecta).
  const candidates = await pool.query<{ id: string; part_no: string; brand: string | null; adv_ids: number[] }>(`
    SELECT p.id, p.part_no, p.brand,
           array_agg(DISTINCT r.ps_advertiser_id) FILTER (WHERE r.ps_advertiser_id IS NOT NULL) AS adv_ids
    FROM products p
    JOIN offers o ON o.product_id = p.id
    JOIN retailers r ON r.id = o.retailer_id
    WHERE p.part_no IS NOT NULL
      AND (p.image_url IS NULL OR p.image_url ~ $1)
    GROUP BY p.id
    LIMIT $2
  `, [blockedImageHostRegex(), IMAGE_BACKFILL_LIMIT])

  log.info({ candidates: candidates.rows.length }, 'Backfill imagini pornit')

  // La depasirea limitei API (60/60s) asteptam si reincercam, altfel produsele lovite de
  // rate-limit ar ramane nereparate pana la urmatoarea rulare.
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
  async function fetchProducts(partNo: string) {
    for (let attempt = 0; ; attempt++) {
      try {
        return await getProductsByPartNo(partNo)
      } catch (err) {
        if (err instanceof PsApiError && err.code === 'TOO_MANY_REQUESTS' && attempt < 3) {
          await sleep(61000)
          continue
        }
        throw err
      }
    }
  }

  let updated = 0, cleared = 0, notFound = 0, errors = 0
  for (const c of candidates.rows) {
    try {
      const { products } = await fetchProducts(c.part_no)
      const advIds = new Set(c.adv_ids ?? [])
      // Preferam imaginea de la un advertiser al produsului; altfel una care confirma brandul
      // (SKU-urile advertiserilor pot coincide pentru produse diferite). Doar imagini ne-blocate.
      const usable = products.filter((p) => p.image && !isBlockedImageHost(p.image))
      const byAdv = usable.find((p) => advIds.has(p.advertiser_id))
      const byBrand = usable.find((p) =>
        c.brand && p.name.toLowerCase().includes(c.brand.toLowerCase()))
      // API-ul intoarce URL-uri http://; le urcam la https ca sa nu fie blocate ca mixed-content.
      const image = (byAdv?.image ?? byBrand?.image ?? null)?.replace(/^http:\/\//, 'https://') ?? null
      if (image) {
        await pool.query('UPDATE products SET image_url = $2, updated_at = now() WHERE id = $1', [c.id, image])
        updated++
      } else {
        // Fara alternativa in API: golim URL-ul blocat ca sa apara placeholder-ul curat in loc de
        // imagine rupta. Ramane candidat la rulari viitoare daca API-ul o reindexeaza (image_url NULL).
        const res = await pool.query(
          `UPDATE products SET image_url = NULL, updated_at = now() WHERE id = $1 AND image_url ~ $2`,
          [c.id, blockedImageHostRegex()])
        if (res.rowCount) cleared++
        notFound++
      }
    } catch (err) {
      errors++
      if (errors <= 5) log.error({ partNo: c.part_no, err }, 'Eroare backfill imagine')
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1)
  log.info({ checked: candidates.rows.length, updated, cleared, notFound, errors, duration: `${duration}s` }, 'Backfill imagini finalizat')
  return { checked: candidates.rows.length, updated, cleared, notFound, errors, duration }
}

// --- Feed-uri externe (produse 2Performant per advertiser) -------------------

// Importa feed-urile configurate in external_feeds (format 2Performant: <items><item>).
// Produsele vin deja afiliate (aff_code din feed); retailerul se deduce din campaign_name.
export async function syncExternalFeeds(resolveRule: RuleLookup): Promise<{ imported: number; errors: number }> {
  const log = logger.child({ task: 'external-feeds' })
  const { rows: feeds } = await pool.query<{ url: string; network: string; label: string | null }>(
    `SELECT url, network, label FROM external_feeds WHERE is_active = true AND network = '2performant'`
  )
  let totalImported = 0, totalErrors = 0

  for (const feed of feeds) {
    const tmpFile = join(tmpdir(), `tp-feed-${Date.now()}.xml`)
    const retailerByDomain = new Map<string, number>()
    let imported = 0, errors = 0
    try {
      await downloadFeed(feed.url, tmpFile)
      for await (const row of parseTpFeed(tmpFile)) {
        const product = mapTpFeedRow(row)
        if (!product) continue
        const domain = extractDomain(row.campaignName)
        if (!domain) continue
        let retailerId = retailerByDomain.get(domain)
        if (retailerId === undefined) {
          retailerId = await upsertRetailerByDomain(domain, row.campaignName.trim())
          retailerByDomain.set(domain, retailerId)
        }
        const rule = resolveRule(retailerId, product.feedCategory)
        try {
          await upsertProduct(product, retailerId, rule)
          imported++
        } catch (err) {
          errors++
          if (errors <= 5) log.error({ slug: product.slug, err }, 'Eroare upsert produs 2P')
        }
      }
      // Ofertele disparute din feed de mai multe zile -> fara stoc
      for (const retailerId of retailerByDomain.values()) {
        await pool.query(`
          UPDATE offers SET in_stock = false
          WHERE retailer_id = $1 AND in_stock = true AND last_checked < now() - make_interval(days => $2)
        `, [retailerId, STALE_OFFER_DAYS])
      }
      await recordFeedSync({
        feedLink: feed.url, feedName: feed.label, psUpdatedAt: null,
        productsCount: imported, status: 'success', source: '2performant',
        retailerId: retailerByDomain.values().next().value ?? null,
      })
      log.info({ feed: feed.label, imported, errors }, 'Feed 2Performant importat')
      totalImported += imported; totalErrors += errors
    } catch (err) {
      totalErrors++
      log.error({ feed: feed.label, err }, 'Eroare import feed 2Performant')
    } finally {
      await unlink(tmpFile).catch(() => {})
    }
  }
  return { imported: totalImported, errors: totalErrors }
}

// --- Snapshot zilnic de preturi (construieste istoricul) ---------------------

// Creeaza partitiile lunare lipsa pentru price_history (luna curenta + urmatoarele 2).
// Migratia 002 le creeaza doar la instalare; ruland zilnic, nu ramanem niciodata fara
// partitia lunii in care urmeaza sa scriem.

// Inregistreaza un punct de istoric pentru FIECARE oferta cu pret, o data pe zi.
// Independent de feed-uri si de API — acopera si ofertele din feed-uri nesincronizate sau
// scrapate, ca seria zilnica de preturi sa fie continua (scopul principal al site-ului).
// Garda de 20h evita dublarea cand pretul a fost deja consemnat azi de feed-sync/price-check.
export async function runPriceSnapshot(jobId = 'direct') {
  const log = logger.child({ job: jobId, task: 'price-snapshot' })
  const startTime = Date.now()
  await ensurePriceHistoryPartitions()

  const res = await pool.query(`
    INSERT INTO price_history (offer_id, price, in_stock, recorded_at)
    SELECT o.id, o.current_price, o.in_stock, now()
    FROM offers o
    WHERE o.current_price IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM price_history ph
        WHERE ph.offer_id = o.id AND ph.recorded_at > now() - interval '20 hours'
      )
    ON CONFLICT DO NOTHING
  `)
  const recorded = res.rowCount ?? 0

  // Apare in "Prospetime feed/scraper" si "Sincronizari recente" din admin.
  await recordFeedSync({
    feedLink: 'price-snapshot', feedName: 'Snapshot preturi (zilnic)', psUpdatedAt: null,
    productsCount: recorded, status: 'success', source: 'snapshot',
  })

  // Snapshot-ul e ultima scriere zilnica in istoric (si finalul feed-sync-ului)
  await refreshPriceStats(log)

  const duration = ((Date.now() - startTime) / 1000).toFixed(1)
  log.info({ recorded, duration: `${duration}s` }, 'Snapshot preturi finalizat')
  return { recorded, duration }
}

// --- Scraping site-uri fara feed ---------------------------------------------

// Improspateaza catalogul de categorii disponibile (selectorul din admin/scraper-categorii).
export async function runCatalogRefresh(jobId = 'direct') {
  const log = logger.child({ job: jobId, task: 'catalog-refresh' })
  const { syncEmagCategoryCatalog } = await import('../scrapers/emag-catalog.js')
  const result = await syncEmagCategoryCatalog()
  log.info(result, 'Catalog categorii actualizat')
  return result
}

export async function runScrape(scraperName: string, jobId = 'direct') {
  const log = logger.child({ job: jobId, task: 'scrape', scraper: scraperName })
  const { getScraper, ingestScraper } = await import('../scrapers/ingest.js')
  const scraper = getScraper(scraperName)
  if (!scraper) throw new Error(`Scraper necunoscut: '${scraperName}'`)
  const result = await ingestScraper(scraper)
  const { rows: ret } = await pool.query<{ id: number }>('SELECT id FROM retailers WHERE slug = $1', [scraper.name])

  // Jurnalizeaza verificarea (apare in "Prospetime feed/scraper" din admin).
  await recordFeedSync({
    feedLink: `scraper:${scraper.name}`, feedName: scraper.name, psUpdatedAt: null,
    productsCount: result.imported, status: 'success', source: 'scraper',
    retailerId: ret[0]?.id ?? null,
  })

  if (result.imported > 0) await refreshPriceStats(log)
  log.info(result, 'Scraping finalizat')
  return result
}

// --- Worker BullMQ ------------------------------------------------------------

async function invalidateSiteCache() {
  const siteUrl = process.env.SITE_URL
  const secret = process.env.REVALIDATE_SECRET
  if (!siteUrl || !secret) return
  const res = await fetch(`${siteUrl}/api/revalidate`, {
    method: 'POST',
    headers: { 'x-revalidate-secret': secret },
    signal: AbortSignal.timeout(30000),  // fara timeout, un site nereactiv ar tine workerul agatat
  })
  if (res.ok) logger.info('Cache site invalidat')
  else logger.warn({ status: res.status }, 'Cache invalidation esuat')
}

export function startSyncWorker() {
  const worker = new Worker<SyncJobData>(
    'sync',
    async (job: Job<SyncJobData>) =>
      job.data.type === 'price-check' ? runPriceCheck(job.id)
        : job.data.type === 'price-snapshot' ? runPriceSnapshot(job.id)
        : job.data.type === 'image-backfill' ? runImageBackfill(job.id)
        : job.data.type === 'scrape' ? runScrape(job.data.scraperName, job.id)
        : job.data.type === 'catalog-refresh' ? runCatalogRefresh(job.id)
        : job.data.type === 'file-import' ? runFileImport(job.data.filePath, job.data.retailerSlug, job.id, job.data.filename)
            .finally(() => unlink((job.data as { filePath: string }).filePath).catch(() => {}))
        : runFeedSync(job.id),
    {
      connection,
      concurrency: 1,
      settings: { backoffStrategy: (attempt) => Math.min(attempt * 5000, 60000) },
    }
  )

  worker.on('failed', (job, err) => {
    logger.error({ job: job?.id, err }, 'Job esuat')
  })

  worker.on('completed', (job, result) => {
    logger.info({ job: job.id, ...result }, 'Job completat')
    checkAndSendAlerts().catch((err) => logger.error({ err }, 'Eroare verificare alerte'))
    invalidateSiteCache().catch((err) => logger.warn({ err }, 'Cache invalidation esuat'))
  })

  return worker
}
