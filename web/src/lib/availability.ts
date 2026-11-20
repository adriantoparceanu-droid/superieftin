// Cand afisam o oferta / un produs (decizia proprietarului, 2026-09-26).
//
// O oferta e „disponibila” doar daca e in stoc SI a fost confirmata de un feed / o scanare
// in ultimele OFFER_STALE_DAYS zile. Workerul o marcheaza oricum „fara stoc” zilnic
// (worker/src/lib/stale.ts, aceeasi valoare) — verificarea de aici e plasa de siguranta
// pentru cazul in care jobul zilnic nu ruleaza.
export const OFFER_STALE_DAYS = 3

// Fragment SQL pentru alias-ul `o` (offers): in stoc, confirmata recent SI magazinul nu e pus
// pe pauza din Admin → Magazine & surse (pauza ascunde imediat toate ofertele magazinului).
//
// ATENTIE la forma: lista magazinelor pe pauza e calculata O SINGURA DATA (ARRAY(...) = initplan).
// Varianta cu NOT EXISTS corelat a facut planner-ul sa estimeze 1 rand si sa rescaneze tot
// price_history per oferta → homepage-ul a cazut (query-uri de minute) la deploy-ul din 26 sep 2026.
export const OFFER_AVAILABLE_SQL =
  `(o.in_stock = true AND o.last_checked >= now() - INTERVAL '${OFFER_STALE_DAYS} days'
    AND o.retailer_id <> ALL (ARRAY(SELECT id FROM retailers WHERE paused_at IS NOT NULL)))`
