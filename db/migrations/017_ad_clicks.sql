-- Clickuri spre magazine cu identificator propriu (click_id), trimis ca subID in linkul de
-- afiliere (Profitshare: &hash=, 2Performant: &st=). Comisionul intors de retea poarta
-- acelasi click_id → putem lega o comanda de clickul (si, din Faza 2, de reclama) care a adus-o.
--
-- De ce tabela separata de click_events: click_events se sterge in cascada cu oferta, iar
-- ofertele eMAG dispar dupa ~30 de zile, pe cand comisioanele se aproba dupa ~48–65 de zile.
-- Aici oferta e optionala (ON DELETE SET NULL) si pastram o copie a datelor necesare
-- (produs, retailer, retea) ca potrivirea sa mearga si dupa stergerea ofertei.
--
-- Coloanele gclid/gbraid/wbraid/utm_* se completeaza din Faza 2, DOAR cu consimtamant
-- (ad_storage + ad_user_data). Pana atunci raman NULL.

CREATE TABLE IF NOT EXISTS ad_clicks (
    id              BIGSERIAL PRIMARY KEY,
    click_id        TEXT NOT NULL UNIQUE,           -- scurt, [a-z0-9], fara date personale
    offer_id        BIGINT REFERENCES offers(id) ON DELETE SET NULL,
    product_id      BIGINT,                         -- copie, fara FK (produsul poate disparea)
    retailer_id     INTEGER,
    network         TEXT,                           -- profitshare | 2performant | NULL (neafiliat)
    gclid           TEXT,
    gbraid          TEXT,
    wbraid          TEXT,
    has_ad_consent  BOOLEAN NOT NULL DEFAULT false,
    landing_path    TEXT,
    utm_source      TEXT,
    utm_medium      TEXT,
    utm_campaign    TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ad_clicks_created ON ad_clicks (created_at DESC);
