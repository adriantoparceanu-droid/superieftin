// Cand afisam o oferta / un produs (decizia proprietarului, 2026-09-26).
//
// O oferta e „disponibila” doar daca e in stoc SI a fost confirmata de un feed / o scanare
// in ultimele OFFER_STALE_DAYS zile. Workerul o marcheaza oricum „fara stoc” zilnic
// (worker/src/lib/stale.ts, aceeasi valoare) — verificarea de aici e plasa de siguranta
// pentru cazul in care jobul zilnic nu ruleaza.
export const OFFER_STALE_DAYS = 3

// Produs fara nicio oferta disponibila: pagina ramane „indisponibil” (fara butoane spre
// magazine, neindexata, scoasa din sitemap), iar dupa PRODUCT_GONE_DAYS fara nicio oferta
// confirmata raspunde 410 (vezi src/proxy.ts). Revine automat daca produsul reapare.
export const PRODUCT_GONE_DAYS = 30

// 410-ul porneste abia de la aceasta data (varianta C, decizia proprietarului 2026-09-26):
// la lansarea regulii, ~25.000 de produse (mai ales CITGrup, feed disparut din iunie) ar fi
// dat 410 imediat. Pana la data asta raman doar „indisponibil” (noindex), ca paginile sa nu
// se piarda din Google daca feed-urile sunt reparate intre timp. Dupa data: regula normala.
export const PRODUCT_GONE_FROM = new Date('2026-10-27T00:00:00+02:00')

// Fragment SQL pentru alias-ul `o` (offers)
export const OFFER_AVAILABLE_SQL =
  `(o.in_stock = true AND o.last_checked >= now() - INTERVAL '${OFFER_STALE_DAYS} days')`
