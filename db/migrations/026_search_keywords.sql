-- 026: Cuvinte cheie in /admin/statistici — organic (Search Console) + reclame (Google Ads)
--
-- De ce: GA4 nu da cautarile prin API (organic = „(not provided)”; legatura GA4 ↔ Search Console
-- merge doar in interfata GA4). Jobul `ga4-sync` le citeste direct din Search Console
-- (acelasi cont de serviciu, doar citire) si din Google Ads (search_term_view, doar citire).
-- Doar agregate pe cautare — Search Console si Google Ads nu dau date despre persoane.
--
-- Idempotenta: poate rula de mai multe ori fara efect.

-- Search Console: zi × cautare × pagina. Doar top 500 pe zi (dupa clickuri, apoi afisari).
-- Cautarile foarte rare sunt ascunse de Google (anonimizate), deci totalurile de aici sunt
-- mai mici decat cele din interfata Search Console.
CREATE TABLE IF NOT EXISTS gsc_daily (
    day          DATE NOT NULL,
    query        TEXT NOT NULL,
    page         TEXT NOT NULL,
    clicks       INTEGER NOT NULL DEFAULT 0,
    impressions  INTEGER NOT NULL DEFAULT 0,
    position     NUMERIC(6,2) NOT NULL DEFAULT 0,   -- pozitia medie in Google (1 = primul rezultat)
    PRIMARY KEY (day, query, page)
);
CREATE INDEX IF NOT EXISTS idx_gsc_daily_day ON gsc_daily (day);

-- Google Ads: zi × campanie × grup × termenul cautat (toate randurile — volumul e mic)
CREATE TABLE IF NOT EXISTS ads_search_terms (
    day          DATE NOT NULL,
    campaign     TEXT NOT NULL,
    ad_group     TEXT NOT NULL,
    search_term  TEXT NOT NULL,
    status       TEXT NOT NULL DEFAULT 'NONE',  -- ADDED / EXCLUDED / ADDED_EXCLUDED / NONE
    impressions  INTEGER NOT NULL DEFAULT 0,
    clicks       INTEGER NOT NULL DEFAULT 0,
    cost_micros  BIGINT NOT NULL DEFAULT 0,     -- cost in milionimi de leu (1 leu = 1.000.000)
    conversions  NUMERIC(10,2) NOT NULL DEFAULT 0,
    PRIMARY KEY (day, campaign, ad_group, search_term)
);
CREATE INDEX IF NOT EXISTS idx_ads_search_terms_day ON ads_search_terms (day);
