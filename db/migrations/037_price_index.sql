-- 037: Indicele lunar al prețurilor + „Când să cumperi” (observatorul reducerilor reale, 21 oct. 2026).
--
-- De ce: repoziționarea din docs/plans/2026-10-21-observator-repozitionare-design.md (§3).
-- Site-ul NU agregă price_history la cerere (CLAUDE.md, „Mediana precalculată”) → workerul
-- (worker/src/lib/price-index.ts, jobul BullMQ `price-index`) calculează cifrele și le scrie aici,
-- iar paginile /indice și /cand-sa-cumperi doar citesc.
--
-- Fără chei străine spre categories/products, intenționat: o ediție publicată e IMUTABILĂ (o
-- arhivă), deci nu trebuie să dispară sau să se schimbe când o categorie e ștearsă sau un produs
-- dispare din feed. De aceea slug-ul și numele sunt copiate (denormalizate) în rând.
--
-- Idempotentă (IF NOT EXISTS); nu scrie date — prima ediție o calculează workerul.

-- O ediție = o lună. Cifrele de ansamblu (toate categoriile la un loc) + starea ediției.
CREATE TABLE IF NOT EXISTS price_index_editions (
    month              DATE PRIMARY KEY,          -- prima zi a lunii măsurate (ex. 2026-09-01)
    basket_size        INTEGER NOT NULL,          -- produse în coșul stabil, toate categoriile incluse
    median_change_pct  NUMERIC,                   -- mediana variațiilor pe produs față de luna anterioară (negativ = mai ieftin)
    categories         INTEGER NOT NULL,          -- câte categorii au trecut pragul coșului minim
    retailers          INTEGER NOT NULL,          -- magazine cu oferte în coș în luna măsurată
    real_discounts     INTEGER NOT NULL,          -- produse cu cel puțin o zi de reducere reală în lună
    retroactive        BOOLEAN NOT NULL DEFAULT false, -- calculată după lună, din istoric (arhiva iul.–sep. 2026)
    published          BOOLEAN NOT NULL DEFAULT true,  -- publicată = nu se mai rescrie; false = ciornă (--draft)
    correction_note    TEXT,                      -- corecțiile se fac printr-o notă vizibilă, nu prin rescriere
    computed_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Rândurile ediției, pe categorie (frunze și părinți; un părinte cuprinde subcategoriile lui).
CREATE TABLE IF NOT EXISTS price_index_monthly (
    month                 DATE NOT NULL,
    category_id           INTEGER NOT NULL,
    category_slug         TEXT NOT NULL,
    category_name         TEXT NOT NULL,
    parent_slug           TEXT,                   -- pentru gruparea pe pagină (NULL = categorie rădăcină)
    basket_size           INTEGER NOT NULL,       -- produse cu ofertă în stoc în AMBELE luni
    median_change_pct     NUMERIC,                -- mediana variațiilor pe produs (procente, negativ = scădere)
    share_down_pct        NUMERIC,                -- % din coș cu preț lunar mai mic decât luna anterioară
    real_discounts        INTEGER NOT NULL,       -- produse cu cel puțin o zi de reducere reală în lună
    retailers             INTEGER NOT NULL,       -- magazine cu oferte în coș în luna măsurată
    cheapest_retailer_id  INTEGER,                -- magazinul cu cel mai mic preț lunar la cele mai multe produse comparabile
    cheapest_retailer_name TEXT,
    cheapest_wins         INTEGER,                -- la câte produse a avut cel mai mic preț
    compared_products     INTEGER,                -- produse din coș cu cel puțin 2 magazine în lună
    top_drops             JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{product_id, slug, name, pct}] cele mai mari scăderi din coș
    retroactive           BOOLEAN NOT NULL DEFAULT false,
    computed_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    published             BOOLEAN NOT NULL DEFAULT true,
    PRIMARY KEY (month, category_id)
);

-- „Când să cumperi”: o serie săptămânală pe categorie, recalculată pe tot istoricul (nu e arhivă).
CREATE TABLE IF NOT EXISTS category_buy_timing (
    category_id          INTEGER NOT NULL,
    week                 DATE NOT NULL,           -- luni, începutul săptămânii (ora României)
    category_slug        TEXT NOT NULL,
    category_name        TEXT NOT NULL,
    parent_slug          TEXT,
    tracked_since        DATE NOT NULL,           -- prima zi cu preț în istoric pentru categorie („de când urmărim categoria”)
    products             INTEGER NOT NULL,        -- produse cu preț în stoc în săptămână
    basket_median        NUMERIC,                 -- nivelul median al prețurilor față de prețul obișnuit al fiecărui produs (100 = obișnuit)
    real_discount_share  NUMERIC,                 -- % din zilele-produs cu reducere reală (preț < mediana 30 de zile × 0,95)
    product_days         INTEGER NOT NULL DEFAULT 0, -- zile-produs cu preț în stoc (numitorul procentului de mai sus)
    real_days            INTEGER NOT NULL DEFAULT 0, -- dintre ele, zile cu reducere reală (numărătorul)
    avg_real_streak_days NUMERIC,                 -- durata medie (zile) a seriilor de reduceri reale care încep în săptămână
    real_streaks         INTEGER NOT NULL DEFAULT 0, -- câte serii încep în săptămână (ponderea mediei de mai sus)
    computed_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (category_id, week)
);

CREATE INDEX IF NOT EXISTS idx_category_buy_timing_slug ON category_buy_timing (category_slug, week);
CREATE INDEX IF NOT EXISTS idx_price_index_monthly_slug ON price_index_monthly (category_slug, month);
