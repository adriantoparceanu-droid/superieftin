-- Catalogul categoriilor DISPONIBILE pe site-urile scrapate (ex. eMAG), populat de worker
-- din sitemap-ul oficial (categories-index.xml). Distinct de scraper_categories (categoriile
-- ALESE pentru scanare): adminul alege din acest catalog in loc sa tasteze path-ul manual.
-- Categoriile disparute din sitemap nu se sterg — raman cu last_seen_at vechi, ca un
-- sitemap servit gresit sa nu goleasca lista.
CREATE TABLE IF NOT EXISTS available_scraper_categories (
  retailer_id  INTEGER NOT NULL REFERENCES retailers(id) ON DELETE CASCADE,
  path         TEXT NOT NULL,          -- ex. 'masini-de-spalat-rufe'
  label        TEXT NOT NULL,          -- derivat din path: 'Masini de spalat rufe'
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (retailer_id, path)
);
