-- 034: repara clasificarea bulk-ului CITGrup (functia din migratia 015).
--
-- Doua erori gasite pe 10 oct. 2026, cand /c/monitoare avea ~8.500 de produse, aproape toate
-- workstation-uri si calculatoare All in One (doar cateva monitoare reale):
--   1. Feed-ul CITGrup scrie acum categoriile cu SPATII („second hand”, „touchscreen second hand”),
--      iar functia recunostea doar varianta cu cratima („touchscreen-second-hand”). Produsele ramaneau
--      unde le punea regula feed_category_map (ex. regula din 6 oct. „touchscreen second hand” →
--      monitoare) si nu primeau tagul „Second Hand”.
--      Remediu: comparam forma normalizata (litere mici, spatii/underscore → cratima).
--   2. Ordinea verificarilor dupa denumire: „Calculator All in One, Dell OptiPlex …, Monitor 22 inch …”
--      contine „monitor” → ajungea la monitoare inaintea regulii pentru calculatoare.
--      Remediu: monitor DOAR daca denumirea INCEPE cu „Monitor”; altfel calculatoarele/AIO castiga,
--      iar „monitor” oriunde in nume ramane ultima varianta inainte de periferice.
-- „touchscreen refurbished” (1 produs azi) intra in acelasi tratament. „microsoft refurbished”
-- (monitoare noi, cu garantie) NU e catch-all: se mapeaza din Admin → Mapare, fara tag de conditie.
-- Functia ramane idempotenta si e apelata de worker la finalul fiecarui feed-sync.

CREATE OR REPLACE FUNCTION reclassify_catchall_products() RETURNS void AS $$
DECLARE
  c_laptop int; c_desktop int; c_ws int; c_server int; c_monitor int; c_perif int;
  t_refurb int; t_sh int;
BEGIN
  SELECT id INTO c_laptop  FROM categories WHERE slug = 'laptopuri';
  SELECT id INTO c_desktop FROM categories WHERE slug = 'desktop-uri';
  SELECT id INTO c_ws      FROM categories WHERE slug = 'workstations';
  SELECT id INTO c_server  FROM categories WHERE slug = 'servere';
  SELECT id INTO c_monitor FROM categories WHERE slug = 'monitoare';
  SELECT id INTO c_perif   FROM categories WHERE slug = 'periferice-software';
  SELECT id INTO t_refurb  FROM tags WHERE slug = 'refurbished';
  SELECT id INTO t_sh      FROM tags WHERE slug = 'second-hand';

  -- Tip dupa denumire (ordinea conteaza: server/workstation inainte de desktop/laptop;
  -- „Monitor …” la inceput inainte de calculatoare, „monitor” oriunde dupa ele)
  UPDATE products p SET category_id = CASE
      WHEN p.name ~* '(^|\W)server'                                                             THEN c_server
      WHEN p.name ~* 'workstation'                                                              THEN c_ws
      WHEN p.name ~* '(^|\W)(laptop|notebook)'                                                  THEN c_laptop
      WHEN p.name ~* '^\W*monitor'                                                              THEN c_monitor
      WHEN p.name ~* '(calculator|all.?in.?one|desktop|mini.?pc|tower|optiplex|thinkcentre|prodesk|elitedesk)' THEN c_desktop
      WHEN p.name ~* 'monitor'                                                                  THEN c_monitor
      ELSE c_perif END,
    updated_at = now()
  WHERE regexp_replace(lower(trim(coalesce(p.feed_category, ''))), '[\s_]+', '-', 'g')
        IN ('refurbished', 'second-hand', 'touchscreen-second-hand', 'touchscreen-refurbished');

  -- Sincronizeaza slug-ul (products.category) cu noul category_id
  UPDATE products p SET category = c.slug
  FROM categories c WHERE c.id = p.category_id
    AND regexp_replace(lower(trim(coalesce(p.feed_category, ''))), '[\s_]+', '-', 'g')
        IN ('refurbished', 'second-hand', 'touchscreen-second-hand', 'touchscreen-refurbished');

  -- Tag de conditie
  INSERT INTO product_tags (product_id, tag_id)
  SELECT p.id, t_refurb FROM products p
  WHERE regexp_replace(lower(trim(coalesce(p.feed_category, ''))), '[\s_]+', '-', 'g')
        IN ('refurbished', 'touchscreen-refurbished')
  ON CONFLICT DO NOTHING;
  INSERT INTO product_tags (product_id, tag_id)
  SELECT p.id, t_sh FROM products p
  WHERE regexp_replace(lower(trim(coalesce(p.feed_category, ''))), '[\s_]+', '-', 'g')
        IN ('second-hand', 'touchscreen-second-hand')
  ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Aplica imediat (altfel ar astepta urmatorul feed-sync)
SELECT reclassify_catchall_products();
