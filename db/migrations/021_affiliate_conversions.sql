-- Faza 2 (tracking): comenzile venite din rețelele de afiliere, legate de clickul care le-a
-- adus (click_id trimis ca subID pe /go → întors de Profitshare în câmpul `hash`), și starea
-- trimiterii lor la Google Ads ca conversie offline „Comision Profitshare”.
-- Schema aprobată de proprietar pe 2026-09-26. Fără date personale (Profitshare nu trimite
-- date despre client).

CREATE TABLE IF NOT EXISTS affiliate_conversions (
    id                 BIGSERIAL PRIMARY KEY,
    network            TEXT NOT NULL,                  -- 'profitshare' (2Performant mai târziu)
    external_id        TEXT NOT NULL,                  -- order_id din rețea (orderId la Google → idempotent)
    click_id           TEXT,                           -- hash-ul din comision = ad_clicks.click_id
    ad_click_id        BIGINT REFERENCES ad_clicks(id) ON DELETE SET NULL,
    retailer_id        INTEGER REFERENCES retailers(id) ON DELETE SET NULL,
    status             TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
    commission_amount  NUMERIC(12,2) NOT NULL DEFAULT 0, -- RON
    order_time         TIMESTAMPTZ NOT NULL,
    raw_payload        JSONB,
    uploaded_at        TIMESTAMPTZ,                    -- trimisă efectiv la Google (NU la validate_only)
    uploaded_value     NUMERIC(12,2),
    retracted_at       TIMESTAMPTZ,                    -- retrasă la Google (comision anulat)
    last_error         TEXT,                           -- ultimul răspuns de eroare Google
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (network, external_id)
);

CREATE INDEX IF NOT EXISTS idx_affconv_click ON affiliate_conversions (click_id);
CREATE INDEX IF NOT EXISTS idx_affconv_order_time ON affiliate_conversions (order_time DESC);
