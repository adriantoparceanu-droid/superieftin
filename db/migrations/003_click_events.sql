-- Tracking linkuri de afiliere
CREATE TABLE IF NOT EXISTS click_events (
    id          BIGSERIAL PRIMARY KEY,
    offer_id    BIGINT NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
    clicked_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_click_events_offer ON click_events (offer_id, clicked_at DESC);

INSERT INTO schema_migrations (version) VALUES ('003') ON CONFLICT DO NOTHING;
