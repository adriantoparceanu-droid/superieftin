// Comenzile campaniilor Google Ads (Faza 3). Rulare din worker/:
//
//   npm run ads:validate                     verifica YAML-urile + paginile live (nu atinge contul)
//   npm run ads:validate -- --offline        doar verificarile statice (fara retea)
//   npm run ads:plan                         citeste contul si arata diferentele (NU scrie nimic)
//   npm run ads:apply                        = plan (mod implicit, nu trimite nimic)
//   npm run ads:apply -- --confirm           ADS_ENV=test → trimite cu validate_only (Google verifica, nu creeaza)
//   npm run ads:apply -- --confirm --prod    ADS_ENV=prod → SCRIERE REALA (totul nou = PAUSED)
//   optional la plan/apply: --only=<fisier>  (ex. --only=samsung-pliabile)
//   npm run ads:guard                        garda: verifica landing-urile grupurilor active (nu trimite nimic)
//   npm run ads:guard -- --confirm           + pauza grupurilor cu probleme (pauseOnly: reala doar in prod
//                                            sau cu ADS_GUARD_REAL_PAUSE=1, altfel validate_only) + Telegram
//
// Poarta policy-reviewer (regula 10): scrierea reala cere ads/campaigns/.review/<fisier>.pass
// cu hash-ul continutului — vezi review.ts. Hash-ul il afiseaza ads:validate.

import { writeFileSync, readFileSync } from 'node:fs'
import { configFromEnv, mutateAll, AdsApiError } from '../google-ads.js'
import { loadAllCampaigns, loadGuardrails, contentHash, writeIds, type CampaignFile, type IdPath } from './schema.js'
import { validateAll, validateLive, type Issue } from './validate.js'
import { readAccount } from './account.js'
import { buildPlan, formatPlan, planOps, summarize, type Plan } from './plan.js'
import { checkReview } from './review.js'
import { runAdsGuard } from './guard.js'

const args = process.argv.slice(2)
const cmd = args[0]
const flag = (f: string) => args.includes(f)
const only = args.find((a) => a.startsWith('--only='))?.slice('--only='.length)

function printIssues(issues: Issue[]) {
  for (const i of issues) console.log(`  ${i.level === 'error' ? '✗' : '!'} ${i.where}: ${i.msg}`)
}

async function runValidation(files: CampaignFile[], live: boolean) {
  const g = loadGuardrails()
  const issues = validateAll(files, g)
  if (live) issues.push(...(await validateLive(files, g)).issues)
  return { g, issues, errors: issues.filter((i) => i.level === 'error'), warns: issues.filter((i) => i.level === 'warn') }
}

async function cmdValidate() {
  const files = loadAllCampaigns()
  if (!files.length) { console.log('Niciun fișier de campanie în ads/campaigns/ (cele cu „_” sunt ignorate).'); return }
  const live = !flag('--offline')
  console.log(`ads:validate · ${files.length} campanii · ${live ? 'cu verificări live pe www.superieftin.ro' : 'doar static (--offline)'}\n`)
  const { g, errors, warns, issues } = await runValidation(files, live)
  for (const f of files) {
    const c = f.campaign
    const kw = c.ad_groups.reduce((s, ag) => s + (ag.keywords.exact?.length ?? 0) + (ag.keywords.phrase?.length ?? 0), 0)
    const mine = issues.filter((i) => i.where.startsWith(f.rel))
    const e = mine.filter((i) => i.level === 'error').length
    console.log(`${e ? '✗' : '✓'} ${f.rel} — „${c.name}” · ${c.daily_budget} lei/zi · ${c.bidding.strategy} max ${c.bidding.max_cpc} lei · ${c.ad_groups.length} grupuri · ${kw} cuvinte · ${(c.negative_keywords ?? []).length} negative`)
    console.log(`    hash review: ${contentHash(f.raw)}`)
    printIssues(mine)
  }
  const rest = issues.filter((i) => !files.some((f) => i.where.startsWith(f.rel)))
  printIssues(rest)
  const total = files.reduce((s, f) => s + f.campaign.daily_budget, 0)
  console.log(`\nBuget total YAML: ${total} lei/zi (plafon ${g.budget.max_daily_total}) · ~${Math.round(total * 30.4)} lei/lună (plafon ${g.budget.max_monthly_total})`)
  console.log(errors.length ? `\n✗ ${errors.length} erori, ${warns.length} avertismente` : `\n✓ Fără erori (${warns.length} avertismente)`)
  if (errors.length) process.exit(1)
}

async function loadPlan(files: CampaignFile[]) {
  const cfg = configFromEnv()
  const acc = await readAccount(cfg)
  const plan = buildPlan(files, acc, cfg.customerId)
  // Guardrails la nivel de cont: bugetele campaniilor ACTIVE din afara YAML-ului + toate
  // campaniile din YAML (care pot fi activate oricand) nu trec de plafonul total.
  const g = loadGuardrails()
  const managed = new Set(plan.campaigns.map((c) => c.account?.id).filter(Boolean))
  const otherActive = acc.campaigns.filter((c) => !managed.has(c.id) && c.status === 'ENABLED').reduce((s, c) => s + c.budgetMicros / 1e6, 0)
  const yamlTotal = loadAllCampaigns().reduce((s, f) => s + f.campaign.daily_budget, 0)
  if (otherActive + yamlTotal > g.budget.max_daily_total) plan.errors.push(`campanii active din afara YAML (${otherActive} lei/zi) + YAML (${yamlTotal} lei/zi) depășesc plafonul total de ${g.budget.max_daily_total} lei/zi`)
  return { cfg, plan }
}

function selected(): CampaignFile[] {
  const files = loadAllCampaigns()
  if (!only) return files
  const f = files.filter((x) => x.slug === only)
  if (!f.length) throw new Error(`--only=${only}: nu există ads/campaigns/${only}.yaml`)
  return f
}

async function cmdPlan() {
  const files = selected()
  const { issues, errors } = await runValidation(loadAllCampaigns(), false)
  if (issues.length) { console.log('Validare statică:'); printIssues(issues); console.log('') }
  const { cfg, plan } = await loadPlan(files)
  console.log(`ads:plan · cont ${cfg.customerId} · ADS_ENV=${cfg.env} · DOAR CITIRE, nimic nu se scrie\n`)
  console.log(formatPlan(plan))
  if (errors.length || plan.errors.length || plan.campaigns.some((c) => c.errors.length)) {
    console.log('\n✗ Planul are erori — ads:apply ar refuza.')
    process.exit(1)
  }
}

// Indexul operatiei cu probleme, din eroarea Google (location.fieldPathElements[0].index)
function explainApiError(err: AdsApiError, ops: { label: string }[]) {
  console.error(`✗ HTTP ${err.httpStatus} · ${err.codes.join(', ') || '-'}\n  ${err.message}`)
  const raw: any = err.raw
  for (const d of raw?.error?.details ?? []) for (const e of d?.errors ?? []) {
    const idx = e?.location?.fieldPathElements?.find((p: any) => p.fieldName === 'mutate_operations')?.index
    const code = Object.entries(e.errorCode ?? {}).map(([k, v]) => `${k}.${v}`).join(',')
    const trig = e?.trigger?.stringValue ? ` (declanșat de „${e.trigger.stringValue}”)` : ''
    const policy = e?.details?.policyFindingDetails?.policyTopicEntries?.map((t: any) => t.topic).join(', ')
    console.error(`  · op #${idx ?? '?'} ${idx != null ? `[${ops[idx]?.label.trim()}]` : ''}: ${code} — ${e.message}${trig}${policy ? ` · politică: ${policy}` : ''}`)
  }
}

async function cmdApply() {
  const confirm = flag('--confirm'), prodFlag = flag('--prod')
  const files = selected()

  // 1. Validare completa (statica + live). Orice eroare → refuz.
  console.log('1/4 Validare (statică + live pe site)…')
  const { errors, warns } = await runValidation(loadAllCampaigns(), true)
  if (warns.length) printIssues(warns)
  if (errors.length) { printIssues(errors); console.error(`\n✗ Refuz: ${errors.length} erori de validare (rulează npm run ads:validate).`); process.exit(1) }

  // 2. Planul (citire cont)
  console.log('2/4 Citire cont + plan…')
  const { cfg, plan } = await loadPlan(files)
  const real = cfg.env === 'prod'
  if (confirm && real && !prodFlag) throw new Error('ADS_ENV=prod: scrierea reală cere și --prod (regula 4)')
  if (prodFlag && !real) throw new Error('--prod cere ADS_ENV=prod în .env (regula 4)')
  console.log(`\n${formatPlan(plan)}\n`)
  if (plan.errors.length || plan.campaigns.some((c) => c.errors.length)) { console.error('✗ Refuz: planul are erori.'); process.exit(1) }

  // 3. Poarta policy-reviewer (regula 10) — pentru fiecare campanie cu modificari
  console.log('3/4 Verdict policy-reviewer (.review/<campanie>.pass)…')
  let reviewOk = true
  for (const cp of plan.campaigns) {
    if (!cp.ops.length && !cp.knownIds.length) { console.log(`  · ${cp.file.rel}: fără schimbări`); continue }
    const r = checkReview(cp.file)
    console.log(`  ${r.ok ? '✓' : '✗'} ${cp.file.rel}: ${r.reason}`)
    if (!r.ok) reviewOk = false
  }
  if (!reviewOk && real) { console.error('\n✗ Refuz: lipsește un PASS valid de la policy-reviewer (regula 10).'); process.exit(1) }
  if (!reviewOk) console.log('  ! ADS_ENV=test (validate_only, nu se creează nimic): continui, dar scrierea reală ar fi REFUZATĂ fără PASS.')

  const ops = planOps(plan)
  if (!confirm) {
    console.log(`\n4/4 Mod plan: nimic trimis (${summarize(plan).total} operații). Validare la Google: --confirm (cu ADS_ENV=test).`)
    return
  }
  if (!ops.length) {
    console.log('\n4/4 Nimic de trimis — contul e deja la zi.')
    if (real) writeBack(plan, [])
    return
  }

  // 4. Trimitere: O SINGURA cerere atomica (ori tot, ori nimic)
  console.log(`\n4/4 Trimit ${ops.length} operații într-o cerere ${real ? '— SCRIERE REALĂ (totul nou = PAUSED)' : 'cu validate_only (Google verifică, NU creează)'}…`)
  let res: any
  try {
    res = await mutateAll(cfg, ops.map((o) => o.op), { validateOnly: !real })
  } catch (err) {
    if (err instanceof AdsApiError) { explainApiError(err, ops); process.exit(1) }
    throw err
  }
  if (!real) {
    console.log('\n✓ Google a validat toate operațiile (validate_only) — NIMIC nu a fost creat în cont.')
    return
  }
  const responses: any[] = res?.mutateOperationResponses ?? []
  writeBack(plan, responses)
  console.log(`\n✓ Aplicat: ${ops.length} operații. Campaniile, grupurile și anunțurile noi sunt PAUSED.`)
  console.log('  Campaniile sunt PAUSED. Activarea o faci tu în Google Ads după verificare.')
}

// Scrie in YAML ID-urile primite de la Google (ca urmatorul apply sa nu dubleze nimic)
function writeBack(plan: Plan, responses: any[]) {
  const ops = planOps(plan)
  const byFile = new Map<string, { path: IdPath; value: string }[]>()
  const push = (file: string, path: IdPath, value: string) => {
    if (!byFile.has(file)) byFile.set(file, [])
    byFile.get(file)!.push({ path, value })
  }
  ops.forEach((o, i) => {
    if (!o.writeId) return
    const rn: string | undefined = (Object.values(responses[i] ?? {})[0] as any)?.resourceName
    if (!rn) return
    const last = rn.split('/').pop()!
    push(o.writeId.file, o.writeId.path, o.writeId.from === 'afterTilde' ? last.split('~').pop()! : last)
  })
  for (const cp of plan.campaigns) for (const k of cp.knownIds) if (k.value) push(cp.file.file, k.path, k.value)
  for (const [file, ids] of byFile) {
    writeFileSync(file, writeIds(readFileSync(file, 'utf8'), ids))
    console.log(`  ID-uri scrise în ${file.split('/ads/')[1] ? 'ads/' + file.split('/ads/')[1] : file}: ${ids.map((x) => `${x.path.join('.')}=${x.value}`).join(', ')}`)
  }
}

async function main() {
  if (cmd === 'validate') return cmdValidate()
  if (cmd === 'plan') return cmdPlan()
  if (cmd === 'apply') return cmdApply()
  if (cmd === 'guard') {
    const r = await runAdsGuard({ mode: flag('--confirm') ? 'send' : 'check' })
    console.log(`\nads:guard · cont citit: ${r.accountRead ? 'da' : 'nu'} · ${r.checked} grupuri · ${r.failing} cu probleme · ${r.paused} puse pe pauză · ${r.validatedOnly} doar validate${r.errors.length ? ` · erori: ${r.errors.join('; ')}` : ''}`)
    return
  }
  if (cmd === 'hash') {
    for (const f of loadAllCampaigns()) console.log(`${contentHash(f.raw)}  ${f.rel}`)
    return
  }
  console.log('Folosire: tsx src/ads/campaigns/cli.ts validate|plan|apply|guard|hash')
  process.exit(2)
}

main().catch((err) => {
  if (err instanceof AdsApiError) console.error(`✗ HTTP ${err.httpStatus} · ${err.codes.join(', ')}\n  ${err.message}`)
  else console.error('✗', err.message)
  process.exit(1)
})
