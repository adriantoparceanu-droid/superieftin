import { ga4ConfigFromEnv, runReport, availableDimensions, accessToken, Ga4Error } from '../lib/ga4/client.js'
import { KINDS, affiliateFilter, dayRange } from '../lib/ga4/transform.js'
import { listSites, pickSite } from '../lib/ga4/search-console.js'

// Test de conexiune GA4 (doar CITIRE, nu scrie nimic nicaieri).
// Rulare: cd worker && npm run ga4:check
//   1. configurarea din .env (GA4_PROPERTY_ID, GA4_SERVICE_ACCOUNT_JSON)
//   2. token de acces pentru contul de serviciu
//   3. un raport pe ultimele 7 zile (utilizatori, sesiuni, clickuri spre magazine)
//   4. dimensiunile personalizate pentru magazin / produs / categorie (optionale)
//   5. accesul la Search Console (cuvintele cheie organice)

const HINTS: [RegExp, string][] = [
  [/PERMISSION_DENIED|403/, 'Contul de serviciu nu are acces la proprietate: GA4 → Admin → Gestionarea accesului la proprietate → adaugă emailul lui cu rolul Viewer.'],
  [/SERVICE_DISABLED|has not been used|is disabled/, 'Activează „Google Analytics Data API” în proiectul Google Cloud al contului de serviciu.'],
  [/invalid_grant|Invalid JWT/, 'Cheia contului de serviciu e invalidă sau a fost ștearsă — generează o cheie JSON nouă.'],
  [/NOT_FOUND|404/, 'GA4_PROPERTY_ID greșit: e numărul din GA4 → Admin → Detalii proprietate (nu ID-ul G-…).'],
]

async function main() {
  const cfg = ga4ConfigFromEnv()
  if (!cfg) {
    console.log('✗ GA4 neconfigurat: completează GA4_PROPERTY_ID și GA4_SERVICE_ACCOUNT_JSON în .env')
    process.exit(1)
  }
  console.log(`GA4 · proprietatea ${cfg.propertyId} · cont de serviciu ${cfg.clientEmail}\n`)

  await accessToken(cfg)
  console.log('✓ Token de acces (analytics.readonly)')

  const { start, end } = dayRange(7)
  const dateRanges = [{ startDate: start, endDate: end }]
  const [t, c] = await Promise.all([
    runReport(cfg, { dateRanges, dimensions: [], metrics: [{ name: 'totalUsers' }, { name: 'sessions' }, { name: 'screenPageViews' }] }),
    runReport(cfg, { dateRanges, dimensions: [], metrics: [{ name: 'eventCount' }], dimensionFilter: affiliateFilter }),
  ])
  const [users, sessions, views] = (t.rows?.[0]?.metricValues ?? []).map((v) => v.value)
  const clicks = c.rows?.[0]?.metricValues?.[0]?.value ?? '0'
  console.log(`✓ Raport ${start} → ${end} (fus orar ${t.metadata?.timeZone ?? '?'}): ${users ?? 0} utilizatori · ${sessions ?? 0} sesiuni · ${views ?? 0} afișări · ${clicks} clickuri spre magazine`)

  const dims = await availableDimensions(cfg)
  for (const spec of KINDS.filter((k) => k.dimension.startsWith('customEvent:'))) {
    console.log(dims.has(spec.dimension)
      ? `✓ Dimensiunea ${spec.dimension} (${spec.kind})`
      : `! Dimensiunea ${spec.dimension} nu e înregistrată — statisticile pe „${spec.kind}” vor lipsi.\n    GA4 → Admin → Definiții personalizate → Creează dimensiune: domeniu Eveniment, parametru „${spec.dimension.split(':')[1]}”.`)
  }

  // Search Console: nu opreste testul GA4 daca lipseste, doar spune ce e de facut
  try {
    const sites = (await listSites(cfg)).map((s) => s.siteUrl)
    const site = pickSite(sites, process.env.GSC_SITE_URL?.trim() || undefined)
    console.log(site
      ? `✓ Search Console: ${site}`
      : `! Search Console: contul nu are acces la superieftin.ro (vede: ${sites.join(', ') || 'nicio proprietate'}).\n    Search Console → Setări → Utilizatori și permisiuni → Adaugă utilizator: ${cfg.clientEmail}, permisiune „Restricționat”.`)
  } catch (err) {
    const msg = String((err as Error)?.message ?? err)
    console.log(/SERVICE_DISABLED|has not been used|is disabled/.test(msg)
      ? '! Search Console: activează „Google Search Console API” în proiectul Google Cloud (APIs & Services → Library).'
      : `! Search Console: ${msg}`)
  }

  console.log('\nConexiunea GA4 funcționează ✓')
}

main().catch((err) => {
  const msg = String((err as Error)?.message ?? err)
  const hint = HINTS.find(([re]) => re.test(msg))?.[1]
  console.error(`✗ ${err instanceof Ga4Error ? msg : (err as Error)?.stack ?? msg}${hint ? `\n    → ${hint}` : ''}`)
  process.exit(1)
})
