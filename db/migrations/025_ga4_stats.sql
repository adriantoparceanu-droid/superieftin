-- 025: Statistici Google Analytics 4 pentru admin (/admin/statistici)
--
-- De ce: adminul arata traficul general fara sa intri in GA4. Workerul (job `ga4-sync`, zilnic)
-- trage rapoartele din GA4 Data API si le salveaza aici; pagina citeste DOAR din aceste tabele
-- (rapid, merge si cand Google e jos). Design: docs/plans/2026-09-28-admin-statistici-ga4-design.md
--
-- Doar AGREGATE (numar de sesiuni pe zi / pagina / sursa) — nicio data despre un vizitator anume.
-- GA4 numara doar vizitatorii care au acceptat cookie-urile de analiza; clickurile complete
-- raman in click_events.
--
-- Idempotenta: poate rula de mai multe ori fara efect.

-- Totalurile pe zi (ziua in fusul orar al proprietatii GA4)
CREATE TABLE IF NOT EXISTS ga4_daily (
    day                     DATE PRIMARY KEY,
    users                   INTEGER NOT NULL DEFAULT 0,   -- totalUsers
    new_users               INTEGER NOT NULL DEFAULT 0,   -- newUsers
    sessions                INTEGER NOT NULL DEFAULT 0,
    engaged_sessions        INTEGER NOT NULL DEFAULT 0,   -- sesiuni > 10 s sau cu 2+ pagini / eveniment cheie
    page_views              INTEGER NOT NULL DEFAULT 0,   -- screenPageViews
    avg_engagement_seconds  NUMERIC(10,2) NOT NULL DEFAULT 0,  -- userEngagementDuration / totalUsers
    affiliate_clicks        INTEGER NOT NULL DEFAULT 0,   -- evenimente click_affiliate_link
    synced_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Defalcari pe zi: kind = source | landing | page | device | retailer | product | category.
-- product = product_id intern (din evenimentul click_affiliate_link); category = slug-ul categoriei.
-- Workerul pastreaza doar top 50 pe tip si pe zi (restul nu conteaza in admin, iar tabelul ramane mic).
CREATE TABLE IF NOT EXISTS ga4_daily_breakdown (
    day               DATE NOT NULL,
    kind              TEXT NOT NULL,
    key               TEXT NOT NULL,
    sessions          INTEGER NOT NULL DEFAULT 0,
    users             INTEGER NOT NULL DEFAULT 0,
    page_views        INTEGER NOT NULL DEFAULT 0,
    affiliate_clicks  INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (day, kind, key)
);
CREATE INDEX IF NOT EXISTS idx_ga4_breakdown_kind_day ON ga4_daily_breakdown (kind, day);

-- Starea sincronizarii (un singur rand, id = 1): afisata in admin si folosita pentru alerta
-- Telegram dupa 3 esecuri la rand.
CREATE TABLE IF NOT EXISTS ga4_sync_state (
    id                    SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    last_success_at       TIMESTAMPTZ,
    last_error            TEXT,
    last_error_at         TIMESTAMPTZ,
    consecutive_failures  INTEGER NOT NULL DEFAULT 0,
    warnings              TEXT[] NOT NULL DEFAULT '{}'   -- ex. dimensiune personalizata neinregistrata in GA4
);
