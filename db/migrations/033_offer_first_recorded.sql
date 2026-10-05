-- 033: data primei înregistrări din istoric, per ofertă, în offer_price_stats (5 oct. 2026).
--
-- De ce: decizia SEO din 5 oct. 2026 (docs/seo/2026-10-05-audit-scadere-gsc.md, varianta B) —
-- o pagină de produs /p/ e indexabilă doar dacă urmărim produsul de cel puțin 30 de zile.
-- „De când îl urmărim” = MIN(price_history.recorded_at) pe toate ofertele produsului, exact
-- data afișată pe pagină („De la 3 octombrie 2026, de când urmărim produsul”).
--
-- De ce NU products.created_at: ofertele eMAG nevăzute 30 de zile se șterg (pruning, cu
-- istoricul lor în CASCADE), apoi revin ca oferte noi → produsul are created_at vechi, dar
-- istoric de câteva zile. Pe datele locale: ~19% din produsele „vechi” disponibile.
--
-- De ce precalculat: regula din CLAUDE.md — site-ul NU agregă price_history la cerere.
-- Workerul îl scrie în același upsert cu mediana (worker/src/lib/price-stats.ts); sitemap-ul
-- face doar MIN(first_recorded_at) pe ofertele produsului (JOIN pe offer_price_stats).
-- Când o ofertă se șterge, rândul ei de aici dispare (CASCADE) → minimul rămâne corect.
--
-- Idempotentă. Completarea de mai jos e ieftină: pentru fiecare ofertă, o singură citire pe
-- cheia primară (offer_id, recorded_at) a fiecărei partiții (~75 ms pe datele locale).

ALTER TABLE offer_price_stats
    ADD COLUMN IF NOT EXISTS first_recorded_at TIMESTAMPTZ;  -- prima înregistrare din istoric (orice vechime); NULL = fără istoric

UPDATE offer_price_stats s
SET first_recorded_at = (
    SELECT ph.recorded_at FROM price_history ph
    WHERE ph.offer_id = s.offer_id
    ORDER BY ph.recorded_at
    LIMIT 1
)
WHERE s.first_recorded_at IS NULL;
