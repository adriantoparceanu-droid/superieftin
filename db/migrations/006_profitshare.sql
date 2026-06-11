-- Integrare Profitshare: identificare produse prin part_no, legatura retaileri-advertiseri,
-- jurnal sincronizari feed si mapare categorii.

-- Cod de produs (SKU / part number) din feed — cheia de unificare intre retaileri.
-- Unificarea se face pe (part_no, brand) ca sa evitam coliziuni intre SKU-uri interne
-- ale unor advertiseri diferiti.
ALTER TABLE products ADD COLUMN IF NOT EXISTS part_no TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_part_no_brand
  ON products (part_no, lower(coalesce(brand, ''))) WHERE part_no IS NOT NULL;

-- Legatura cu advertiserii Profitshare + logo pentru afisare.
ALTER TABLE retailers ADD COLUMN IF NOT EXISTS ps_advertiser_id INTEGER UNIQUE;
ALTER TABLE retailers ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Jurnalul sincronizarilor de feed: decide daca un feed regenerat trebuie redescarcat
-- si pastreaza numarul de produse pentru detectia feed-urilor suspecte (incomplete).
CREATE TABLE IF NOT EXISTS feed_syncs (
  id BIGSERIAL PRIMARY KEY,
  feed_link TEXT NOT NULL,
  feed_name TEXT,
  ps_updated_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  products_count INTEGER,
  status TEXT NOT NULL DEFAULT 'success'
);
CREATE INDEX IF NOT EXISTS idx_feed_syncs_link ON feed_syncs (feed_link, synced_at DESC);

-- Mapare categorii Profitshare -> categorii site. Categoriile nemapate se importa
-- cu slug generat automat din numele categoriei din feed.
CREATE TABLE IF NOT EXISTS category_map (
  ps_category TEXT PRIMARY KEY,
  site_category TEXT NOT NULL
);
INSERT INTO category_map (ps_category, site_category) VALUES
  ('telefoane mobile', 'telefoane-mobile'),
  ('telefoane', 'telefoane-mobile'),
  ('smartphone', 'telefoane-mobile'),
  ('smartphone-uri', 'telefoane-mobile'),
  ('laptopuri', 'laptopuri'),
  ('laptop', 'laptopuri'),
  ('notebook', 'laptopuri'),
  ('notebook / laptop', 'laptopuri')
ON CONFLICT (ps_category) DO NOTHING;

-- Leaga retailerii existenti de advertiserii Profitshare (id-uri reale din cont).
UPDATE retailers SET ps_advertiser_id = 35     WHERE slug = 'emag'  AND ps_advertiser_id IS NULL;
UPDATE retailers SET ps_advertiser_id = 138584 WHERE slug = 'forit' AND ps_advertiser_id IS NULL;
