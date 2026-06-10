-- Retaileri monitorizati
CREATE TABLE IF NOT EXISTS retailers (
    id            SERIAL PRIMARY KEY,
    name          TEXT NOT NULL,
    slug          TEXT NOT NULL UNIQUE,
    base_url      TEXT NOT NULL,
    scraper_config JSONB NOT NULL DEFAULT '{}',
    is_active     BOOLEAN NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Produs canonic (independent de retailer)
CREATE TABLE IF NOT EXISTS products (
    id            BIGSERIAL PRIMARY KEY,
    name          TEXT NOT NULL,
    slug          TEXT NOT NULL UNIQUE,
    category      TEXT NOT NULL,
    brand         TEXT,
    image_url     TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_products_category ON products (category);

-- Oferta unui produs la un retailer (pretul CURENT)
CREATE TABLE IF NOT EXISTS offers (
    id            BIGSERIAL PRIMARY KEY,
    product_id    BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    retailer_id   INT NOT NULL REFERENCES retailers(id),
    url           TEXT NOT NULL,
    affiliate_url TEXT,
    current_price NUMERIC(12,2),
    currency      TEXT NOT NULL DEFAULT 'RON',
    in_stock      BOOLEAN NOT NULL DEFAULT true,
    last_checked  TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (product_id, retailer_id)
);
CREATE INDEX IF NOT EXISTS idx_offers_product ON offers (product_id);

-- Istoricul de pret (partitionat pe luni)
CREATE TABLE IF NOT EXISTS price_history (
    offer_id      BIGINT NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
    price         NUMERIC(12,2) NOT NULL,
    in_stock      BOOLEAN NOT NULL DEFAULT true,
    recorded_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (offer_id, recorded_at)
) PARTITION BY RANGE (recorded_at);

-- Utilizatori (pentru alerte)
CREATE TABLE IF NOT EXISTS users (
    id            BIGSERIAL PRIMARY KEY,
    email         TEXT UNIQUE,
    telegram_chat_id TEXT UNIQUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Alerte de pret
CREATE TABLE IF NOT EXISTS alerts (
    id            BIGSERIAL PRIMARY KEY,
    user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    offer_id      BIGINT NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
    target_price  NUMERIC(12,2) NOT NULL,
    is_active     BOOLEAN NOT NULL DEFAULT true,
    triggered_at  TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_alerts_active ON alerts (offer_id) WHERE is_active;

-- Tabel pentru tracking migratii
CREATE TABLE IF NOT EXISTS schema_migrations (
    version       TEXT PRIMARY KEY,
    applied_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
