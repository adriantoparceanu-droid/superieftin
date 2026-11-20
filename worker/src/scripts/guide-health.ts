// Rulare manuală a verificării articolelor publicate (job-ul săptămânal `guide-health`).
//
// Utilizare (local, din worker/):
//   npm run guide-health:now                 # afișează problemele, NU trimite nimic
//   npm run guide-health:now -- --telegram   # trimite și rezumatul pe Telegram (doar dacă sunt probleme)
// Producție (containerul worker): docker compose exec -T worker node worker/dist/scripts/guide-health.js [--telegram]
//
// DOAR CITIRE: nu modifică articolele. Regulile: lib/guide-health.ts.
import pool from '../lib/db.js'
import { runGuideHealth } from '../lib/guide-health-job.js'
import { formatTextReport } from '../lib/guide-health.js'

async function main(): Promise<number> {
  const args = process.argv.slice(2)
  const unknown = args.filter((a) => a !== '--telegram')
  if (unknown.length) {
    console.error(`Argumente necunoscute: ${unknown.join(' ')} (permis: --telegram)`)
    return 1
  }
  const telegram = args.includes('--telegram')
  const r = await runGuideHealth({ telegram })
  console.log(formatTextReport(r.results))
  if (r.markerOnlyProducts) {
    console.log(`\nAtenție: ${r.markerOnlyProducts} produs(e) apar doar în marcajele din corp, nu și în guide_products ` +
      '(resalvează articolul din admin sau reimportă-l ca tabela să fie completă).')
  }
  if (telegram) console.log(r.withProblems ? `\nTelegram: ${r.telegramSent ? 'trimis' : 'NU s-a trimis (vezi logul)'}` : '\nTelegram: nimic de trimis.')
  return 0
}

main()
  .then(async (code) => { await pool.end(); process.exit(code) })
  .catch(async (err) => { console.error(err); await pool.end().catch(() => {}); process.exit(1) })
