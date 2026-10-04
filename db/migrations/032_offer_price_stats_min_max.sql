-- 032: prețul minim și maxim pe 30 de zile în offer_price_stats (redesign, 5 oct. 2026).
--
-- De ce: pagina de produs primește un „termometru” (bară min – mediană – max pe ultimele
-- 30 de zile, cu prețul de azi marcat), iar listele un mini-termometru pe fiecare rând.
-- Regula din CLAUDE.md: site-ul NU agregă price_history la cerere (~3 s CPU/pagină la valuri
-- de roboți) — deci minimul și maximul se precalculează de worker, în același upsert cu
-- mediana (worker/src/lib/price-stats.ts), pe aceeași fereastră de 30 de zile.
--
-- Idempotentă (IF NOT EXISTS). Până la prima recalculare după deploy coloanele sunt NULL →
-- site-ul nu afișează termometrul (fallback curat), nu inventează valori.

ALTER TABLE offer_price_stats
    ADD COLUMN IF NOT EXISTS min_30d NUMERIC,   -- cel mai mic preț din istoric în ultimele 30 de zile; NULL = fără istoric
    ADD COLUMN IF NOT EXISTS max_30d NUMERIC;   -- cel mai mare preț din istoric în ultimele 30 de zile; NULL = fără istoric
