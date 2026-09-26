-- Momentul REAL al clickului pe reclama Google (aterizarea cu gclid/gbraid/wbraid), nu al
-- clickului /go spre magazin (created_at).
--
-- De ce: cookie-ul se_gclid traieste pana la 90 de zile, iar /go poate veni oricand in acest
-- interval. Daca am sterge gclid-ul la 90 de zile de la created_at, ID-ul ar putea sta la noi
-- pana la ~180 de zile de la clickul pe reclama — iar /confidentialitate promite „cel mult 90
-- de zile”. Google socoteste si el fereastra de conversie de la clickul pe reclama.
-- ad_click_at vine din cookie (campul ts, scris la aterizare), limitat la now() de /go.
-- NULL = click fara ID Google sau rand vechi → se foloseste created_at (COALESCE).

ALTER TABLE ad_clicks ADD COLUMN IF NOT EXISTS ad_click_at TIMESTAMPTZ;

-- Stergerea zilnica (tracking:sync) cauta doar randurile care inca au un ID Google
CREATE INDEX IF NOT EXISTS idx_ad_clicks_ad_ids_age
    ON ad_clicks ((COALESCE(ad_click_at, created_at)))
    WHERE gclid IS NOT NULL OR gbraid IS NOT NULL OR wbraid IS NOT NULL;

-- Retragerea acordului (POST /api/consent/withdraw) cauta dupa ID-ul Google
CREATE INDEX IF NOT EXISTS idx_ad_clicks_gclid  ON ad_clicks (gclid)  WHERE gclid  IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ad_clicks_gbraid ON ad_clicks (gbraid) WHERE gbraid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ad_clicks_wbraid ON ad_clicks (wbraid) WHERE wbraid IS NOT NULL;
