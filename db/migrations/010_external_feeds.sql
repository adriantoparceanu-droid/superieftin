-- Feed-uri externe de produse (ex. feed-uri 2Performant per advertiser), adaugate prin URL.
-- Spre deosebire de feed-urile Profitshare (luate din API), acestea se configureaza explicit.
CREATE TABLE IF NOT EXISTS external_feeds (
  id          SERIAL PRIMARY KEY,
  url         TEXT NOT NULL UNIQUE,
  network     TEXT NOT NULL,                  -- '2performant' | ...
  label       TEXT,                           -- nume prietenos (ex. 'evomag.ro')
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO external_feeds (url, network, label) VALUES
  ('https://api.2performant.com/feed/2aec23706.xml', '2performant', 'evomag.ro')
ON CONFLICT (url) DO NOTHING;
