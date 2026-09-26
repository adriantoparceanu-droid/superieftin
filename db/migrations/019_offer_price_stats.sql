-- Statistici de preț precalculate per ofertă (mediana 30 de zile + ultimul preț din istoric).
--
-- De ce: fiecare pagină de listare / produs necache-uită recalcula PERCENTILE_CONT peste TOT
-- price_history din ultimele 30 de zile (~3 s CPU). La un val de roboți după restart, zeci de
-- astfel de query-uri în paralel saturau cele 4 nuclee (pagini de minute, 26 sep 2026).
-- Acum workerul recalculează tabela după fiecare scriere în istoric (feed-sync + snapshot,
-- price-check), iar site-ul doar face JOIN pe ea (milisecunde).
--
-- Mediana se schimbă lent (30 de zile), deci o actualizare la câteva ore e suficientă;
-- prețul curent vine în continuare live din offers.current_price.

CREATE TABLE IF NOT EXISTS offer_price_stats (
    offer_id      BIGINT PRIMARY KEY REFERENCES offers(id) ON DELETE CASCADE,
    median_30d    NUMERIC,            -- precizie completă (fără rotunjire: pragul de 5% e sensibil); NULL = fără istoric în 30 de zile
    points_30d    INTEGER NOT NULL DEFAULT 0,
    latest_price  NUMERIC,            -- ultimul preț înregistrat în istoric (orice vechime)
    computed_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
