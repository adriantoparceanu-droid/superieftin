import { configFromEnv, listAccessibleCustomers, search, mutate, AdsApiError, API_VERSION } from './google-ads.js'

// Test de conexiune Google Ads API (Faza 0, punctul 5). Nu modifica NIMIC in cont.
// Rulare: cd worker && npm run ads:check
//   1. token de acces din refresh token
//   2. conturile accesibile — contul nostru trebuie sa fie printre ele
//   3. citire: datele contului (nume, moneda, fus orar)
//   4. scriere cu validate_only: un buget de campanie — Google il verifica, dar NU il creeaza

// Ce inseamna erorile frecvente, pe romaneste
const HINTS: Record<string, string> = {
  'authorizationError.USER_PERMISSION_DENIED': 'Contul Google cu care te-ai logat nu are acces la contul de reclame (sau LOGIN_CUSTOMER_ID e completat greșit).',
  'authorizationError.DEVELOPER_TOKEN_PROHIBITED': 'Developer token-ul nu e permis pentru acest proiect Cloud.',
  'authenticationError.DEVELOPER_TOKEN_NOT_PROVIDED' : 'Google cere încă developer token — schimbarea din sep. 2026 nu e activă pentru proiect.',
  'authorizationError.CUSTOMER_NOT_ENABLED': 'Contul de reclame nu e activat complet (lipsesc datele de facturare / setup-ul inițial).',
  'CLOUD_PROJECT_NOT_APPROVED_FOR_PRODUCTION': 'Proiectul Cloud are doar acces Test — cere nivelul Explorer (ghid, Pasul 7).',
  'SERVICE_DISABLED': 'Google Ads API nu e activat în proiectul Cloud (ghid, Pasul 2).',
  'invalid_grant': 'Refresh token invalid sau revocat — rulează din nou npm run ads:auth.',
}

function explain(err: unknown): string {
  if (!(err instanceof AdsApiError)) return String((err as Error)?.message ?? err)
  const hints = err.codes.map((c) => Object.entries(HINTS).find(([k]) => c.includes(k))?.[1]).filter(Boolean)
  return `HTTP ${err.httpStatus} · ${err.codes.join(', ') || '-'}\n    ${err.message}` +
    (hints.length ? `\n    → ${[...new Set(hints)].join('\n    → ')}` : '')
}

async function step(label: string, fn: () => Promise<string>): Promise<boolean> {
  try {
    console.log(`✓ ${label}: ${await fn()}`)
    return true
  } catch (err) {
    console.log(`✗ ${label}\n    ${explain(err)}`)
    return false
  }
}

async function main() {
  const cfg = configFromEnv()
  console.log(`Google Ads API ${API_VERSION} · cont ${cfg.customerId} · ADS_ENV=${cfg.env}` +
    ` · developer token: ${cfg.developerToken ? 'da' : 'nu'} · MCC: ${cfg.loginCustomerId ? 'da' : 'nu'}\n`)

  const ok1 = await step('Conturi accesibile', async () => {
    const r = await listAccessibleCustomers(cfg)
    const ids = (r.resourceNames ?? []).map((n) => n.split('/')[1])
    if (!ids.includes(cfg.customerId)) throw new Error(`contul ${cfg.customerId} NU e în listă (${ids.join(', ') || 'niciunul'})`)
    return `${ids.length} (contul nostru e inclus)`
  })
  if (!ok1) return process.exit(1)

  const ok2 = await step('Citire cont', async () => {
    const r = await search(cfg, 'SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.time_zone, customer.manager, customer.test_account FROM customer')
    const c = r.results?.[0]?.customer ?? {}
    return `„${c.descriptiveName ?? '-'}” · ${c.currencyCode} · ${c.timeZone} · manager=${c.manager} · test=${c.testAccount}`
  })

  const ok3 = await step('Scriere validate_only (buget de test, NU se creează)', async () => {
    await mutate(cfg, 'campaignBudgets', [{
      create: { name: `SE validate ${new Date().toISOString()}`, amountMicros: '1000000', deliveryMethod: 'STANDARD', explicitlyShared: false },
    }], { validateOnly: true })
    return 'Google a acceptat cererea (validare trecută, nimic creat)'
  })

  console.log(ok2 && ok3 ? '\nConexiunea funcționează ✓' : '\nConexiunea are probleme — vezi mai sus.')
  process.exit(ok2 && ok3 ? 0 : 1)
}

main().catch((err) => { console.error('✗', explain(err)); process.exit(1) })
