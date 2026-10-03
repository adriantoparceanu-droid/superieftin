import { configFromEnv, search, mutate, AdsApiError } from './google-ads.js'
import { ACTION_NAME, isKnownActionName } from './conversion-names.js'

// Actiunea de conversie „Comision afiliere” (fost „Comision Profitshare”) — conversia PRINCIPALA
// a contului: comisioanele Profitshare + 2Performant (REGULI.md → GA4: click_affiliate_link
// ramane secundara, altfel Google numara dublu).
//
//   npm run ads:conversion-action                         plan: arata daca exista / ce ar crea
//   npm run ads:conversion-action -- --confirm            ADS_ENV=test → validate_only (nu creeaza)
//   npm run ads:conversion-action -- --confirm --prod     ADS_ENV=prod → CREARE REALA
//
// Dupa crearea reala: pune ID-ul afisat in .env → GOOGLE_ADS_CONVERSION_ACTION_ID=...
// (tracking:sync il foloseste ca destinatie a conversiilor).

export { ACTION_NAME }

// De ce aceste setari:
//  - UPLOAD_CLICKS: conversii importate de noi (offline), legate de gclid/gbraid/wbraid;
//  - PURCHASE + principala: e venitul real, pe el vrem sa optimizeze licitarea;
//  - MANY_PER_CLICK: un click poate aduce mai multe comenzi, fiecare cu comisionul ei;
//  - valoarea vine din fiecare conversie (comisionul, RON), fara valoare implicita;
//  - fereastra de click 90 de zile: maximul permis; comenzile vin de regula in cateva zile,
//    dar cookie-urile retelelor de afiliere pot atribui si mai tarziu.
export function conversionActionCreate() {
  return {
    name: ACTION_NAME,
    type: 'UPLOAD_CLICKS',
    category: 'PURCHASE',
    status: 'ENABLED',
    primaryForGoal: true,
    countingType: 'MANY_PER_CLICK',
    clickThroughLookbackWindowDays: '90',
    valueSettings: { defaultValue: 0, defaultCurrencyCode: 'RON', alwaysUseDefaultValue: false },
  }
}

async function main() {
  const args = process.argv.slice(2)
  const cfg = configFromEnv()
  // Cautare toleranta la redenumire: intai dupa ID-ul din .env (asa o identifica Google), apoi
  // dupa numele nou SAU vechi — altfel, cat timp contul are inca numele vechi, scriptul ar
  // propune crearea unei a doua actiuni (conversii numarate dublu).
  // GAQL nu are OR → citim toate actiunile ne-sterse (cateva) si filtram aici.
  const envId = process.env.GOOGLE_ADS_CONVERSION_ACTION_ID?.trim()
  const existing = await search(cfg, `SELECT conversion_action.id, conversion_action.name, conversion_action.type, conversion_action.status, conversion_action.primary_for_goal FROM conversion_action WHERE conversion_action.status != 'REMOVED'`)
  const rows = (existing.results ?? []).map((r: any) => r.conversionAction)
    .filter((a: any) => (envId && String(a.id) === envId) || isKnownActionName(a.name))
  const found = rows.find((a: any) => String(a.id) === envId) ?? rows[0]
  if (found) {
    console.log(`Există deja: „${found.name}” · ID ${found.id} · ${found.type} · ${found.status} · principală=${found.primaryForGoal}`)
    if (found.name !== ACTION_NAME) console.log(`→ are încă numele vechi: redenumește-o MANUAL în „${ACTION_NAME}” (Google Ads → Obiective → Conversii). ID-ul rămâne același, nimic de schimbat în cod/.env.`)
    if (envId && String(found.id) !== envId) console.log(`⚠ GOOGLE_ADS_CONVERSION_ACTION_ID din .env (${envId}) diferă de acțiunea găsită (${found.id}) — verifică.`)
    if (rows.length > 1) console.log(`⚠ ${rows.length} acțiuni găsite (${rows.map((a: any) => `${a.id} „${a.name}”`).join(', ')}) — trebuie să fie una singură.`)
    console.log(`→ în .env: GOOGLE_ADS_CONVERSION_ACTION_ID=${found.id}`)
    return
  }

  const create = conversionActionCreate()
  console.log(`Cont ${cfg.customerId} · ADS_ENV=${cfg.env}\nAcțiunea NU există. S-ar crea:\n${JSON.stringify(create, null, 2)}`)
  if (!args.includes('--confirm')) {
    console.log('\nMod plan: nimic trimis. Validare: npm run ads:conversion-action -- --confirm (cu ADS_ENV=test).')
    return
  }
  const real = cfg.env === 'prod'
  if (real && !args.includes('--prod')) throw new Error('ADS_ENV=prod: crearea reală cere și --prod (regula 4)')
  if (!real && args.includes('--prod')) throw new Error('--prod cere ADS_ENV=prod în .env')

  const res = await mutate<{ results?: { resourceName: string }[] }>(cfg, 'conversionActions', [{ create }], { validateOnly: !real })
  if (!real) {
    console.log('\n✓ Google a validat cererea (validate_only) — acțiunea NU a fost creată.')
    return
  }
  const rn = res.results?.[0]?.resourceName ?? ''
  console.log(`\n✓ Creată: ${rn}\n→ în .env: GOOGLE_ADS_CONVERSION_ACTION_ID=${rn.split('/').pop()}`)
}

main().catch((err) => {
  if (err instanceof AdsApiError) console.error(`✗ HTTP ${err.httpStatus} · ${err.codes.join(', ')}\n  ${err.message}`)
  else console.error('✗', err.message)
  process.exit(1)
})
