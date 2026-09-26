import type pg from 'pg'
import { getCommissions, parseCommission, type PsCommissionRaw, type ParsedCommission } from '../lib/profitshare.js'
import { configFromEnv, uploadRetractions, AdsApiError, type AdsConfig } from '../ads/google-ads.js'
import { ingestConversion } from '../ads/data-manager.js'
import { planSync, formatRo, maskId, CLICK_WINDOW_DAYS, type ConversionRow, type SyncPlan } from './core.js'

// tracking:sync — comisioanele Profitshare → affiliate_conversions → Google Ads.
//
//   1. citeste comisioanele din ultimele 90 de zile (aprobarea vine dupa ~48–65 de zile);
//   2. upsert in affiliate_conversions + potrivire cu ad_clicks dupa click_id (campul `hash`);
//   3. comisioanele potrivite cu un click din reclama, CU acord „Publicitate”, netrimise inca →
//      conversie offline „Comision Profitshare” (valoare = comisionul, RON), prin Data Manager API;
//      se trimit inca din `pending` (Google invata mai repede) si se retrag daca se anuleaza;
//   4. comisioanele devenite anulate, deja trimise → RETRACTION (Google Ads API);
//   5. sterge gclid/gbraid/wbraid din clickurile mai vechi de 90 de zile (politica de confidentialitate).
//
// Moduri (REGULI.md, regulile 3 si 4):
//   plan     — implicit; pasii 1, 2, 5 (doar baza noastra) + ce AR trimite. Nimic la Google.
//   validate — ca `send`, dar fiecare cerere pleaca cu validate_only: Google verifica, NU aplica.
//              NU seteaza uploaded_at / retracted_at. Jobul automat ruleaza asa (decizia
//              proprietarului, 2026-09-26).
//   send     — trimitere reala. Doar cu ADS_ENV=prod (CLI: --prod --confirm).
// Idempotent: uploaded_at / retracted_at opresc retrimiterea; in plus Google deduplica dupa
// transactionId / orderId (= order_id Profitshare).

export type SyncMode = 'plan' | 'validate' | 'send'
type Db = pg.Pool | pg.PoolClient

export interface SyncOptions {
  mode: SyncMode
  db: Db
  days?: number
  fixture?: PsCommissionRaw[]            // in loc de API (teste) — refuzat in modul send
  conversionActionId?: string            // implicit GOOGLE_ADS_CONVERSION_ACTION_ID
  log?: (msg: string) => void
  // Doar pentru teste unitare: configuratie si apeluri Google inlocuite (fara retea)
  deps?: { cfg?: AdsConfig; ingest?: typeof ingestConversion; retract?: typeof uploadRetractions; fetchCommissions?: typeof getCommissions }
}

export interface SyncResult {
  mode: SyncMode
  read: number
  inserted: number
  updated: number
  unknownStatuses: string[]
  matched: number                        // comisioane legate de un click al nostru
  plan: { uploads: number; retractions: number; alreadyUploaded: number; valueChanged: number; skipped: SyncPlan['skipped'] }
  uploaded: number                       // trimise efectiv (send)
  validated: number                      // acceptate de Google cu validate_only
  retracted: number
  errors: { externalId: string; action: 'upload' | 'retract'; error: string }[]
  purgedClickIds: number
  googleSkipped?: string                 // de ce n-am contactat Google (config lipsa)
}

async function upsertCommissions(db: Db, items: { raw: PsCommissionRaw; p: ParsedCommission }[]) {
  let inserted = 0
  let updated = 0
  for (const { raw, p } of items) {
    // Se actualizeaza doar daca s-a schimbat ceva relevant (status, suma, click) — updated_at
    // ramane astfel un semnal util („ultima schimbare reala”).
    const r = await db.query<{ inserted: boolean }>(`
      INSERT INTO affiliate_conversions
        (network, external_id, click_id, ad_click_id, retailer_id, status, commission_amount, order_time, raw_payload)
      VALUES ('profitshare', $1, $2,
              (SELECT id FROM ad_clicks WHERE click_id = $2),
              (SELECT id FROM retailers WHERE ps_advertiser_id::text = $3 LIMIT 1),
              $4, $5, $6, $7)
      ON CONFLICT (network, external_id) DO UPDATE SET
        click_id = EXCLUDED.click_id,
        ad_click_id = COALESCE(EXCLUDED.ad_click_id, affiliate_conversions.ad_click_id),
        retailer_id = COALESCE(EXCLUDED.retailer_id, affiliate_conversions.retailer_id),
        status = EXCLUDED.status,
        commission_amount = EXCLUDED.commission_amount,
        order_time = EXCLUDED.order_time,
        raw_payload = EXCLUDED.raw_payload,
        updated_at = now()
      WHERE (affiliate_conversions.status, affiliate_conversions.commission_amount, affiliate_conversions.click_id,
             affiliate_conversions.ad_click_id, affiliate_conversions.order_time)
            IS DISTINCT FROM
            (EXCLUDED.status, EXCLUDED.commission_amount, EXCLUDED.click_id,
             COALESCE(EXCLUDED.ad_click_id, affiliate_conversions.ad_click_id), EXCLUDED.order_time)
      RETURNING (xmax = 0) AS inserted
    `, [p.externalId, p.clickId, p.advertiserId, p.status, p.amount, p.orderTime, JSON.stringify(raw)])
    if (r.rows[0]?.inserted === true) inserted++
    else if (r.rows[0]) updated++
  }
  return { inserted, updated }
}

async function loadRows(db: Db): Promise<ConversionRow[]> {
  // Fereastra ceva mai larga decat 90 de zile + orice trimis inca neretras (pentru retrageri)
  const { rows } = await db.query(`
    SELECT ac.id, ac.external_id, ac.status, ac.commission_amount::float AS amount, ac.order_time,
           ac.uploaded_at, ac.uploaded_value::float AS uploaded_value, ac.retracted_at,
           ac.click_id, ac.ad_click_id, c.has_ad_consent, c.gclid, c.gbraid, c.wbraid, c.created_at AS click_time
    FROM affiliate_conversions ac
    LEFT JOIN ad_clicks c ON c.id = ac.ad_click_id
    WHERE ac.network = 'profitshare'
      AND (ac.order_time > now() - interval '120 days' OR (ac.uploaded_at IS NOT NULL AND ac.retracted_at IS NULL))
    ORDER BY ac.order_time
  `)
  return rows.map((r: any) => ({
    id: Number(r.id), externalId: r.external_id, status: r.status, amount: r.amount, orderTime: r.order_time,
    uploadedAt: r.uploaded_at, uploadedValue: r.uploaded_value, retractedAt: r.retracted_at,
    clickId: r.click_id, adClickId: r.ad_click_id == null ? null : Number(r.ad_click_id),
    hasAdConsent: r.has_ad_consent, gclid: r.gclid, gbraid: r.gbraid, wbraid: r.wbraid, clickTime: r.click_time,
  }))
}

function describeError(err: unknown): string {
  if (err instanceof AdsApiError) return `HTTP ${err.httpStatus} ${err.codes.join(', ') || '-'}: ${err.message}`.slice(0, 1000)
  return String((err as Error)?.message ?? err).slice(0, 1000)
}

export async function runTrackingSync(opts: SyncOptions): Promise<SyncResult> {
  const { mode, db } = opts
  const log = opts.log ?? ((m: string) => console.log(m))
  if (opts.fixture && mode === 'send') throw new Error('Refuz: date de test (fixture) NU se trimit niciodată fără validate_only')

  // Configuratia Google o verificam INAINTE de orice, ca modul send sa nu porneasca pe jumatate
  let cfg: AdsConfig | null = null
  let googleSkipped: string | undefined
  const conversionActionId = opts.conversionActionId ?? process.env.GOOGLE_ADS_CONVERSION_ACTION_ID?.trim()
  if (mode !== 'plan') {
    try {
      cfg = opts.deps?.cfg ?? configFromEnv()
    } catch (err) {
      googleSkipped = describeError(err)
    }
    if (cfg && !conversionActionId) {
      googleSkipped = 'lipsește GOOGLE_ADS_CONVERSION_ACTION_ID (acțiunea „Comision Profitshare” nu e creată/configurată)'
      cfg = null
    }
    if (mode === 'send' && (!cfg || cfg.env !== 'prod')) {
      throw new Error(`Refuz trimiterea reală: ${cfg ? 'ADS_ENV nu e prod' : googleSkipped}`)
    }
  }

  // 1. Citire
  const raws = opts.fixture ?? await (opts.deps?.fetchCommissions ?? getCommissions)(opts.days ?? CLICK_WINDOW_DAYS)
  const parsed = raws.map((raw) => ({ raw, p: parseCommission(raw) }))
  const unknownStatuses = [...new Set(parsed.map((x) => x.p.unknownStatus).filter((s): s is string => !!s))]

  // 2. Upsert + potrivire
  const { inserted, updated } = await upsertCommissions(db, parsed)
  const rows = await loadRows(db)
  const readIds = new Set(parsed.map((x) => x.p.externalId))
  const matched = rows.filter((r) => readIds.has(r.externalId) && r.adClickId).length
  const plan = planSync(rows)

  const result: SyncResult = {
    mode, read: raws.length, inserted, updated, unknownStatuses, matched,
    plan: {
      uploads: plan.uploads.length, retractions: plan.retractions.length, alreadyUploaded: plan.alreadyUploaded,
      valueChanged: plan.valueChanged.length, skipped: plan.skipped,
    },
    uploaded: 0, validated: 0, retracted: 0, errors: [], purgedClickIds: 0, googleSkipped,
  }

  for (const r of plan.uploads) log(`  ↑ de trimis: comanda ${r.externalId} · ${r.amount.toFixed(2)} RON · ${r.status} · ${formatRo(r.orderTime, 'ads')} · ${maskId(r)}`)
  for (const r of plan.retractions) log(`  ↓ de retras: comanda ${r.externalId} (anulată după trimitere)`)
  for (const r of plan.valueChanged) log(`  ~ valoare schimbată după trimitere: comanda ${r.externalId} ${r.uploadedValue} → ${r.amount} RON (nu ajustăm automat)`)

  // 3–4. Google
  if (mode !== 'plan' && cfg && conversionActionId) {
    const validateOnly = mode !== 'send'
    const ingest = opts.deps?.ingest ?? ingestConversion
    const retract = opts.deps?.retract ?? uploadRetractions
    for (const r of plan.uploads) {
      try {
        await ingest(cfg, conversionActionId, {
          ids: r, value: r.amount, eventTimestamp: formatRo(r.orderTime, 'rfc3339'), transactionId: r.externalId,
        }, { validateOnly })
        if (validateOnly) {
          result.validated++
        } else {
          await db.query(`UPDATE affiliate_conversions SET uploaded_at = now(), uploaded_value = commission_amount, last_error = NULL, updated_at = now() WHERE id = $1`, [r.id])
          result.uploaded++
        }
      } catch (err) {
        const msg = describeError(err)
        result.errors.push({ externalId: r.externalId, action: 'upload', error: msg })
        await db.query(`UPDATE affiliate_conversions SET last_error = $2 WHERE id = $1`, [r.id, (validateOnly ? '[validate_only] ' : '') + msg])
      }
    }

    if (plan.retractions.length) {
      const now = formatRo(new Date(), 'ads')
      try {
        const res = await retract(cfg, conversionActionId,
          plan.retractions.map((r) => ({ orderId: r.externalId, adjustmentDateTime: now })), { validateOnly })
        for (const [i, r] of plan.retractions.entries()) {
          const e = res.errorsByIndex.get(i)
          if (e) {
            result.errors.push({ externalId: r.externalId, action: 'retract', error: e })
            await db.query(`UPDATE affiliate_conversions SET last_error = $2 WHERE id = $1`, [r.id, (validateOnly ? '[validate_only] ' : '') + e])
          } else if (validateOnly) {
            result.validated++
          } else {
            await db.query(`UPDATE affiliate_conversions SET retracted_at = now(), last_error = NULL, updated_at = now() WHERE id = $1`, [r.id])
            result.retracted++
          }
        }
      } catch (err) {
        const msg = describeError(err)
        for (const r of plan.retractions) result.errors.push({ externalId: r.externalId, action: 'retract', error: msg })
      }
    }
  }

  // 5. Retentie: gclid & co. nu se pastreaza mai mult de 90 de zile de la click (dupa aceea
  // Google oricum nu-i mai accepta). click_id-ul ramane, pentru potrivirea comisioanelor.
  const purge = await db.query(`
    UPDATE ad_clicks SET gclid = NULL, gbraid = NULL, wbraid = NULL
    WHERE created_at < now() - make_interval(days => $1)
      AND (gclid IS NOT NULL OR gbraid IS NOT NULL OR wbraid IS NOT NULL)
  `, [CLICK_WINDOW_DAYS])
  result.purgedClickIds = purge.rowCount ?? 0

  return result
}

// Rezumatul pe o linie, pentru loguri si Telegram
export function summarize(r: SyncResult): string {
  const sk = Object.entries(r.plan.skipped).filter(([, n]) => n > 0).map(([k, n]) => `${k}=${n}`).join(' ')
  return `[tracking:sync ${r.mode}] citite=${r.read} noi=${r.inserted} modificate=${r.updated} potrivite=${r.matched}` +
    ` · de trimis=${r.plan.uploads} de retras=${r.plan.retractions} deja trimise=${r.plan.alreadyUploaded}` +
    ` · trimise=${r.uploaded} retrase=${r.retracted} validate=${r.validated} erori=${r.errors.length}` +
    ` · gclid șterse (>90 zile)=${r.purgedClickIds}` +
    (sk ? ` · sărite: ${sk}` : '') +
    (r.unknownStatuses.length ? ` · statusuri necunoscute: ${r.unknownStatuses.join(',')}` : '') +
    (r.googleSkipped ? ` · Google nesolicitat: ${r.googleSkipped}` : '')
}

// Jobul BullMQ zilnic (dupa feed-sync). Decizia proprietarului (2026-09-26): ruleaza DOAR
// validate_only pana cand activeaza explicit trimiterea reala cu TRACKING_SYNC_AUTO_SEND=1
// SI ADS_ENV=prod in .env (dupa primele comisioane potrivite corect si pornirea campaniilor).
export async function runTrackingSyncJob(db: Db, log: (m: string) => void) {
  const autoSend = process.env.TRACKING_SYNC_AUTO_SEND === '1' && (process.env.ADS_ENV || 'test').trim() === 'prod'
  const result = await runTrackingSync({ mode: autoSend ? 'send' : 'validate', db, log })
  for (const e of result.errors) log(`tracking:sync ✗ ${e.action} comanda ${e.externalId}: ${e.error}`)
  log(summarize(result))
  return {
    mode: result.mode, read: result.read, matched: result.matched, uploads: result.plan.uploads,
    uploaded: result.uploaded, validated: result.validated, retracted: result.retracted,
    errors: result.errors.length, purged: result.purgedClickIds,
  }
}
