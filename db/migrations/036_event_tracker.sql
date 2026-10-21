-- 036: trackerul de evenimente de reduceri (Black Friday 2026 → /black-friday-2026).
--
-- De ce: în perioada Black Friday mediana MOBILĂ pe 30 de zile (offer_price_stats) „prinde”
-- prețurile de campanie în câteva zile și nu mai poate spune dacă o reducere e reală. Trackerul
-- compară prețul de azi cu o REFERINȚĂ ÎNGHEȚATĂ: mediana pe cele 30 de zile dinaintea datei de
-- îngheț (freeze_at), calculată O SINGURĂ DATĂ după îngheț și apoi niciodată rescrisă.
-- Design: docs/plans/2026-10-21-observator-repozitionare-design.md (§2).
--
-- Totul e precalculat de worker (worker/src/lib/event-tracker.ts, după runPriceSnapshot); site-ul
-- doar citește tabelele (regula din CLAUDE.md: nu agregăm price_history la cerere în web).
--
-- Arhiva trebuie să supraviețuiască ofertelor dispărute (oferte șterse de pruning-ul eMAG,
-- produse 410 după 30 de zile): de aceea tabelele de aici NU au FK spre offers/products/categories,
-- iar numele/slug-urile categoriilor sunt copiate (denormalizate) în agregatele zilnice.
--
-- Idempotentă (IF NOT EXISTS + seed cu ON CONFLICT DO NOTHING).

-- Evenimentele urmărite. Un rând pe an/eveniment (black-friday-2026, black-friday-2027…).
CREATE TABLE IF NOT EXISTS price_events (
    slug                  TEXT PRIMARY KEY,           -- = URL-ul paginii (/black-friday-2026)
    name                  TEXT NOT NULL,
    freeze_at             TIMESTAMPTZ NOT NULL,       -- referința = mediana pe [freeze_at − 30 zile, freeze_at)
    starts_at             TIMESTAMPTZ NOT NULL,       -- de când scriem agregate zilnice
    ends_at               TIMESTAMPTZ NOT NULL,       -- EXCLUSIV: ultima zi măsurată = ziua dinaintea lui ends_at
    reference_computed_at TIMESTAMPTZ,                -- NULL = referința nu e calculată încă; setat o singură dată
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (ends_at > starts_at)
);

-- Referința înghețată, per ofertă. Scrisă o singură dată (ON CONFLICT DO NOTHING în worker).
-- offer_id fără FK: dacă oferta e ștearsă, referința rămâne în arhivă (nu se mai folosește la
-- agregate, pentru că agregatele pleacă de la ofertele existente și disponibile).
CREATE TABLE IF NOT EXISTS event_reference_prices (
    event_slug        TEXT NOT NULL REFERENCES price_events(slug) ON DELETE CASCADE,
    offer_id          BIGINT NOT NULL,
    product_id        BIGINT NOT NULL,                -- denormalizat (arhivă)
    category_id       INT,                            -- categoria produsului la momentul înghețului
    retailer_id       INT NOT NULL,
    reference_median  NUMERIC(12,2) NOT NULL,         -- mediana prețurilor din fereastra de 30 de zile
    reference_points  INT NOT NULL,                   -- câte înregistrări au intrat în mediană
    computed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (event_slug, offer_id)
);

-- Starea de AZI a fiecărei oferte urmărite (rescrisă la fiecare rulare, cât ține fereastra).
-- Folosită de /p/ (rândul „În cele 14 zile dinaintea reducerii…”) și de topul reducerilor reale
-- de pe pagina evenimentului — o citire pe cheie, fără istoricul de prețuri.
CREATE TABLE IF NOT EXISTS event_offer_status (
    event_slug   TEXT NOT NULL REFERENCES price_events(slug) ON DELETE CASCADE,
    offer_id     BIGINT NOT NULL,
    product_id   BIGINT NOT NULL,
    day          DATE NOT NULL,                       -- ziua (ora României) a calculului
    price        NUMERIC(12,2) NOT NULL,              -- prețul folosit la clasificare
    max_14d      NUMERIC(12,2) NOT NULL,              -- maximul din ultimele 14 zile (inclusiv azi)
    reference_median NUMERIC(12,2) NOT NULL,
    reduced      BOOLEAN NOT NULL,                    -- preț ≥ 5% sub max_14d
    is_real      BOOLEAN NOT NULL,                    -- preț ≤ referință × 0,95
    inflated     BOOLEAN NOT NULL,                    -- redusă, nereală, max_14d ≥ referință × 1,10
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (event_slug, offer_id)
);
CREATE INDEX IF NOT EXISTS idx_event_offer_status_real
    ON event_offer_status (event_slug, day) WHERE is_real;

-- Agregatele zilnice (un rând pe eveniment × zi × categorie), upsert pe ziua curentă.
-- category_id = 0 → rândul „Toate categoriile” (level = 'total'); 'root' = categoriile-părinte
-- (verticalele), 'sub' = subcategoriile. Unitatea = PRODUSUL (oferta lui cea mai ieftină dintre
-- cele urmărite), ca un produs vândut de 3 magazine să nu se numere de 3 ori.
CREATE TABLE IF NOT EXISTS event_daily_stats (
    event_slug    TEXT NOT NULL REFERENCES price_events(slug) ON DELETE CASCADE,
    day           DATE NOT NULL,
    category_id   INT NOT NULL,
    level         TEXT NOT NULL CHECK (level IN ('total', 'root', 'sub')),
    parent_id     INT,                                -- doar pentru 'sub'
    category_slug TEXT NOT NULL,                      -- denormalizat: arhiva rămâne lizibilă după redenumiri
    category_name TEXT NOT NULL,
    tracked       INT NOT NULL,                       -- produse disponibile cu referință
    reduse        INT NOT NULL,                       -- produse reduse (≥ 5% sub maximul din 14 zile)
    reale         INT NOT NULL,                       -- produse cu preț ≤ referință × 0,95 (reduse sau nu)
    reduse_reale  INT NOT NULL,                       -- reduse ȘI reale (numărătorul frazei-fapt)
    umflate       INT NOT NULL,                       -- reduse, nereale, după o urcare ≥ 10% peste referință
    real_discount_median_pct NUMERIC(5,1),            -- mediana reducerii față de referință, la cele reale
    stores        INT NOT NULL,                       -- magazine distincte care intră în calcul
    computed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (event_slug, day, category_id)
);

-- Black Friday 2026: referința = mediana pe 2 oct. – 31 oct. 2026 (ora României);
-- fereastra de măsurare 1 nov. – 2 dec. 2026 inclusiv (ends_at exclusiv = 3 dec. 00:00).
-- Nu afirmăm nicăieri data exactă a Black Friday-ului vreunui magazin: fereastra e a NOASTRĂ.
INSERT INTO price_events (slug, name, freeze_at, starts_at, ends_at)
VALUES (
    'black-friday-2026',
    'Black Friday 2026',
    '2026-11-01 00:00:00'::timestamp AT TIME ZONE 'Europe/Bucharest',
    '2026-11-01 00:00:00'::timestamp AT TIME ZONE 'Europe/Bucharest',
    '2026-12-03 00:00:00'::timestamp AT TIME ZONE 'Europe/Bucharest'
)
ON CONFLICT (slug) DO NOTHING;
