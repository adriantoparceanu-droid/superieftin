-- Feed extern 2Performant suplimentar (evomag.ro — gama de televizoare/suporturi TV).
-- Se importa dupa regula normala (feed_category_map); produsele raman nemapate
-- (category_id NULL) pana cand se creeaza regulile de mapare din /admin/categorii.
INSERT INTO external_feeds (url, network, label) VALUES
  ('https://api.2performant.com/feed/cab64e5c7.xml', '2performant', 'evomag.ro — Televizoare')
ON CONFLICT (url) DO NOTHING;
