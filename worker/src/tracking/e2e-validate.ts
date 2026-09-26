import { randomBytes } from 'crypto'
import pool from '../lib/db.js'
import { runTrackingSync, summarize } from './sync.js'
import type { PsCommissionRaw } from '../lib/profitshare.js'

// Test cap-coada pentru POARTA 2, DOAR cu validate_only (REGULI.md regula 4):
//   click cu gclid inventat (cu acord) → comision Profitshare fals (fixture) → potrivire →
//   plan → upload VALIDAT (Data Manager) + retragere VALIDATA (Google Ads API).
// Totul ruleaza intr-o tranzactie ANULATA la final: baza locala ramane neatinsa.
// Google respinge / nu gaseste clickul inventat — o eroare despre gclid / conversie (nu una de
// autentificare sau format) dovedeste ca cererea e corecta.
//
//   npm run tracking:e2e [-- --conversion-action=ID]   (implicit GOOGLE_ADS_CONVERSION_ACTION_ID)
// Refuza sa ruleze daca ADS_ENV nu e test.

async function main() {
  if ((process.env.ADS_ENV || 'test').trim() !== 'test') throw new Error('tracking:e2e rulează DOAR cu ADS_ENV=test')
  const actionArg = process.argv.find((a) => a.startsWith('--conversion-action='))?.split('=')[1]
  const tag = randomBytes(3).toString('hex')
  const clickId = `e2e${tag}abcd`
  const gclid = `TeSt_gclid_inventat_E2E_${tag}`
  const orderTime = new Date(Date.now() - 12 * 3600_000)
  // order_date in formatul Profitshare (ora Romaniei, fara fus)
  const ro = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Bucharest', dateStyle: 'short', timeStyle: 'medium' }).format(orderTime)

  const fixture: PsCommissionRaw[] = [
    { order_id: `e2e-up-${tag}`, order_status: 'pending', advertiser_id: 35, hash: clickId, order_date: ro,
      items_status: 'pending|pending', items_commision: '10.00|5.40', items_commision_value: '3.00|3.00' },
    { order_id: `e2e-rt-${tag}`, order_status: 'canceled', advertiser_id: 35, hash: clickId, order_date: ro,
      items_status: 'canceled', items_commision: '7.00', items_commision_value: '3.00' },
  ]

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(
      `INSERT INTO ad_clicks (click_id, network, gclid, has_ad_consent, created_at) VALUES ($1, 'profitshare', $2, true, now() - interval '1 day')`,
      [clickId, gclid])
    // Comanda „deja trimisa” si apoi anulata → trebuie retrasa (uploaded_at simulat, in tranzactie)
    await client.query(`
      INSERT INTO affiliate_conversions (network, external_id, click_id, ad_click_id, status, commission_amount, order_time, uploaded_at, uploaded_value)
      VALUES ('profitshare', $1, $2, (SELECT id FROM ad_clicks WHERE click_id = $2), 'pending', 7, $3, now() - interval '6 hours', 7)
    `, [`e2e-rt-${tag}`, clickId, orderTime])
    console.log(`Click de test: click_id=${clickId}, gclid=…${gclid.slice(-6)} (inventat), acord=da · ${fixture.length} comisioane fixture\n`)

    console.log('— 1. PLAN —')
    const p = await runTrackingSync({ mode: 'plan', db: client, fixture, conversionActionId: actionArg })
    console.log(summarize(p) + '\n')

    console.log('— 2. VALIDATE (validate_only) —')
    const v = await runTrackingSync({ mode: 'validate', db: client, fixture, conversionActionId: actionArg })
    for (const e of v.errors) console.log(`  ✗ ${e.action} comanda ${e.externalId}:\n      ${e.error}`)
    console.log(summarize(v))
    const st = await client.query(`SELECT external_id, uploaded_at IS NOT NULL AS trimis, retracted_at IS NOT NULL AS retras FROM affiliate_conversions WHERE external_id LIKE $1 ORDER BY 1`, [`e2e-%-${tag}`])
    console.log('\nStare după validare (uploaded_at/retracted_at NU trebuie să se schimbe):', JSON.stringify(st.rows))
  } finally {
    await client.query('ROLLBACK')
    client.release()
    await pool.end()
    console.log('Tranzacție anulată — nimic salvat în baza locală, nimic aplicat în Google Ads.')
  }
}

main().catch((err) => { console.error('✗', err.message); process.exit(1) })
