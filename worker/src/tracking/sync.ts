import type pg from 'pg'
import { getCommissions, parseCommission, type PsCommissionRaw } from '../lib/profitshare.js'
import { getTpCommissions, parseTpCommission, sanitizeTpCommission, twoPerformantConfigured, type TpCommissionRaw } from '../lib/twoperformant.js'
import { configFromEnv, uploadRetractions, AdsApiError, type AdsConfig } from '../ads/google-ads.js'
import { ingestConversion } from '../ads/data-manager.js'
import { planSync, formatRo, maskId, maskIdsInText, googleOrderId, CLICK_WINDOW_DAYS, type AffiliateNetwork, type ConversionRow, type SyncPlan } from './core.js'

// tracking:sync — comisioanele Profitshare + 2Performant → affiliate_conversions → Google Ads.
//
//   1. citeste comisioanele din ultimele 90 de zile (aprobarea vine dupa ~48–65 de zile), din
//      ambele retele (2Performant doar daca are credentiale in .env). O retea cazuta nu le
//      blocheaza pe celelalte (eroare `fetch` in rezultat); daca TOATE cad, sync-ul arunca;
//   2. upsert in affiliate_conversions (network + external_id) + potrivire cu ad_clicks dupa
//      click_id: Profitshare il intoarce in `hash`, 2Performant in `stats_tags` (subtag-ul `st`);
//   3. comisioanele potrivite cu un click din reclama, CU acord „Publicitate”, netrimise inca →
//      conversie offline „Comision afiliere” (valoare = comisionul, RON), prin Data Manager API;
//      se trimit inca din `pending` (Google invata mai repede) si se retrag daca se anuleaza;
//   4. comisioanele devenite anulate, deja trimise → RETRACTION (Google Ads API);
//   5. sterge gclid/gbraid/wbraid din clickurile pe reclama mai vechi de 90 de zile (politica de
//      confidentialitate). Pas INDEPENDENT: ruleaza in `finally`, deci si cand Profitshare sau
//      Google esueaza — altfel o pana de cateva zile la Profitshare ar tine ID-urile peste 90 zile.
//
// Moduri (REGULI.md, regulile 3 si 4):
//   plan     — implicit; pasii 1, 2, 5 (doar baza noastra) + ce AR trimite. Nimic la Google.
//              ATENTIE: si in plan pasul 5 STERGE efectiv ID-urile expirate din ad_clicks. E o
//              stergere (reduce datele pastrate, obligatie de retentie), nu o trimitere — regula
//              „dry-run” priveste scrierile catre Google Ads, nu curatenia propriei baze.
//   validate — ca `send`, dar fiecare cerere pleaca cu validate_only: Google verifica, NU aplica.
//              NU seteaza uploaded_at / retracted_at. Jobul automat ruleaza asa (decizia
//              proprietarului, 2026-09-26).
//   send     — trimitere reala. Doar cu ADS_ENV=prod (CLI: --prod --confirm).
// Idempotent: uploaded_at / retracted_at opresc retrimiterea; in plus Google deduplica dupa
// transactionId / orderId = googleOrderId(): order_id Profitshare (neschimbat) / `2p-<id>`.

export type SyncMode = 'plan' | 'validate' | 'send'
type Db = pg.Pool | pg.PoolClient

// Date de test in loc de API-uri. Lista simpla = randuri Profitshare (formatul vechi); obiectul
// le poate avea pe ambele. Cu fixture NU se apeleaza nicio retea.
export type SyncFixture = PsCommissionRaw[] | { profitshare?: PsCommissionRaw[]; '2performant'?: TpCommissionRaw[] }

export interface SyncOptions {
  mode: SyncMode
  db: Db
  days?: number
  fixture?: SyncFixture                  // in loc de API (teste) — refuzat in modul send
  conversionActionId?: string            // implicit GOOGLE_ADS_CONVERSION_ACTION_ID
  log?: (msg: string) => void
  // Doar pentru teste unitare: configuratie si apeluri Google inlocuite (fara retea)
  // Daca `deps` e dat (teste), 2Performant se citeste DOAR prin deps.fetchTpCommissions.
  deps?: { cfg?: AdsConfig; ingest?: typeof ingestConversion; retract?: typeof uploadRetractions; fetchCommissions?: typeof getCommissions; fetchTpCommissions?: typeof getTpCommissions }
}

export interface SyncResult {
  mode: SyncMode
  read: number
  readByNetwork: Partial<Record<AffiliateNetwork, number>>
  inserted: number
  updated: number
  unknownStatuses: string[]              // `retea:status`
  currencyIssues: string[]               // comisioane fara suma in RON (2Performant) — trimise cu 0 = sarite
  matched: number                        // comisioane legate de un click al nostru
  plan: { uploads: number; retractions: number; alreadyUploaded: number; valueChanged: number; skipped: SyncPlan['skipped'] }
  uploaded: number                       // trimise efectiv (send)
  validated: number                      // acceptate de Google cu validate_only
  retracted: number
  errors: { externalId: string; action: 'fetch' | 'upload' | 'retract' | 'purge'; error: string }[]
  purgedClickIds: number
  googleSkipped?: string                 // de ce n-am contactat Google (config lipsa)
}

// Un comision citit, adus la forma comuna (indiferent de retea)
interface ReadCommission {
  network: AffiliateNetwork
  raw: unknown                           // copia pastrata in raw_payload (fara date personale)
  p: { externalId: string; clickId: string | null; advertiserId: string; status: ConversionRow['status']; amount: number; orderTime: Date; unknownStatus?: string; currencyIssue?: string }
}

// Magazinul comisionului: Profitshare dupa advertiser_id (retailers.ps_advertiser_id);
// 2Performant dupa clickul nostru (ad_clicks.retailer_id), altfel dupa domeniul programului
// (affiliate_advertisers, sincronizat zilnic) comparat cu retailers.base_url.
const RETAILER_SQL: Record<AffiliateNetwork, string> = {
  profitshare: `(SELECT id FROM retailers WHERE ps_advertiser_id::text = $3 LIMIT 1)`,
  '2performant': `COALESCE(
                (SELECT retailer_id FROM ad_clicks WHERE click_id = $2),
                (SELECT r.id FROM affiliate_advertisers a JOIN retailers r ON r.base_url ILIKE '%' || a.domain || '%'
                 WHERE a.network = '2performant' AND a.external_id = $3 AND a.domain IS NOT NULL LIMIT 1))`,
}

async function upsertCommissions(db: Db, items: ReadCommission[]) {
  let inserted = 0
  let updated = 0
  for (const { network, raw, p } of items) {
    // Se actualizeaza doar daca s-a schimbat ceva relevant (status, suma, click) — updated_at
    // ramane astfel un semnal util („ultima schimbare reala”).
    const r = await db.query<{ inserted: boolean }>(`
      INSERT INTO affiliate_conversions
        (network, external_id, click_id, ad_click_id, retailer_id, status, commission_amount, order_time, raw_payload)
      VALUES ($8, $1, $2,
              (SELECT id FROM ad_clicks WHERE click_id = $2),
              ${RETAILER_SQL[network]},
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
    `, [p.externalId, p.clickId, p.advertiserId, p.status, p.amount, p.orderTime, JSON.stringify(raw), network])
    if (r.rows[0]?.inserted === true) inserted++
    else if (r.rows[0]) updated++
  }
  return { inserted, updated }
}

async function loadRows(db: Db): Promise<ConversionRow[]> {
  // Fereastra ceva mai larga decat 90 de zile + orice trimis inca neretras (pentru retrageri)
  const { rows } = await db.query(`
    SELECT ac.id, ac.network, ac.external_id, ac.status, ac.commission_amount::float AS amount, ac.order_time,
           ac.uploaded_at, ac.uploaded_value::float AS uploaded_value, ac.retracted_at,
           ac.click_id, ac.ad_click_id, c.has_ad_consent, c.is_internal, c.gclid, c.gbraid, c.wbraid,
           -- momentul clickului pe reclama (din cookie-ul se_gclid); randurile vechi / fara ID → /go
           COALESCE(c.ad_click_at, c.created_at) AS click_time
    FROM affiliate_conversions ac
    LEFT JOIN ad_clicks c ON c.id = ac.ad_click_id
    WHERE ac.network IN ('profitshare', '2performant')
      AND (ac.order_time > now() - interval '120 days' OR (ac.uploaded_at IS NOT NULL AND ac.retracted_at IS NULL))
    ORDER BY ac.order_time
  `)
  return rows.map((r: any) => ({
    id: Number(r.id), network: r.network, externalId: r.external_id, status: r.status, amount: r.amount, orderTime: r.order_time,
    uploadedAt: r.uploaded_at, uploadedValue: r.uploaded_value, retractedAt: r.retracted_at,
    clickId: r.click_id, adClickId: r.ad_click_id == null ? null : Number(r.ad_click_id),
    hasAdConsent: r.has_ad_consent, isInternal: r.is_internal, gclid: r.gclid, gbraid: r.gbraid, wbraid: r.wbraid, clickTime: r.click_time,
  }))
}

function describeError(err: unknown): string {
  if (err instanceof AdsApiError) return `HTTP ${err.httpStatus} ${err.codes.join(', ') || '-'}: ${err.message}`.slice(0, 1000)
  return String((err as Error)?.message ?? err).slice(0, 1000)
}

// Pasul 5 — retentie: gclid & co. nu se pastreaza mai mult de 90 de zile de la clickul pe reclama
// (dupa aceea Google oricum nu-i mai accepta). click_id-ul ramane, pentru potrivirea comisioanelor.
// Exportata separat ca sa poata fi rulata si testata independent de Profitshare / Google.
export async function purgeExpiredAdIds(db: Db): Promise<number> {
  const purge = await db.query(`
    UPDATE ad_clicks SET gclid = NULL, gbraid = NULL, wbraid = NULL
    WHERE COALESCE(ad_click_at, created_at) < now() - make_interval(days => $1)
      AND (gclid IS NOT NULL OR gbraid IS NOT NULL OR wbraid IS NOT NULL)
  `, [CLICK_WINDOW_DAYS])
  return purge.rowCount ?? 0
}

export async function runTrackingSync(opts: SyncOptions): Promise<SyncResult> {
  const log = opts.log ?? ((m: string) => console.log(m))
  let result: SyncResult | undefined
  try {
    result = await syncSteps(opts, log)
  } finally {
    // Ruleaza si daca syncSteps a aruncat (Profitshare cazut, DB, config Google). O eroare a
    // stergerii nu ascunde eroarea initiala — doar o logam.
    try {
      const purged = await purgeExpiredAdIds(opts.db)
      if (result) result.purgedClickIds = purged
      else log(`tracking:sync — sincronizarea a eșuat, dar ștergerea de retenție a rulat: gclid șterse (>90 zile)=${purged}`)
    } catch (err) {
      log(`tracking:sync ✗ ștergerea de retenție (gclid >90 zile) a eșuat: ${describeError(err)}`)
      if (result) result.errors.push({ externalId: '-', action: 'purge', error: describeError(err) })
    }
  }
  return result!   // definit: daca syncSteps arunca, eroarea se propaga dupa finally
}

// Pasul 1: comisioanele din toate retelele, aduse la forma comuna. Fiecare retea e citita
// separat: o pana la 2Performant nu opreste Profitshare (si invers) — eroarea apare in rezultat
// (`fetch`). Daca NICIO retea n-a putut fi citita, aruncam (ca inainte), iar retentia tot ruleaza.
async function readCommissions(opts: SyncOptions, log: (m: string) => void) {
  const parsed: ReadCommission[] = []
  const readByNetwork: SyncResult['readByNetwork'] = {}
  const fetchErrors: SyncResult['errors'] = []
  const days = opts.days ?? CLICK_WINDOW_DAYS

  let psRaws: (() => Promise<PsCommissionRaw[]>) | null
  let tpRaws: (() => Promise<TpCommissionRaw[]>) | null
  if (opts.fixture) {
    const f = Array.isArray(opts.fixture) ? { profitshare: opts.fixture } : opts.fixture
    psRaws = f.profitshare ? async () => f.profitshare! : null
    tpRaws = f['2performant'] ? async () => f['2performant']! : null
  } else {
    const fetchPs = opts.deps?.fetchCommissions ?? getCommissions
    psRaws = () => fetchPs(days)
    const fetchTp = opts.deps ? opts.deps.fetchTpCommissions : (twoPerformantConfigured() ? getTpCommissions : undefined)
    tpRaws = fetchTp ? () => fetchTp(days) : null
    if (!fetchTp && !opts.deps) log('tracking:sync — 2Performant sărit: lipsesc TWOPERFORMANT_EMAIL / TWOPERFORMANT_PASSWORD')
  }

  const failures: unknown[] = []
  let attempted = 0
  if (psRaws) {
    attempted++
    try {
      const raws = await psRaws()
      for (const raw of raws) parsed.push({ network: 'profitshare', raw, p: parseCommission(raw) })
      readByNetwork.profitshare = raws.length
    } catch (err) {
      failures.push(err)
      fetchErrors.push({ externalId: 'profitshare', action: 'fetch', error: describeError(err) })
    }
  }
  if (tpRaws) {
    attempted++
    try {
      const raws = await tpRaws()
      for (const raw of raws) parsed.push({ network: '2performant', raw: sanitizeTpCommission(raw), p: parseTpCommission(raw) })
      readByNetwork['2performant'] = raws.length
    } catch (err) {
      failures.push(err)
      fetchErrors.push({ externalId: '2performant', action: 'fetch', error: describeError(err) })
    }
  }
  if (attempted > 0 && failures.length === attempted) throw failures[0]
  for (const e of fetchErrors) log(`tracking:sync ✗ citire ${e.externalId}: ${e.error}`)
  return { parsed, readByNetwork, fetchErrors }
}

async function syncSteps(opts: SyncOptions, log: (msg: string) => void): Promise<SyncResult> {
  const { mode, db } = opts
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
      googleSkipped = 'lipsește GOOGLE_ADS_CONVERSION_ACTION_ID (acțiunea „Comision afiliere” nu e creată/configurată)'
      cfg = null
    }
    if (mode === 'send' && (!cfg || cfg.env !== 'prod')) {
      throw new Error(`Refuz trimiterea reală: ${cfg ? 'ADS_ENV nu e prod' : googleSkipped}`)
    }
  }

  // 1. Citire
  const { parsed, readByNetwork, fetchErrors } = await readCommissions(opts, log)
  const unknownStatuses = [...new Set(parsed.filter((x) => x.p.unknownStatus).map((x) => `${x.network}:${x.p.unknownStatus}`))]
  const currencyIssues = [...new Set(parsed.filter((x) => x.p.currencyIssue).map((x) => `${x.network}:${x.p.currencyIssue}`))]

  // 2. Upsert + potrivire
  const { inserted, updated } = await upsertCommissions(db, parsed)
  const rows = await loadRows(db)
  const key = (network: string, externalId: string) => `${network}:${externalId}`
  const readIds = new Set(parsed.map((x) => key(x.network, x.p.externalId)))
  const matched = rows.filter((r) => readIds.has(key(r.network, r.externalId)) && r.adClickId).length
  const plan = planSync(rows)

  const result: SyncResult = {
    mode, read: parsed.length, readByNetwork, inserted, updated, unknownStatuses, currencyIssues, matched,
    plan: {
      uploads: plan.uploads.length, retractions: plan.retractions.length, alreadyUploaded: plan.alreadyUploaded,
      valueChanged: plan.valueChanged.length, skipped: plan.skipped,
    },
    uploaded: 0, validated: 0, retracted: 0, errors: [...fetchErrors], purgedClickIds: 0, googleSkipped,
  }

  // In loguri / erori comanda apare cu ID-ul trimis la Google (2Performant: `2p-<id>`)
  const oid = (r: ConversionRow) => googleOrderId(r.network, r.externalId)
  for (const r of plan.uploads) log(`  ↑ de trimis: comanda ${oid(r)} (${r.network}) · ${r.amount.toFixed(2)} RON · ${r.status} · ${formatRo(r.orderTime, 'ads')} · ${maskId(r)}`)
  for (const r of plan.retractions) log(`  ↓ de retras: comanda ${oid(r)} (${r.network}, anulată după trimitere)`)
  for (const r of plan.valueChanged) log(`  ~ valoare schimbată după trimitere: comanda ${oid(r)} (${r.network}) ${r.uploadedValue} → ${r.amount} RON (nu ajustăm automat)`)

  // 3–4. Google
  if (mode !== 'plan' && cfg && conversionActionId) {
    const validateOnly = mode !== 'send'
    const ingest = opts.deps?.ingest ?? ingestConversion
    const retract = opts.deps?.retract ?? uploadRetractions
    for (const r of plan.uploads) {
      try {
        await ingest(cfg, conversionActionId, {
          ids: r, value: r.amount, eventTimestamp: formatRo(r.orderTime, 'rfc3339'), transactionId: oid(r),
        }, { validateOnly })
        if (validateOnly) {
          result.validated++
        } else {
          await db.query(`UPDATE affiliate_conversions SET uploaded_at = now(), uploaded_value = commission_amount, last_error = NULL, updated_at = now() WHERE id = $1`, [r.id])
          result.uploaded++
        }
      } catch (err) {
        const msg = maskIdsInText(describeError(err), r)   // R3: fara gclid intreg in DB / log
        result.errors.push({ externalId: oid(r), action: 'upload', error: msg })
        await db.query(`UPDATE affiliate_conversions SET last_error = $2 WHERE id = $1`, [r.id, (validateOnly ? '[validate_only] ' : '') + msg])
      }
    }

    if (plan.retractions.length) {
      const now = formatRo(new Date(), 'ads')
      try {
        const res = await retract(cfg, conversionActionId,
          plan.retractions.map((r) => ({ orderId: oid(r), adjustmentDateTime: now })), { validateOnly })
        for (const [i, r] of plan.retractions.entries()) {
          const raw = res.errorsByIndex.get(i)
          const e = raw ? maskIdsInText(raw, r) : undefined
          if (e) {
            result.errors.push({ externalId: oid(r), action: 'retract', error: e })
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
        for (const r of plan.retractions) result.errors.push({ externalId: oid(r), action: 'retract', error: maskIdsInText(msg, r) })
      }
    }
  }

  // 5. Retentia ruleaza in runTrackingSync (finally), independent de pasii de mai sus.
  return result
}

// Rezumatul pe o linie, pentru loguri si Telegram
export function summarize(r: SyncResult): string {
  const sk = Object.entries(r.plan.skipped).filter(([, n]) => n > 0).map(([k, n]) => `${k}=${n}`).join(' ')
  const perNet = Object.entries(r.readByNetwork).map(([n, k]) => `${n}=${k}`).join(' ')
  return `[tracking:sync ${r.mode}] citite=${r.read}${perNet ? ` (${perNet})` : ''} noi=${r.inserted} modificate=${r.updated} potrivite=${r.matched}` +
    ` · de trimis=${r.plan.uploads} de retras=${r.plan.retractions} deja trimise=${r.plan.alreadyUploaded}` +
    ` · trimise=${r.uploaded} retrase=${r.retracted} validate=${r.validated} erori=${r.errors.length}` +
    ` · gclid șterse (>90 zile)=${r.purgedClickIds}` +
    (sk ? ` · sărite: ${sk}` : '') +
    (r.unknownStatuses.length ? ` · statusuri necunoscute: ${r.unknownStatuses.join(',')}` : '') +
    (r.currencyIssues.length ? ` · fără sumă în RON (sărite): ${r.currencyIssues.join(',')}` : '') +
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
