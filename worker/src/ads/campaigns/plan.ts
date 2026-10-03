// Planul: ce trebuie facut in cont ca sa arate ca YAML-ul. Functie PURA (primeste starea
// contului deja citita) — ads:plan doar o afiseaza, ads:apply trimite operatiile.
//
// Principii de siguranta (REGULI.md):
//  - orice campanie / grup / anunt NOU se creeaza PAUSED (regula 1);
//  - planul NU activeaza niciodata nimic si NU schimba statusul campaniilor existente
//    (activarea si pauza campaniei sunt ale proprietarului, in Google Ads / dashboard);
//  - ce a disparut din YAML: cuvinte cheie, grupuri si anunturi → PAUZA (nu stergere);
//    negative, geo/limba si extensii → eliminate (nu au status de pauza / nu cheltuie);
//  - totul pleaca intr-o SINGURA cerere googleAds:mutate (atomica, putine operatii API).
//
// Cuvintele cheie si extensiile noi se creeaza ENABLED, dar nu pot rula cat timp grupul si
// campania sunt PAUSED (regula 1 cere PAUSED pentru campanii, grupuri si anunturi). Asa,
// proprietarul activeaza doar 3 niveluri: campanie → grupuri → anunturi.

import type { CampaignFile, Keyword, IdPath, RsaAd } from './schema.js'
import { positiveKeywords, parseNegative, kwKey, formatKw } from './schema.js'
import type { AccountSnapshot, AccCampaign, AccAdGroup } from './account.js'
import { sitelinkKey, calloutKey, snippetKey } from './account.js'
import { ACTION_NAME, LEGACY_ACTION_NAMES } from '../conversion-names.js'

// Constante Google (verificate in cont pe 2026-09-27 prin GAQL)
export const GEO: Record<string, string> = { RO: '2642' }          // geoTargetConstants/2642 = Romania
export const LANG: Record<string, string> = { ro: '1032' }         // languageConstants/1032 = Romanian

const LINK_LABEL = '↳ legare extensie de campanie'

export type OpKind = 'create' | 'update' | 'pause' | 'remove'

export interface PlannedOp {
  kind: OpKind
  label: string                   // descriere pe romaneste, pentru afisare
  op: Record<string, unknown>     // MutateOperation (REST JSON)
  // Daca operatia creeaza ceva al carui ID trebuie scris in YAML dupa aplicare
  writeId?: { file: string; path: IdPath; from: 'last' | 'afterTilde' }
}

export interface CampaignPlan {
  file: CampaignFile
  status: 'new' | 'existing'
  account?: AccCampaign
  lines: string[]                 // lista afisata (inclusiv „fara schimbari”)
  ops: PlannedOp[]
  knownIds: { path: IdPath; value: string }[]   // ID-uri gasite dupa nume, de scris in YAML
  errors: string[]
  warnings: string[]
}

export interface Plan {
  campaigns: CampaignPlan[]
  sharedOps: PlannedOp[]          // ex. obiectivul de conversie personalizat (o data pe cont)
  errors: string[]
  warnings: string[]
  unmanaged: AccCampaign[]        // campanii din cont care nu apar in niciun YAML (neatinse)
}

const micros = (lei: number) => String(Math.round(lei * 100) * 10_000)   // multiplu de 0,01 lei
const lei = (m: number | string) => (Number(m) / 1e6).toFixed(2).replace('.', ',')

export function goalName(actionName: string) { return `SE | ${actionName}` }

// Obiectivul personalizat existent pentru o actiune. Cautare toleranta la redenumire: dupa
// numele curent, apoi dupa numele vechi ale actiunii („SE | Comision Profitshare”), apoi
// orice obiectiv care contine DOAR aceasta actiune (identificata dupa ID). Altfel, la
// redenumirea actiunii, planul ar crea un obiectiv nou si ar muta campaniile pe el.
export function findCustomGoal(goals: AccountSnapshot['customGoals'], actionName: string, actionRn: string) {
  const live = goals.filter((cg) => cg.status !== 'REMOVED')
  return live.find((cg) => cg.name === goalName(actionName))
    ?? live.find((cg) => LEGACY_ACTION_NAMES.some((n) => cg.name === goalName(n)))
    ?? live.find((cg) => cg.actions.length === 1 && cg.actions[0] === actionRn)
}

function sameRsa(ad: RsaAd, url: string, acc: { finalUrls: string[]; headlines: string[]; descriptions: string[]; path1: string; path2: string }) {
  const s = (a: string[]) => [...a].sort().join('\n')
  return s(ad.headlines) === s(acc.headlines) && s(ad.descriptions) === s(acc.descriptions)
    && (ad.path1 ?? '') === acc.path1 && (ad.path2 ?? '') === acc.path2 && acc.finalUrls[0] === url
}

function rsaBody(ad: RsaAd, url: string) {
  return {
    finalUrls: [url],
    responsiveSearchAd: {
      headlines: ad.headlines.map((text) => ({ text })),
      descriptions: ad.descriptions.map((text) => ({ text })),
      ...(ad.path1 ? { path1: ad.path1 } : {}),
      ...(ad.path2 ? { path2: ad.path2 } : {}),
    },
  }
}

export function buildPlan(files: CampaignFile[], acc: AccountSnapshot, customerId: string): Plan {
  const C = `customers/${customerId}`
  let tmp = 0
  const tempId = () => String(--tmp)
  const plan: Plan = { campaigns: [], sharedOps: [], errors: [], warnings: [], unmanaged: [] }

  // --- Obiectivul de conversie: „Comision afiliere” ca singura conversie a campaniilor ---------
  // Contul nu are obiective implicite folosite la licitare, deci legam fiecare campanie de un
  // obiectiv personalizat care contine DOAR aceasta actiune (click_affiliate_link ramane secundara).
  const goalRefs = new Map<string, string>()   // conversion_action_id → resourceName obiectiv (real sau temporar)
  for (const f of files) {
    const g = f.campaign.conversion_goal
    if (!g?.conversion_action_id || goalRefs.has(g.conversion_action_id)) continue
    const actionRn = `${C}/conversionActions/${g.conversion_action_id}`
    const action = acc.conversionActions.find((a) => a.id === g.conversion_action_id)
    if (!action) plan.errors.push(`acțiunea de conversie ${g.conversion_action_id} („${g.name}”) nu există în cont`)
    else {
      // Potrivirea e dupa ID; numele diferit doar avertizeaza (nu blocheaza planul / apply-ul)
      if (action.name !== g.name) {
        if (LEGACY_ACTION_NAMES.includes(action.name) && g.name === ACTION_NAME) plan.warnings.push(`acțiunea ${g.conversion_action_id} are încă numele vechi „${action.name}” în cont — redenumește-o manual în „${ACTION_NAME}” (Obiective → Conversii); identificarea e după ID, nimic nu e blocat`)
        else plan.warnings.push(`acțiunea ${g.conversion_action_id} se numește „${action.name}” în cont, nu „${g.name}”`)
      }
      if (action.status !== 'ENABLED') plan.errors.push(`acțiunea de conversie „${action.name}” are statusul ${action.status}`)
      if (!action.primaryForGoal) plan.warnings.push(`acțiunea „${action.name}” nu e principală (primary_for_goal=false)`)
    }
    const existing = findCustomGoal(acc.customGoals, g.name, actionRn)
    if (existing) {
      if (existing.name !== goalName(g.name)) plan.warnings.push(`obiectivul personalizat se numește „${existing.name}” în cont (folosit mai departe; opțional îl poți redenumi manual în „${goalName(g.name)}”)`)
      if (!existing.actions.includes(actionRn)) plan.warnings.push(`obiectivul „${existing.name}” există, dar nu conține acțiunea ${g.conversion_action_id} — verifică-l în Google Ads`)
      goalRefs.set(g.conversion_action_id, existing.resourceName)
    } else {
      const rn = `${C}/customConversionGoals/${tempId()}`
      goalRefs.set(g.conversion_action_id, rn)
      plan.sharedOps.push({
        kind: 'create',
        label: `obiectiv de conversie „${goalName(g.name)}” = doar „${g.name}” (${g.conversion_action_id})`,
        op: { customConversionGoalOperation: { create: { resourceName: rn, name: goalName(g.name), conversionActions: [actionRn], status: 'ENABLED' } } },
      })
    }
  }

  const managedIds = new Set<string>()

  for (const f of files) {
    const c = f.campaign
    const cp: CampaignPlan = { file: f, status: 'new', lines: [], ops: [], knownIds: [], errors: [], warnings: [] }
    plan.campaigns.push(cp)
    const add = (kind: OpKind, label: string, op: Record<string, unknown>, writeId?: PlannedOp['writeId']) => {
      cp.ops.push({ kind, label, op, writeId })
    }
    const same = (label: string) => cp.lines.push(`  = ${label}`)

    // Potrivire: dupa ID (daca e in YAML), altfel dupa nume
    let ac: AccCampaign | undefined
    if (c.id) {
      ac = acc.campaigns.find((x) => x.id === String(c.id))
      if (!ac) { cp.errors.push(`campania are id ${c.id} în YAML, dar nu există în cont (ștearsă?) — scoate id-ul doar dacă vrei s-o recreezi`); continue }
    } else {
      ac = acc.campaigns.find((x) => x.name === c.name)
      if (ac) cp.knownIds.push({ path: ['campaign', 'id'], value: ac.id }, { path: ['campaign', 'budget_id'], value: ac.budgetId })
    }
    const strategy = c.bidding.strategy
    const cpcCap = micros(c.bidding.max_cpc)
    const networkSettings = {
      targetGoogleSearch: true,
      targetSearchNetwork: !!c.targeting?.networks?.search_partners,
      targetContentNetwork: !!c.targeting?.networks?.display,
      targetPartnerSearchNetwork: false,
    }
    const biddingFields = strategy === 'MAXIMIZE_CLICKS'
      ? { targetSpend: { cpcBidCeilingMicros: cpcCap } }
      : { manualCpc: { enhancedCpcEnabled: false } }
    const goalRn = c.conversion_goal ? goalRefs.get(c.conversion_goal.conversion_action_id) : undefined

    let campaignRn: string
    if (!ac) {
      // ---------------- Campanie NOUA: totul se creeaza, cu ID-uri temporare ----------------
      cp.status = 'new'
      const budgetRn = `${C}/campaignBudgets/${tempId()}`
      campaignRn = `${C}/campaigns/${tempId()}`
      add('create', `buget ${lei(micros(c.daily_budget))} lei/zi`, {
        campaignBudgetOperation: { create: { resourceName: budgetRn, name: `${c.name} | buget`, amountMicros: micros(c.daily_budget), deliveryMethod: 'STANDARD', explicitlyShared: false } },
      }, { file: f.file, path: ['campaign', 'budget_id'], from: 'last' })
      add('create', `campanie „${c.name}” PAUSED · ${strategy === 'MAXIMIZE_CLICKS' ? `Maximizează clickurile, CPC max ${lei(cpcCap)}` : 'CPC manual'} · doar Search (fără parteneri, fără Display) · prezență în țară`, {
        campaignOperation: {
          create: {
            resourceName: campaignRn, name: c.name, status: 'PAUSED', advertisingChannelType: 'SEARCH',
            campaignBudget: budgetRn, ...biddingFields, networkSettings,
            geoTargetTypeSetting: { positiveGeoTargetType: 'PRESENCE', negativeGeoTargetType: 'PRESENCE' },
            containsEuPoliticalAdvertising: 'DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING',
          },
        },
      }, { file: f.file, path: ['campaign', 'id'], from: 'last' })
      if (goalRn) add('update', `conversie campanie: doar „${c.conversion_goal!.name}”`, {
        conversionGoalCampaignConfigOperation: {
          update: { resourceName: `${C}/conversionGoalCampaignConfigs/${campaignRn.split('/').pop()}`, goalConfigLevel: 'CAMPAIGN', customConversionGoal: goalRn },
          updateMask: 'goalConfigLevel,customConversionGoal',
        },
      })
    } else {
      // ---------------- Campanie EXISTENTA: doar diferentele ----------------
      cp.status = 'existing'
      cp.account = ac
      managedIds.add(ac.id)
      campaignRn = ac.resourceName
      cp.lines.push(`  (în cont: id ${ac.id}, status ${ac.status})`)
      if (ac.name !== c.name) add('update', `nume campanie „${ac.name}” → „${c.name}”`, { campaignOperation: { update: { resourceName: campaignRn, name: c.name }, updateMask: 'name' } })
      if (ac.budgetMicros !== Number(micros(c.daily_budget))) {
        if (ac.budgetShared) cp.warnings.push('bugetul campaniei e partajat cu alte campanii — modificarea le-ar afecta și pe ele')
        add('update', `buget ${lei(ac.budgetMicros)} → ${lei(micros(c.daily_budget))} lei/zi`, { campaignBudgetOperation: { update: { resourceName: ac.budgetResourceName, amountMicros: micros(c.daily_budget) }, updateMask: 'amountMicros' } })
      } else same(`buget ${lei(ac.budgetMicros)} lei/zi`)
      if (strategy === 'MAXIMIZE_CLICKS') {
        if (ac.biddingStrategyType !== 'TARGET_SPEND' || ac.cpcCeilingMicros !== Number(cpcCap)) add('update', `licitare → Maximizează clickurile, CPC max ${lei(cpcCap)}`, { campaignOperation: { update: { resourceName: campaignRn, targetSpend: { cpcBidCeilingMicros: cpcCap } }, updateMask: 'targetSpend.cpcBidCeilingMicros' } })
        else same(`licitare Maximizează clickurile, CPC max ${lei(cpcCap)}`)
      } else if (ac.biddingStrategyType !== 'MANUAL_CPC') {
        add('update', `licitare ${ac.biddingStrategyType} → CPC manual`, { campaignOperation: { update: { resourceName: campaignRn, manualCpc: { enhancedCpcEnabled: false } }, updateMask: 'manualCpc.enhancedCpcEnabled' } })
      } else same('licitare CPC manual')
      const n = ac.network
      if (n.googleSearch !== networkSettings.targetGoogleSearch || n.searchNetwork !== networkSettings.targetSearchNetwork
        || n.contentNetwork !== networkSettings.targetContentNetwork || n.partnerSearchNetwork !== networkSettings.targetPartnerSearchNetwork) {
        add('update', 'rețele → doar Search (fără parteneri, fără Display)', { campaignOperation: { update: { resourceName: campaignRn, networkSettings }, updateMask: 'networkSettings.targetGoogleSearch,networkSettings.targetSearchNetwork,networkSettings.targetContentNetwork,networkSettings.targetPartnerSearchNetwork' } })
      }
      if (ac.positiveGeoTargetType !== 'PRESENCE') add('update', `locație: ${ac.positiveGeoTargetType} → PRESENCE (doar persoane aflate în țară)`, { campaignOperation: { update: { resourceName: campaignRn, geoTargetTypeSetting: { positiveGeoTargetType: 'PRESENCE' } }, updateMask: 'geoTargetTypeSetting.positiveGeoTargetType' } })
      if (goalRn) {
        const gc = acc.goalConfigs.find((x) => x.campaignId === ac!.id)
        if (!gc || gc.level !== 'CAMPAIGN' || gc.customGoal !== goalRn) add('update', `conversie campanie: doar „${c.conversion_goal!.name}”`, {
          conversionGoalCampaignConfigOperation: { update: { resourceName: `${C}/conversionGoalCampaignConfigs/${ac.id}`, goalConfigLevel: 'CAMPAIGN', customConversionGoal: goalRn }, updateMask: 'goalConfigLevel,customConversionGoal' },
        })
        else same(`conversie: doar „${c.conversion_goal!.name}”`)
      }
    }
    const campId = ac?.id

    // --- Geo + limba ---
    const wantGeo = (c.targeting?.countries ?? []).map((x) => {
      if (!GEO[x]) cp.errors.push(`țara ${x} nu are constantă geo cunoscută (adaug-o în plan.ts → GEO)`)
      return `geoTargetConstants/${GEO[x]}`
    })
    const wantLang = (c.targeting?.languages ?? []).map((x) => {
      if (!LANG[x]) cp.errors.push(`limba ${x} nu are constantă cunoscută (adaug-o în plan.ts → LANG)`)
      return `languageConstants/${LANG[x]}`
    })
    const accCrit = campId ? acc.criteria.filter((x) => x.campaignId === campId) : []
    for (const g of wantGeo) {
      if (accCrit.some((x) => x.type === 'LOCATION' && !x.negative && x.geo === g)) same(`locație ${g}`)
      else add('create', `locație ${Object.keys(GEO).find((k) => g.endsWith(GEO[k]))} (${g})`, { campaignCriterionOperation: { create: { campaign: campaignRn, location: { geoTargetConstant: g } } } })
    }
    for (const x of accCrit.filter((x) => x.type === 'LOCATION' && !wantGeo.includes(x.geo ?? ''))) add('remove', `locație ${x.geo}${x.negative ? ' (exclusă)' : ''} (nu e în YAML)`, { campaignCriterionOperation: { remove: x.resourceName } })
    for (const l of wantLang) {
      if (accCrit.some((x) => x.type === 'LANGUAGE' && x.lang === l)) same(`limbă ${l}`)
      else add('create', `limbă română (${l})`, { campaignCriterionOperation: { create: { campaign: campaignRn, language: { languageConstant: l } } } })
    }
    for (const x of accCrit.filter((x) => x.type === 'LANGUAGE' && !wantLang.includes(x.lang ?? ''))) add('remove', `limbă ${x.lang} (nu e în YAML)`, { campaignCriterionOperation: { remove: x.resourceName } })

    // --- Negative la nivel de campanie ---
    const wantNeg = (c.negative_keywords ?? []).map(parseNegative)
    const accNeg = accCrit.filter((x) => x.type === 'KEYWORD' && x.negative)
    const accNegKeys = new Set(accNeg.map((x) => kwKey({ text: (x.text ?? '').toLowerCase(), matchType: x.matchType as Keyword['matchType'] })))
    const newNeg = wantNeg.filter((k) => !accNegKeys.has(kwKey(k)))
    for (const k of newNeg) add('create', `negativ campanie ${formatKw(k)}`, { campaignCriterionOperation: { create: { campaign: campaignRn, negative: true, keyword: { text: k.text, matchType: k.matchType } } } })
    const wantNegKeys = new Set(wantNeg.map(kwKey))
    for (const x of accNeg) {
      const k = { text: (x.text ?? '').toLowerCase(), matchType: x.matchType as Keyword['matchType'] }
      if (!wantNegKeys.has(kwKey(k))) add('remove', `negativ campanie ${formatKw(k)} (nu e în YAML)`, { campaignCriterionOperation: { remove: x.resourceName } })
    }
    if (wantNeg.length - newNeg.length > 0) same(`${wantNeg.length - newNeg.length} negative de campanie`)

    // --- Grupuri de anunturi ---
    const accAgs = campId ? acc.adGroups.filter((x) => x.campaignId === campId) : []
    const matchedAgIds = new Set<string>()
    for (const [i, ag] of c.ad_groups.entries()) {
      const agCpc = micros(ag.max_cpc ?? c.bidding.max_cpc)
      let aag: AccAdGroup | undefined
      if (ag.id) {
        aag = accAgs.find((x) => x.id === String(ag.id))
        if (!aag) { cp.errors.push(`grupul „${ag.name}” are id ${ag.id}, dar nu există în campanie`); continue }
      } else {
        aag = accAgs.find((x) => x.name === ag.name)
        if (aag) cp.knownIds.push({ path: ['campaign', 'ad_groups', i, 'id'], value: aag.id })
      }
      let agRn: string
      const agLabel = `grup „${ag.name}”`
      if (!aag) {
        agRn = `${C}/adGroups/${tempId()}`
        add('create', `${agLabel} PAUSED${strategy === 'MANUAL_CPC' ? ` · CPC max ${lei(agCpc)} lei` : ''}`, {
          adGroupOperation: { create: { resourceName: agRn, campaign: campaignRn, name: ag.name, status: 'PAUSED', type: 'SEARCH_STANDARD', ...(strategy === 'MANUAL_CPC' ? { cpcBidMicros: agCpc } : {}) } },
        }, { file: f.file, path: ['campaign', 'ad_groups', i, 'id'], from: 'last' })
      } else {
        matchedAgIds.add(aag.id)
        agRn = aag.resourceName
        if (aag.name !== ag.name) add('update', `nume grup „${aag.name}” → „${ag.name}”`, { adGroupOperation: { update: { resourceName: agRn, name: ag.name }, updateMask: 'name' } })
        if (strategy === 'MANUAL_CPC' && aag.cpcMicros !== Number(agCpc)) add('update', `${agLabel}: CPC ${lei(aag.cpcMicros)} → ${lei(agCpc)} lei`, { adGroupOperation: { update: { resourceName: agRn, cpcBidMicros: agCpc }, updateMask: 'cpcBidMicros' } })
        else same(`${agLabel} (status ${aag.status})`)
      }

      // Cuvinte cheie (pozitive + negative de grup)
      const accKws = aag ? acc.keywords.filter((x) => x.adGroupId === aag!.id) : []
      const kwIndex = new Map(accKws.map((x) => [`${x.negative ? 'N' : 'P'}|${kwKey({ text: x.text.toLowerCase(), matchType: x.matchType as Keyword['matchType'] })}`, x]))
      const wantPos = positiveKeywords(ag)
      const wantAgNeg = (ag.negative_keywords ?? []).map(parseNegative)
      const wantKeys = new Set([...wantPos.map((k) => `P|${kwKey(k)}`), ...wantAgNeg.map((k) => `N|${kwKey(k)}`)])
      let kwSame = 0
      for (const k of wantPos) {
        const ex = kwIndex.get(`P|${kwKey(k)}`)
        if (!ex) add('create', `  cuvânt cheie ${formatKw(k)} în „${ag.name}”`, { adGroupCriterionOperation: { create: { adGroup: agRn, status: 'ENABLED', keyword: { text: k.text, matchType: k.matchType } } } })
        else { kwSame++; if (ex.status === 'PAUSED') cp.warnings.push(`${formatKw(k)} din „${ag.name}” e în pauză în cont — reactivarea o faci tu în Google Ads`) }
      }
      for (const k of wantAgNeg) {
        if (!kwIndex.has(`N|${kwKey(k)}`)) add('create', `  negativ ${formatKw(k)} în „${ag.name}”`, { adGroupCriterionOperation: { create: { adGroup: agRn, negative: true, keyword: { text: k.text, matchType: k.matchType } } } })
        else kwSame++
      }
      for (const x of accKws) {
        const key = `${x.negative ? 'N' : 'P'}|${kwKey({ text: x.text.toLowerCase(), matchType: x.matchType as Keyword['matchType'] })}`
        if (wantKeys.has(key)) continue
        const label = formatKw({ text: x.text, matchType: x.matchType as Keyword['matchType'] })
        if (x.negative) add('remove', `  negativ ${label} din „${ag.name}” (nu e în YAML)`, { adGroupCriterionOperation: { remove: x.resourceName } })
        else if (x.status !== 'PAUSED') add('pause', `  cuvânt cheie ${label} din „${ag.name}” (nu e în YAML)`, { adGroupCriterionOperation: { update: { resourceName: x.resourceName, status: 'PAUSED' }, updateMask: 'status' } })
      }
      if (kwSame) same(`  ${kwSame} cuvinte cheie/negative în „${ag.name}”`)

      // Anunturi RSA
      const accAds = aag ? acc.ads.filter((x) => x.adGroupId === aag!.id) : []
      const matchedAdIds = new Set<string>()
      for (const [j, ad] of (ag.ads ?? []).entries()) {
        const url = ad.final_url || ag.final_url
        let aad = ad.id ? accAds.find((x) => x.adId === String(ad.id)) : accAds.find((x) => !matchedAdIds.has(x.adId) && sameRsa(ad, url, x))
        if (ad.id && !aad) { cp.errors.push(`anunțul ads[${j}] din „${ag.name}” are id ${ad.id}, dar nu există în grup`); continue }
        if (!ad.id && aad) cp.knownIds.push({ path: ['campaign', 'ad_groups', i, 'ads', j, 'id'], value: aad.adId })
        if (!aad) {
          add('create', `  anunț RSA PAUSED în „${ag.name}” (${ad.headlines.length} titluri, ${ad.descriptions.length} descrieri) → ${url}`, {
            adGroupAdOperation: { create: { adGroup: agRn, status: 'PAUSED', ad: rsaBody(ad, url) } },
          }, { file: f.file, path: ['campaign', 'ad_groups', i, 'ads', j, 'id'], from: 'afterTilde' })
        } else {
          matchedAdIds.add(aad.adId)
          if (!sameRsa(ad, url, aad)) add('update', `  text/URL anunț ${aad.adId} în „${ag.name}” (reintră la aprobare Google)`, {
            adOperation: { update: { resourceName: aad.adResourceName, ...rsaBody(ad, url) }, updateMask: 'finalUrls,responsiveSearchAd.headlines,responsiveSearchAd.descriptions,responsiveSearchAd.path1,responsiveSearchAd.path2' },
          })
          else same(`  anunț ${aad.adId} în „${ag.name}” (status ${aad.status}, aprobare ${aad.approval || '-'})`)
        }
      }
      for (const x of accAds) if (!matchedAdIds.has(x.adId) && x.status !== 'PAUSED') add('pause', `  anunț ${x.adId} din „${ag.name}” (nu e în YAML)`, { adGroupAdOperation: { update: { resourceName: x.resourceName, status: 'PAUSED' }, updateMask: 'status' } })
    }
    for (const x of accAgs) if (!matchedAgIds.has(x.id) && x.status !== 'PAUSED') add('pause', `grup „${x.name}” (nu e în YAML)`, { adGroupOperation: { update: { resourceName: x.resourceName, status: 'PAUSED' }, updateMask: 'status' } })

    // --- Extensii (active) ---
    const accAssets = campId ? acc.assets.filter((x) => x.campaignId === campId) : []
    const wantAssets: { key: string; fieldType: string; label: string; asset: Record<string, unknown> }[] = []
    for (const s of c.extensions?.sitelinks ?? []) wantAssets.push({
      key: sitelinkKey(s.text, s.description1, s.description2, s.url), fieldType: 'SITELINK', label: `sitelink „${s.text}” → ${s.url}`,
      asset: { finalUrls: [s.url], sitelinkAsset: { linkText: s.text, ...(s.description1 ? { description1: s.description1, description2: s.description2 } : {}) } },
    })
    for (const t of c.extensions?.callouts ?? []) wantAssets.push({ key: calloutKey(t), fieldType: 'CALLOUT', label: `callout „${t}”`, asset: { calloutAsset: { calloutText: t } } })
    for (const s of c.extensions?.structured_snippets ?? []) wantAssets.push({
      key: snippetKey(s.header, s.values), fieldType: 'STRUCTURED_SNIPPET', label: `structured snippet „${s.header}: ${s.values.join(', ')}”`,
      asset: { structuredSnippetAsset: { header: s.header, values: s.values } },
    })
    const accAssetKeys = new Set(accAssets.map((x) => x.key))
    let assetSame = 0
    for (const w of wantAssets) {
      if (accAssetKeys.has(w.key)) { assetSame++; continue }
      const assetRn = `${C}/assets/${tempId()}`
      add('create', `${w.label} (+ legare de campanie)`, { assetOperation: { create: { resourceName: assetRn, ...w.asset } } })
      cp.ops.push({ kind: 'create', label: LINK_LABEL, op: { campaignAssetOperation: { create: { campaign: campaignRn, asset: assetRn, fieldType: w.fieldType } } } })
    }
    const wantAssetKeys = new Set(wantAssets.map((w) => w.key))
    for (const x of accAssets) if (!wantAssetKeys.has(x.key)) add('remove', `extensie ${x.key.split('|').slice(0, 2).join(' „')}” (nu e în YAML)`, { campaignAssetOperation: { remove: x.resourceName } })
    if (assetSame) same(`${assetSame} extensii`)
  }

  plan.unmanaged = acc.campaigns.filter((x) => !managedIds.has(x.id))
  return plan
}

export function planOps(plan: Plan): PlannedOp[] {
  return [...plan.sharedOps, ...plan.campaigns.flatMap((c) => c.ops)]
}

export function summarize(plan: Plan) {
  const ops = planOps(plan)
  const count = (k: OpKind) => ops.filter((o) => o.kind === k).length
  return { create: count('create'), update: count('update'), pause: count('pause'), remove: count('remove'), total: ops.length }
}

// Afisarea planului, pe romaneste
export function formatPlan(plan: Plan): string {
  const sym: Record<OpKind, string> = { create: '+', update: '~', pause: '‖', remove: '-' }
  const out: string[] = []
  if (plan.sharedOps.length) {
    out.push('Cont (o singură dată):')
    for (const o of plan.sharedOps) out.push(`  ${sym[o.kind]} ${o.label}`)
    out.push('')
  }
  for (const cp of plan.campaigns) {
    const c = cp.file.campaign
    out.push(`Campania „${c.name}” — ${cp.status === 'new' ? 'NOUĂ (se creează PAUSED)' : 'există în cont'}   [${cp.file.rel}]`)
    for (const l of cp.lines) out.push(l)
    // Negativele noi de campanie le grupam pe un rand, ca sa nu inunde lista
    const negPrefix = 'negativ campanie '
    const newNeg = cp.ops.filter((o) => o.kind === 'create' && o.label.startsWith(negPrefix))
    let negShown = false
    for (const o of cp.ops) {
      if (o.kind === 'create' && o.label.startsWith(negPrefix)) {
        if (!negShown) out.push(`  + ${newNeg.length} negative de campanie: ${newNeg.map((x) => x.label.slice(negPrefix.length)).join(', ')}`)
        negShown = true
        continue
      }
      if (o.label.startsWith(LINK_LABEL)) continue   // legarea extensiei de campanie: inclusa in randul extensiei
      out.push(`  ${sym[o.kind]} ${o.label}`)
    }
    if (!cp.ops.length) out.push('  (fără schimbări)')
    for (const w of cp.warnings) out.push(`  ! ${w}`)
    for (const e of cp.errors) out.push(`  ✗ ${e}`)
    if (cp.knownIds.length) out.push(`  i ID-uri găsite după nume (se scriu în YAML la apply): ${cp.knownIds.map((k) => `${k.path.join('.')}=${k.value}`).join(', ')}`)
    out.push('')
  }
  if (plan.unmanaged.length) {
    out.push('Campanii din cont fără fișier YAML (NU sunt atinse):')
    for (const u of plan.unmanaged) out.push(`  · „${u.name}” (id ${u.id}, ${u.status}, ${lei(u.budgetMicros)} lei/zi)`)
    out.push('')
  }
  for (const w of plan.warnings) out.push(`! ${w}`)
  for (const e of plan.errors) out.push(`✗ ${e}`)
  const s = summarize(plan)
  out.push(`Total: ${s.create} de creat, ${s.update} de modificat, ${s.pause} de pus pe pauză, ${s.remove} de eliminat · ${s.total} operații API într-o singură cerere (limita Explorer: 2.880/zi)`)
  return out.join('\n')
}
