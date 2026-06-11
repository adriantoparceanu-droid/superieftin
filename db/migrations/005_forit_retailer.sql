-- Adauga retailer-ul forit.ro
INSERT INTO retailers (name, slug, base_url, scraper_config, is_active)
VALUES (
  'forit.ro',
  'forit',
  'https://www.forit.ro',
  '{"affiliateHash": "piC", "advertiserHash": "odA"}'::jsonb,
  true
)
ON CONFLICT (slug) DO NOTHING;
