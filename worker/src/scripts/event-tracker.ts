// Rulare manuală a trackerului de evenimente (Black Friday → /black-friday-2026, migrația 036).
//
// Normal rulează singur la finalul fiecărui snapshot de prețuri (runPriceSnapshot, după feed-sync).
// Scriptul e pentru recuperare (ex. workerul a fost oprit pe 1 noiembrie) și pentru teste locale.
//
// Utilizare (local, din worker/):
//   npm run event-tracker:now                          # toate evenimentele, „acum”
//   npm run event-tracker:now -- --event=black-friday-2026
//   npm run event-tracker:now -- --event=test-local --as-of=2026-10-13T12:00:00+03:00 --min-points=2
//     (doar pe un eveniment de TEST din DB-ul local: --as-of simulează „acum”, --min-points
//      coboară pragul de puncte al referinței pentru istoricul local rar)
// Producție (containerul worker, după deploy):
//   docker compose exec -T worker node worker/dist/scripts/event-tracker.js [--event=…]
//
// Ce face: (1) după îngheț, calculează O SINGURĂ DATĂ referința (mediana pe 30 de zile dinaintea
// înghețului) — dacă există deja, nu o atinge; (2) în fereastra evenimentului, rescrie agregatele
// zilei curente. Nu există opțiune de recalculare a referinței: e înghețată prin definiție.

import pool from '../lib/db.js'
import { runEventTracker, MIN_REFERENCE_POINTS } from '../lib/event-tracker.js'

async function main(): Promise<number> {
  const args = process.argv.slice(2)
  const val = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=')
  const unknown = args.filter((a) => !/^--(event|as-of|min-points)=/.test(a))
  if (unknown.length) {
    console.error(`Argumente necunoscute: ${unknown.join(' ')} (permise: --event=slug, --as-of=ISO, --min-points=N)`)
    return 1
  }
  const asOf = val('as-of')
  const now = asOf ? new Date(asOf) : undefined
  if (now && Number.isNaN(now.getTime())) {
    console.error(`--as-of invalid: ${asOf}`)
    return 1
  }
  const minPointsRaw = val('min-points')
  const minPoints = minPointsRaw ? Number(minPointsRaw) : MIN_REFERENCE_POINTS
  if (!Number.isInteger(minPoints) || minPoints < 1) {
    console.error(`--min-points invalid: ${minPointsRaw}`)
    return 1
  }
  if (asOf && !val('event')) {
    console.error('--as-of se folosește doar cu --event=<eveniment de test> (altfel ar scrie agregate false pe evenimentul real)')
    return 1
  }

  const results = await runEventTracker({ now, slug: val('event'), minPoints })
  if (!results.length) console.log('Niciun eveniment găsit (migrația 036 aplicată?).')
  for (const r of results) {
    console.log(
      `${r.slug}: faza ${r.phase}` +
      (r.referenceRows != null ? `, referință calculată acum pentru ${r.referenceRows} oferte` : '') +
      (r.day ? `, ziua ${r.day}: ${r.offers} oferte / ${r.products} produse, ${r.statRows} rânduri de agregate` : ', fără agregate (în afara ferestrei sau înainte de îngheț)'),
    )
  }
  return 0
}

main()
  .then(async (code) => { await pool.end(); process.exit(code) })
  .catch(async (err) => { console.error(err); await pool.end().catch(() => {}); process.exit(1) })
