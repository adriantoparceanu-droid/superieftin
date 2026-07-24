-- Categorii scanate de scrapere fara feed (ex. eMAG): control explicit al domeniului
-- de scanare (nu tot site-ul) + feed_category fixa, ca maparea catre categoriile
-- site-ului sa fie determinista (nu ghicita din breadcrumb-ul HTML).
CREATE TABLE IF NOT EXISTS scraper_categories (
  id            SERIAL PRIMARY KEY,
  retailer_id   INTEGER NOT NULL REFERENCES retailers(id) ON DELETE CASCADE,
  path          TEXT NOT NULL,          -- path-ul categoriei pe site-ul sursa, ex. 'telefoane-mobile'
  label         TEXT NOT NULL,          -- nume afisat in admin
  feed_category TEXT NOT NULL,          -- valoare folosita pentru feed_category_map (mapare)
  max_pages     INTEGER NOT NULL DEFAULT 3,
  enabled       BOOLEAN NOT NULL DEFAULT true,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (retailer_id, path)
);

-- eMAG nu ofera feed de produse — scraping pe categorii explicite, pornim cu cele
-- deja mapate global in feed_category_map (telefoane mobile, laptopuri, televizoare),
-- ca produsele sa apara direct pe site fara mapare manuala suplimentara.
INSERT INTO scraper_categories (retailer_id, path, label, feed_category, max_pages)
SELECT id, 'telefoane-mobile', 'Telefoane mobile', 'telefoane mobile', 3 FROM retailers WHERE slug = 'emag'
ON CONFLICT (retailer_id, path) DO NOTHING;

INSERT INTO scraper_categories (retailer_id, path, label, feed_category, max_pages)
SELECT id, 'laptopuri', 'Laptopuri', 'laptopuri', 3 FROM retailers WHERE slug = 'emag'
ON CONFLICT (retailer_id, path) DO NOTHING;

INSERT INTO scraper_categories (retailer_id, path, label, feed_category, max_pages)
SELECT id, 'televizoare', 'Televizoare', 'televizoare', 3 FROM retailers WHERE slug = 'emag'
ON CONFLICT (retailer_id, path) DO NOTHING;

-- Retailerul devine activ odata ce are o sursa de ingest functionala (scraper).
UPDATE retailers SET is_active = true WHERE slug = 'emag';
