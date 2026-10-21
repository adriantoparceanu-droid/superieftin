// Calculează manual indicele lunar al prețurilor (/indice) și seria „Când să cumperi”
// (/cand-sa-cumperi) — același cod ca jobul BullMQ `price-index` (lib/price-index.ts).
//
// Utilizare (local, din worker/):
//   npm run price-index:now                              # ediția lunii încheiate + „Când să cumperi”
//   npm run price-index:now -- --month=2026-09 --retro   # o lună din trecut, marcată „calculat retroactiv”
//   npm run price-index:now -- --month=2026-09 --draft   # ciornă (published=false, nu apare pe site, se poate recalcula)
//   npm run price-index:now -- --timing-only             # doar „Când să cumperi”
//   npm run price-index:now -- --no-timing --month=…     # doar ediția
// Producție (containerul worker):
//   docker compose exec -T worker node worker/dist/scripts/price-index.js --month=2026-07 --retro
//
// O ediție PUBLICATĂ nu se rescrie (scriptul o sare). Corecțiile se fac printr-o notă vizibilă
// (price_index_editions.correction_note), nu prin recalculare. Luna în curs nu se poate calcula.
// DATABASE_URL vine din mediu (local: --env-file=../.env; prod: env-ul containerului).

import pool from '../lib/db.js'
import { computeBuyTiming, computeMonthlyIndex, parseMonth, previousMonth } from '../lib/price-index.js'

async function main() {
  const args = process.argv.slice(2)
  const monthArg = args.find((a) => a.startsWith('--month='))?.split('=')[1]
  const month = monthArg ? parseMonth(monthArg) : previousMonth()
  if (!month) {
    console.error(`Lună invalidă: „${monthArg}” (format: YYYY-MM, ex. 2026-09)`)
    process.exit(1)
  }
  const log = (m: string) => console.log(m)
  let exitCode = 0

  if (!args.includes('--timing-only')) {
    const r = await computeMonthlyIndex(month, { retro: args.includes('--retro'), draft: args.includes('--draft'), log })
    console.log(JSON.stringify(r))
    if (r.status === 'skipped-future') {
      console.error(`Luna ${month} nu s-a încheiat încă — ediția se calculează după ultima zi a lunii.`)
      exitCode = 1
    }
  }
  if (!args.includes('--no-timing')) {
    console.log(JSON.stringify(await computeBuyTiming({ log })))
  }
  await pool.end()
  process.exit(exitCode)
}

main().catch(async (err) => {
  console.error(err)
  await pool.end().catch(() => {})
  process.exit(1)
})
