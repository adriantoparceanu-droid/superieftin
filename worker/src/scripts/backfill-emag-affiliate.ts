// Completeaza linkul afiliat Profitshare pe ofertele eMAG care au affiliate_url NULL.
//
// De ce: ofertele create de scraper-ul eMAG cand API-ul Profitshare a raportat eMAG „inactiv”
// (statusul variaza intre serverele Profitshare — vezi lib/affiliate/profitshare-deeplink.ts) au
// ramas fara link → /go trimitea direct pe emag.ro: fara comision si fara click_id (hash).
//
// Utilizare (local, din worker/):
//   npm run emag:backfill-affiliate               # DRY-RUN: cate ar actualiza + 2 exemple, nu scrie
//   npm run emag:backfill-affiliate -- --confirm  # scrie in DB
// Productie (containerul worker, dupa deploy-ul worker-ului care contine scriptul):
//   docker compose exec -T worker node worker/dist/scripts/backfill-emag-affiliate.js
//   docker compose exec -T worker node worker/dist/scripts/backfill-emag-affiliate.js --confirm
//
// Reguli:
// - Implicit dry-run. Scrierea cere --confirm.
// - Codurile vin din API-ul Profitshare (doar citire, `affiliate-advertisers`); fara configurare
//   valida (eMAG neaprobat/inactiv, API cazut) → iese cu cod 1, nu scrie nimic.
// - Idempotent: atinge DOAR ofertele eMAG cu affiliate_url NULL (re-verificat in UPDATE);
//   a doua rulare gaseste 0. Linkurile existente nu se modifica.
// - EXCEPTIE: cu linkul oficial fix in .env (PROFITSHARE_EMAG_LINK, 2026-10-04) rescrie TOATE
//   ofertele eMAG al caror link nu e deja linkul oficial (ex. vechile /lps/9/Vk0/ cu cod nenumarat).
//   Idempotent si asa: a doua rulare gaseste 0.
// - DATABASE_URL vine din mediu (local: --env-file=../.env; prod: env-ul containerului).

import pool from '../lib/db.js'
import { findLinkConfig, buildDeepLink, officialLinkBase, buildOfficialLink } from '../lib/affiliate/profitshare-deeplink.js'

const RETAILER_SLUG = 'emag'
const DOMAIN = 'emag.ro'

async function main(): Promise<number> {
  const argv = process.argv.slice(2)
  const unknown = argv.filter((a) => a !== '--confirm')
  if (unknown.length) {
    console.error(`Argumente necunoscute: ${unknown.join(' ')} (singurul permis: --confirm)`)
    return 1
  }
  const confirm = argv.includes('--confirm')
  console.log(confirm ? '==> Mod SCRIERE (--confirm)' : '==> Mod DRY-RUN (nu scrie nimic; adauga --confirm pentru scriere)')

  const officialBase = officialLinkBase(DOMAIN)
  // Prefixul linkului oficial: tot ce nu incepe asa se rescrie. Fara link oficial → doar NULL-urile.
  const officialPrefix = officialBase ? `${officialBase}?redirect=` : null
  if (officialBase) console.log(`Link oficial Profitshare: ${officialBase} (rescriu tot ce nu il foloseste)`)
  const { rows: offers } = await pool.query<{ id: string; url: string }>(`
    SELECT o.id::text, o.url
    FROM offers o JOIN retailers r ON r.id = o.retailer_id
    WHERE r.slug = $1
      AND (o.affiliate_url IS NULL OR ($2::text IS NOT NULL AND left(o.affiliate_url, length($2)) <> $2))
    ORDER BY o.id
  `, [RETAILER_SLUG, officialPrefix])
  const { rows: [totals] } = await pool.query<{ total: number; affiliated: number }>(`
    SELECT count(*)::int AS total, count(o.affiliate_url)::int AS affiliated
    FROM offers o JOIN retailers r ON r.id = o.retailer_id WHERE r.slug = $1
  `, [RETAILER_SLUG])
  console.log(`Oferte eMAG: ${totals.total} (cu link afiliat: ${totals.affiliated}, de completat/rescris: ${offers.length})`)
  if (!offers.length) {
    console.log('Nimic de completat.')
    return 0
  }

  // Cu link oficial nu mai avem nevoie de codurile din API.
  const { config, attempts, reason } = officialBase
    ? { config: null, attempts: 0, reason: undefined }
    : await findLinkConfig(DOMAIN)
  if (!officialBase && !config) {
    console.error(`EROARE: nu pot construi linkul Profitshare pentru ${DOMAIN} dupa ${attempts} apeluri API: ${reason}`)
    console.error('Nu s-a scris nimic.')
    return 1
  }
  // Codurile apar oricum in fiecare link public — nu sunt secrete (cheia API nu se afiseaza).
  if (config) {
    console.log(`Profitshare: ${config.advertiserName} (id ${config.advertiserId}), `
      + `lps/${config.advertiserHash}/${config.affiliateHash}/ (gasit la apelul ${attempts})`)
  }

  const ids: string[] = []
  const links: string[] = []
  const invalid: string[] = []
  for (const o of offers) {
    try {
      links.push(officialBase ? buildOfficialLink(o.url, officialBase, DOMAIN) : buildDeepLink(o.url, config!, DOMAIN))
      ids.push(o.id)
    } catch (err) {
      invalid.push(`${o.id}: ${(err as Error).message}`)
    }
  }

  console.log(`De actualizat: ${ids.length}${invalid.length ? ` (sarite, URL invalid: ${invalid.length})` : ''}`)
  for (const line of invalid.slice(0, 5)) console.log(`  sarit ${line}`)
  for (let i = 0; i < Math.min(2, ids.length); i++) {
    console.log(`  exemplu oferta ${ids[i]}:\n    ${offers.find((o) => o.id === ids[i])!.url}\n    → ${links[i]}`)
  }

  if (!confirm) {
    console.log('DRY-RUN: nimic scris. Ruleaza cu --confirm pentru scriere.')
    return 0
  }

  // O singura instructiune (atomica). Conditia re-verificata: daca intre timp o oferta a primit
  // link (ex. un scrape), nu o suprascriem (fara link oficial: doar NULL-urile).
  const res = await pool.query(`
    UPDATE offers o SET affiliate_url = v.link, affiliate_network = 'profitshare'
    FROM unnest($1::bigint[], $2::text[]) AS v(id, link)
    WHERE o.id = v.id
      AND (o.affiliate_url IS NULL OR ($3::text IS NOT NULL AND left(o.affiliate_url, length($3)) <> $3))
  `, [ids, links, officialPrefix])
  console.log(`Actualizate: ${res.rowCount}`)
  return 0
}

main()
  .then(async (code) => { await pool.end(); process.exit(code) })
  .catch(async (err) => {
    console.error('EROARE:', (err as Error).message)
    await pool.end()
    process.exit(1)
  })
