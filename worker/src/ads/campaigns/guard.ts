// Garda zilnica a campaniilor (job BullMQ `ads-guard`, manual: npm run ads:guard).
//
// De ce exista: un anunt aprobat azi poate deveni fals peste cateva zile fara ca cineva sa-l
// atinga — produsul iese din stoc, pagina devine 404 / noindex fara oferta, iar daca textul ar vorbi de
// reducere, insigna „Reducere reala” dispare cand mediana pe 30 de zile prinde pretul din urma
// (verdictul policy-reviewer B1, 2026-09-27). Regula 9 cere ca afirmatiile sa fie adevarate pe
// landing; garda verifica asta in fiecare dimineata si opreste grupul care nu mai corespunde.
//
// Ce face, pe scurt:
//  1. strange grupurile de anunturi ACTIVE din campaniile noastre („SE | …”): din cont (o citire
//     GAQL) si din YAML (grupurile care au deja `id`, scris de ads:apply). Fara ID-uri in YAML si
//     fara grupuri active in cont → nu face nimic (nici macar nu descarca pagini);
//  2. pentru fiecare grup verifica pagina de destinatie cu aceleasi reguli ca ads:validate
//     (200 direct, oferta in stoc, indexabila — noindex e permis pe /p/ in stoc, decizia SEO din
//     5 oct. 2026 —, categorie permisa) + afirmatiile din texte
//     (reducere / procent → „Reducere reala” vizibila; marci prezente pe pagina);
//  3. o pagina care pica se re-verifica o data dupa un minut (o sughitare a site-ului nu
//     opreste reclamele);
//  4. grupurile care pica si acum → PAUZA prin pauseOnly() (google-ads.ts — accepta DOAR
//     status=PAUSED) + mesaj Telegram catre TELEGRAM_ADMIN_CHAT_ID.
//
// Pauza e REALA doar in ADS_ENV=prod sau cu ADS_GUARD_REAL_PAUSE=1 (acordul proprietarului).
// Altfel pleaca cu validate_only (Google confirma ca ar merge) si garda doar alerteaza — atunci
// pauza o pui tu in Google Ads. Garda NU activeaza niciodata nimic (regula 11).

import { configFromEnv, pauseOnly, searchAll, AdsApiError, type AdsConfig } from '../google-ads.js'
import { loadAllCampaigns, loadGuardrails, type CampaignFile, type Guardrails } from './schema.js'
import { createPageLoader, landingProblems, claimIssues, adTexts, defaultFetcher, type Fetcher } from './validate.js'
import { notifyAdmin, escHtml } from '../../lib/admin-telegram.js'

export interface GuardTarget {
  source: 'cont' | 'yaml' | 'cont+yaml'
  campaignName: string
  campaignStatus?: string       // din cont (necunoscut daca nu am putut citi contul)
  adGroupId: string
  adGroupName: string
  urls: string[]                // paginile de destinatie ale anunturilor active
  texts: string[]               // titlurile + descrierile anunturilor active
}

export interface GuardFinding { target: GuardTarget; problems: string[] }

export interface GuardResult {
  mode: 'check' | 'send'        // check = doar verificare (CLI fara --confirm)
  accountRead: boolean
  checked: number
  failing: number
  paused: number                // pauze REALE
  validatedOnly: number         // pauze trimise cu validate_only (fara efect in cont)
  alerted: boolean
  findings: GuardFinding[]
  errors: string[]
}

// --- Surse de grupuri ----------------------------------------------------------------------------

// Grupurile din YAML care au deja ID in Google Ads (dupa ads:apply). Cele fara ID sunt ignorate.
export function targetsFromYaml(files: CampaignFile[]): GuardTarget[] {
  const out: GuardTarget[] = []
  for (const f of files) for (const ag of f.campaign.ad_groups ?? []) {
    if (!ag.id) continue
    const urls = new Set<string>([ag.final_url])
    for (const ad of ag.ads ?? []) if (ad.final_url) urls.add(ad.final_url)
    out.push({
      source: 'yaml', campaignName: f.campaign.name, adGroupId: String(ag.id), adGroupName: ag.name,
      urls: [...urls].filter(Boolean), texts: (ag.ads ?? []).flatMap(adTexts),
    })
  }
  return out
}

// Randurile GAQL (ad_group_ad) → cate un GuardTarget per grup. Functie pura (testata).
export function targetsFromRows(rows: any[]): GuardTarget[] {
  const byId = new Map<string, GuardTarget>()
  for (const r of rows) {
    const id = String(r.adGroup?.id ?? '')
    if (!id) continue
    if (!byId.has(id)) byId.set(id, {
      source: 'cont', campaignName: r.campaign?.name ?? '', campaignStatus: r.campaign?.status,
      adGroupId: id, adGroupName: r.adGroup?.name ?? '', urls: [], texts: [],
    })
    const t = byId.get(id)!
    const ad = r.adGroupAd?.ad ?? {}
    for (const u of ad.finalUrls ?? []) if (!t.urls.includes(u)) t.urls.push(u)
    for (const h of ad.responsiveSearchAd?.headlines ?? []) t.texts.push(h.text)
    for (const d of ad.responsiveSearchAd?.descriptions ?? []) t.texts.push(d.text)
  }
  return [...byId.values()]
}

// O singura citire GAQL: anunturile ACTIVE din grupurile ACTIVE ale campaniilor „SE | …”.
// (Un grup sau un anunt pe pauza nu cheltuie nimic, deci nu are rost verificat.)
export async function readAccountTargets(cfg: AdsConfig): Promise<GuardTarget[]> {
  const rows = await searchAll(cfg, `SELECT campaign.id, campaign.name, campaign.status, ad_group.id, ad_group.name,
    ad_group.status, ad_group_ad.status, ad_group_ad.ad.final_urls, ad_group_ad.ad.responsive_search_ad.headlines,
    ad_group_ad.ad.responsive_search_ad.descriptions
    FROM ad_group_ad WHERE campaign.name LIKE 'SE | %' AND campaign.status != 'REMOVED'
    AND ad_group.status = 'ENABLED' AND ad_group_ad.status = 'ENABLED'`)
  return targetsFromRows(rows)
}

// Contul are prioritate (arata ce ruleaza de fapt). Daca l-am citit, un grup din YAML care nu
// apare printre grupurile active e deja pe pauza (sau sters) → nu e verificat. Daca NU am putut
// citi contul, verificam grupurile din YAML (doar alerta — fara cont nu se poate pune pauza).
export function mergeTargets(yaml: GuardTarget[], account: GuardTarget[] | null): GuardTarget[] {
  if (!account) return yaml
  const yamlIds = new Set(yaml.map((t) => t.adGroupId))
  return account.map((t) => (yamlIds.has(t.adGroupId) ? { ...t, source: 'cont+yaml' as const } : t))
}

// --- Verificare ------------------------------------------------------------------------------------

export async function evaluateTargets(targets: GuardTarget[], g: Guardrails, fetcher: Fetcher): Promise<GuardFinding[]> {
  const loader = createPageLoader(fetcher)
  const findings: GuardFinding[] = []
  for (const t of targets) {
    const problems: string[] = []
    if (!t.urls.length) problems.push('niciun URL de destinație')
    for (const url of t.urls) {
      const landing = await landingProblems(url, loader, g, { strictStock: true })
      problems.push(...landing)
      const p = loader.pages.get(url)
      if (!landing.length && p?.status === 200) problems.push(...claimIssues(t.texts, p, t.adGroupName).map((i) => i.msg))
    }
    if (problems.length) findings.push({ target: t, problems: [...new Set(problems)] })
  }
  return findings
}

export function pauseOps(customerId: string, findings: GuardFinding[]) {
  return findings.map((f) => ({
    adGroupOperation: {
      update: { resourceName: `customers/${customerId}/adGroups/${f.target.adGroupId}`, status: 'PAUSED' },
      updateMask: 'status',
    },
  }))
}

export interface GuardDeps {
  files?: CampaignFile[]                                             // implicit: ads/campaigns/*.yaml (daca exista)
  guardrails?: Guardrails
  cfg?: AdsConfig | null                                             // implicit: din .env (null = fara credentiale)
  readAccount?: (cfg: AdsConfig) => Promise<GuardTarget[]>
  fetcher?: Fetcher
  pause?: (cfg: AdsConfig, ops: unknown[]) => Promise<{ validateOnly: boolean }>
  notify?: (text: string) => Promise<boolean>
  env?: Record<string, string | undefined>
  retryDelayMs?: number
  mode?: 'check' | 'send'
  log?: (m: string) => void
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function runAdsGuard(deps: GuardDeps = {}): Promise<GuardResult> {
  const log = deps.log ?? ((m: string) => console.log(m))
  const env = deps.env ?? process.env
  const mode = deps.mode ?? 'send'
  const result: GuardResult = { mode, accountRead: false, checked: 0, failing: 0, paused: 0, validatedOnly: 0, alerted: false, findings: [], errors: [] }

  // YAML-ul lipseste din imaginea Docker de productie → acolo garda se bazeaza doar pe cont
  let files = deps.files
  if (!files) { try { files = loadAllCampaigns() } catch { files = [] } }
  let g = deps.guardrails
  if (!g) { try { g = loadGuardrails() } catch { g = { excluded_categories: ['sanatate-naturale'] } as Guardrails } }

  let cfg = deps.cfg
  if (cfg === undefined) {
    try { cfg = configFromEnv() } catch (e) { cfg = null; log(`ads-guard: fără acces la cont (${(e as Error).message}) — doar grupurile din YAML, fără pauză`) }
  }

  let account: GuardTarget[] | null = null
  if (cfg) {
    try { account = await (deps.readAccount ?? readAccountTargets)(cfg); result.accountRead = true } catch (e) {
      const msg = e instanceof AdsApiError ? `HTTP ${e.httpStatus} ${e.codes.join(',')} ${e.message}` : (e as Error).message
      result.errors.push(`citire cont: ${msg}`)
      log(`ads-guard: nu pot citi contul (${msg}) — verific doar grupurile din YAML`)
    }
  }
  const targets = mergeTargets(targetsFromYaml(files), account)
  result.checked = targets.length
  if (!targets.length) {
    log('ads-guard: niciun grup activ cu ID (nici în YAML, nici în cont) — nimic de verificat')
    if (result.errors.length) await alert(deps, result, `nu am putut citi contul Google Ads: ${result.errors.join('; ')}`)
    return result
  }

  // Prima verificare; paginile care pica se re-verifica o data (cache nou) dupa o pauza scurta
  const fetcher = deps.fetcher ?? defaultFetcher
  let findings = await evaluateTargets(targets, g, fetcher)
  if (findings.length) {
    await sleep(deps.retryDelayMs ?? 60_000)
    findings = await evaluateTargets(findings.map((f) => f.target), g, fetcher)
  }
  result.findings = findings
  result.failing = findings.length
  log(`ads-guard: ${targets.length} grupuri verificate, ${findings.length} cu probleme`)
  for (const f of findings) log(`  ✗ ${f.target.campaignName} › ${f.target.adGroupName} (${f.target.adGroupId}): ${f.problems.join(' | ')}`)
  if (!findings.length) return result

  if (mode === 'check') {
    log('ads-guard: mod verificare (fără --confirm) — nimic trimis la Google, nicio alertă')
    return result
  }

  // Pauza (doar status=PAUSED; reala doar in prod sau cu ADS_GUARD_REAL_PAUSE=1)
  let pauseNote: string
  if (!cfg || !result.accountRead) {
    pauseNote = 'NU am putut pune pauză (fără acces la cont) — pune grupurile pe pauză manual în Google Ads.'
  } else {
    try {
      const r = await (deps.pause ?? ((c, ops) => pauseOnly(c, ops, env)))(cfg, pauseOps(cfg.customerId, findings))
      if (r.validateOnly) {
        result.validatedOnly = findings.length
        pauseNote = 'Pauza NU s-a aplicat (ADS_ENV=test fără ADS_GUARD_REAL_PAUSE=1; Google doar a validat-o) — pune grupurile pe pauză manual în Google Ads.'
      } else {
        result.paused = findings.length
        pauseNote = 'Grupurile au fost puse pe PAUZĂ. Le reactivezi tu în Google Ads după ce pagina e din nou în regulă.'
      }
    } catch (e) {
      const msg = e instanceof AdsApiError ? `HTTP ${e.httpStatus} ${e.codes.join(',')} ${e.message}` : (e as Error).message
      result.errors.push(`pauză: ${msg}`)
      pauseNote = `Pauza a EȘUAT (${msg}) — pune grupurile pe pauză manual în Google Ads.`
    }
  }
  log(`ads-guard: ${pauseNote}`)

  const lines = findings.map((f) => `<b>${escHtml(f.target.campaignName)}</b> › ${escHtml(f.target.adGroupName)} (${f.target.adGroupId})\n${f.problems.map((p) => `- ${escHtml(p)}`).join('\n')}`)
  await alert(deps, result, `${lines.join('\n\n')}\n\n${escHtml(pauseNote)}`)
  return result
}

async function alert(deps: GuardDeps, result: GuardResult, body: string) {
  const text = `<b>superieftin.ro — garda reclamelor</b>\n\n${body}`
  result.alerted = await (deps.notify ?? ((t: string) => notifyAdmin(t, 'alerta gărzii de reclame')))(text)
}

// Pentru jobul BullMQ (sync.worker.ts): intoarce un rezumat mic pentru log.
export async function runAdsGuardJob(log: (m: string) => void) {
  const r = await runAdsGuard({ log })
  return { checked: r.checked, failing: r.failing, paused: r.paused, validatedOnly: r.validatedOnly, alerted: r.alerted, errors: r.errors.length }
}
