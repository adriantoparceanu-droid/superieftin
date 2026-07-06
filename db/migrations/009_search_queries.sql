-- Logarea termenilor cautati pe site, pentru raportul "cele mai cautate" din admin.
-- Se scrie non-blocking din pagina de cautare (doar pe prima pagina de rezultate).
CREATE TABLE IF NOT EXISTS search_queries (
  id            BIGSERIAL PRIMARY KEY,
  term          TEXT NOT NULL,
  results_count INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_search_queries_created ON search_queries (created_at DESC);
