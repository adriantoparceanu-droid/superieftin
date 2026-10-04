// Creeaza UN link oficial Profitshare (l.profitshare.ro/l/<id>) pentru un URL — o singura data.
//
// De ce: deep link-ul /lps/9/<cod>/ al eMAG foloseste codul de afiliat din API, care se schimba
// de la o zi la alta si nu toate codurile inregistreaza clickuri (incidentul 28.09–04.10.2026).
// Un link oficial /l/<id> e fix si accepta `?redirect=<url produs>` (testat 04.10, se inregistreaza).
// Linkul creat se pune in .env (ex. PROFITSHARE_EMAG_LINK) — vezi lib/affiliate/profitshare-deeplink.ts.
//
// Utilizare (din worker/):
//   npm run profitshare:create-link -- <url> "<nume>"             # PLAN: arata ce ar crea, nu scrie
//   npm run profitshare:create-link -- <url> "<nume>" --confirm   # creeaza linkul in contul Profitshare
// E o scriere in contul Profitshare (apare in panou) — ruleaza doar cu acordul proprietarului.

import { createAffiliateLink } from '../lib/profitshare.js'

async function main(): Promise<number> {
  const argv = process.argv.slice(2)
  const confirm = argv.includes('--confirm')
  const [url, name] = argv.filter((a) => a !== '--confirm')
  if (!url || !name || !/^https?:\/\//.test(url)) {
    console.error('Utilizare: profitshare:create-link -- <url> "<nume>" [--confirm]')
    return 1
  }
  if (!confirm) {
    console.log(`PLAN: as crea in Profitshare linkul „${name}” → ${url}. Adauga --confirm pentru scriere.`)
    return 0
  }
  const link = await createAffiliateLink(name, url)
  console.log(`Link creat: ${link.ps_url}`)
  if (link.tracking_template) console.log(`tracking_template: ${link.tracking_template}`)
  return 0
}

main().then((code) => process.exit(code), (err) => {
  console.error(`EROARE: ${(err as Error).message}`)
  process.exit(1)
})
