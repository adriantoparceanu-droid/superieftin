import { readFileSync } from 'fs'
import pool from '../lib/db.js'
import { runTrackingSync, summarize, type SyncMode, type SyncFixture } from './sync.js'

// npm run tracking:sync [-- optiuni]
//
//   (fara optiuni)          plan: actualizeaza baza locala si arata ce AR trimite. Nimic la Google.
//   --confirm               cu ADS_ENV=test → cereri validate_only (Google verifica, nu aplica)
//   --confirm --prod        trimitere REALA — doar cu ADS_ENV=prod (REGULI.md, regulile 3–4)
//   --fixture=cale.json     comisioane de test in loc de API-uri: lista de randuri Profitshare
//                           (formatul API) SAU { "profitshare": [...], "2performant": [...] }.
//                           Ruleaza intr-o tranzactie ANULATA la final (baza ramane neatinsa)
//                           si e refuzat la trimiterea reala.
//   --conversion-action=ID  suprascrie GOOGLE_ADS_CONVERSION_ACTION_ID (doar pentru teste)

const args = process.argv.slice(2)
const has = (f: string) => args.includes(f)
const val = (f: string) => args.find((a) => a.startsWith(f + '='))?.slice(f.length + 1)

async function main() {
  const adsEnv = (process.env.ADS_ENV || 'test').trim()
  let mode: SyncMode = 'plan'
  if (has('--confirm')) {
    if (adsEnv === 'prod') {
      if (!has('--prod')) throw new Error('ADS_ENV=prod: trimiterea reală cere și --prod (regula 4)')
      mode = 'send'
    } else {
      if (has('--prod')) throw new Error('--prod cere ADS_ENV=prod în .env')
      mode = 'validate'
    }
  }

  const fixturePath = val('--fixture')
  const fixture = fixturePath ? JSON.parse(readFileSync(fixturePath, 'utf8')) as SyncFixture : undefined
  if (fixture && mode === 'send') throw new Error('Refuz: fixture + trimitere reală')

  console.log(`tracking:sync · mod=${mode} · ADS_ENV=${adsEnv}${fixture ? ` · fixture (${Array.isArray(fixture) ? fixture.length : (fixture.profitshare?.length ?? 0) + (fixture['2performant']?.length ?? 0)} rânduri, tranzacție anulată la final)` : ''}`)

  // Cu fixture lucram pe o singura conexiune, intr-o tranzactie pe care o anulam la final
  const client = fixture ? await pool.connect() : null
  try {
    if (client) await client.query('BEGIN')
    const result = await runTrackingSync({
      mode, db: client ?? pool, fixture, conversionActionId: val('--conversion-action'),
    })
    for (const e of result.errors) console.log(`  ✗ ${e.action} comanda ${e.externalId}: ${e.error}`)
    console.log(summarize(result))
    if (mode === 'plan' && result.plan.uploads + result.plan.retractions > 0) {
      console.log('Mod plan: nimic trimis la Google. Pentru validare: npm run tracking:sync -- --confirm (cu ADS_ENV=test).')
    }
    process.exitCode = result.errors.length ? 1 : 0
  } finally {
    if (client) {
      await client.query('ROLLBACK')
      client.release()
    }
    await pool.end()
  }
}

main().catch((err) => {
  console.error('✗', err.message)
  process.exit(1)
})
