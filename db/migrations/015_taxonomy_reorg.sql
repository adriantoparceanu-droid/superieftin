-- Reorganizare taxonomie: meniu pe 2 niveluri (3 categorii-parinte), condictia produsului
-- (Refurbished / Second Hand) devine TAG, nu categorie, iar bulk-ul CITGrup (o singura
-- categorie de feed "refurbished/second-hand" cu servere+desktop+laptop+workstation+monitor
-- amestecate) se imparte pe tip dupa denumire. Categoriile eMAG (telefoane-mobile, laptopuri,
-- televizoare) raman si se leaga direct prin feed_category_map. Idempotent (upsert pe slug).

-- 1. Taguri de conditie -------------------------------------------------------
INSERT INTO tags (name, slug) VALUES ('Refurbished', 'refurbished'), ('Second Hand', 'second-hand')
ON CONFLICT (slug) DO NOTHING;

-- 2. Categorii-parinte (nivel 1) ----------------------------------------------
INSERT INTO categories (name, slug, sort_order, is_visible) VALUES
  ('Telefoane & Accesorii',     'telefoane-accesorii',    1, true),
  ('Laptopuri & Calculatoare',  'laptopuri-calculatoare', 2, true),
  ('TV & Audio',                'tv-audio',               3, true)
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order, parent_id = NULL, is_visible = true;

-- 3. Subcategorii noi ---------------------------------------------------------
INSERT INTO categories (name, slug, is_visible) VALUES
  ('Încărcătoare & cabluri', 'incarcatoare-cabluri', true),
  ('Căști',                  'casti',                true),
  ('Desktop-uri',            'desktop-uri',          true),
  ('Workstations',           'workstations',         true),
  ('Servere',                'servere',              true),
  ('Monitoare',              'monitoare',            true),
  ('Periferice & software',  'periferice-software',  true)
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, is_visible = true;

-- Redenumiri pentru categoriile pastrate (nume mai curate in meniu)
UPDATE categories SET name = 'Licențe software' WHERE slug = 'licenta-software-microsoft';
UPDATE categories SET name = 'Folii protecție'  WHERE slug = 'folii-protectie-telefon';
UPDATE categories SET name = 'Suporturi auto'   WHERE slug = 'suport-auto-telefoane';

-- 4. Reguli de mapare feed_category -> categorie (globale) --------------------
INSERT INTO feed_category_map (retailer_id, feed_category, category_id, tag_ids)
SELECT NULL, v.fc, c.id, '{}'::int[]
FROM (VALUES
  ('telefoane mobile','telefoane-mobile'), ('telefoane-mobile','telefoane-mobile'),
  ('smartphone','telefoane-mobile'), ('smartphone-uri','telefoane-mobile'), ('telefoane','telefoane-mobile'),
  ('huse telefoane','huse-telefoane'),
  ('folii protectie telefon','folii-protectie-telefon'), ('folii-protectie-telefon','folii-protectie-telefon'),
  ('folii telefoane','folii-protectie-telefon'),
  ('incarcatoare telefon','incarcatoare-cabluri'), ('incarcatoare-telefon','incarcatoare-cabluri'),
  ('cabluri de date','incarcatoare-cabluri'), ('cabluri-de-date','incarcatoare-cabluri'),
  ('cabluri usb telefoane','incarcatoare-cabluri'),
  ('incarcatoare auto','incarcatoare-cabluri'), ('incarcatoare-auto','incarcatoare-cabluri'),
  ('baterii externe','baterii-externe'), ('baterii externe - powerbank','baterii-externe'),
  ('acumulator extern telefon','baterii-externe'), ('acumulator-extern-telefon','baterii-externe'),
  ('suport auto telefoane','suport-auto-telefoane'),
  ('casti de telefon','casti'),
  ('accesorii telefoane','accesorii-telefoane'), ('accesorii-telefoane','accesorii-telefoane'),
  ('laptopuri / notebook','laptopuri'), ('laptopuri','laptopuri'), ('laptop','laptopuri'),
  ('notebook','laptopuri'), ('notebook / laptop','laptopuri'),
  ('pc, periferice & software','periferice-software'), ('pc-periferice-software','periferice-software'),
  ('suporturi tv','suport-tv'),
  ('televizoare','televizoare'),
  ('boxe portabile','boxe-portabile')
) AS v(fc, cslug)
JOIN categories c ON c.slug = v.cslug
ON CONFLICT (COALESCE(retailer_id, 0), lower(feed_category))
DO UPDATE SET category_id = EXCLUDED.category_id;

-- 5. Functie de clasificare a bulk-ului catch-all (CITGrup) -------------------
-- Imparte produsele cu feed_category generica (refurbished/second-hand/touchscreen-second-hand)
-- pe tip dupa denumire si aplica tagul de conditie. Idempotenta, apelata si de worker dupa sync.
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

  -- Tip dupa denumire (ordinea conteaza: server/workstation inainte de desktop/laptop)
  UPDATE products p SET category_id = CASE
      WHEN p.name ~* '(^|\W)server'                                                             THEN c_server
      WHEN p.name ~* 'workstation'                                                              THEN c_ws
      WHEN p.name ~* '(^|\W)(laptop|notebook)'                                                  THEN c_laptop
      WHEN p.name ~* 'monitor'                                                                  THEN c_monitor
      WHEN p.name ~* '(calculator|all.?in.?one|desktop|mini.?pc|tower|optiplex|thinkcentre|prodesk|elitedesk)' THEN c_desktop
      ELSE c_perif END,
    updated_at = now()
  WHERE lower(coalesce(p.feed_category, '')) IN ('refurbished', 'second-hand', 'touchscreen-second-hand');

  -- Sincronizeaza slug-ul (products.category) cu noul category_id
  UPDATE products p SET category = c.slug
  FROM categories c WHERE c.id = p.category_id
    AND lower(coalesce(p.feed_category, '')) IN ('refurbished', 'second-hand', 'touchscreen-second-hand');

  -- Tag de conditie
  INSERT INTO product_tags (product_id, tag_id)
  SELECT p.id, t_refurb FROM products p WHERE lower(coalesce(p.feed_category, '')) = 'refurbished'
  ON CONFLICT DO NOTHING;
  INSERT INTO product_tags (product_id, tag_id)
  SELECT p.id, t_sh FROM products p WHERE lower(coalesce(p.feed_category, '')) IN ('second-hand', 'touchscreen-second-hand')
  ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- 6. Aplicare retroactiva pe produsele existente ------------------------------
-- 6a. Non-catch-all: dupa regulile globale din feed_category_map
UPDATE products p SET category_id = m.category_id, category = c.slug, updated_at = now()
FROM feed_category_map m JOIN categories c ON c.id = m.category_id
WHERE m.retailer_id IS NULL
  AND lower(coalesce(p.feed_category, '')) = lower(m.feed_category)
  AND lower(coalesce(p.feed_category, '')) NOT IN ('refurbished', 'second-hand', 'touchscreen-second-hand');

-- 6b. Catch-all CITGrup: split pe tip + tag
SELECT reclassify_catchall_products();

-- 6c. Ce a mai ramas in categoriile ce vor fi retrase (produse fara feed_category
--     acoperita de reguli) — realocare dupa maparea slug vechi -> slug nou.
UPDATE products p SET category_id = c.id, category = c.slug, updated_at = now()
FROM (VALUES
  ('cabluri-de-date','incarcatoare-cabluri'), ('cabluri-usb-telefoane','incarcatoare-cabluri'),
  ('incarcatoare-auto','incarcatoare-cabluri'), ('incarcatoare-telefon','incarcatoare-cabluri'),
  ('acumulator-extern-telefon','baterii-externe'), ('baterii-externe-powerbank','baterii-externe'),
  ('folii-telefoane','folii-protectie-telefon'),
  ('pc-periferice-software','periferice-software'),
  ('acumulatori-baterii-noi','baterii-telefoane'), ('noi','accesorii-telefoane'),
  ('refurbished','periferice-software'), ('second-hand','periferice-software'),
  ('touchscreen-second-hand','periferice-software')
) AS m(old_slug, new_slug)
JOIN categories old ON old.slug = m.old_slug
JOIN categories c   ON c.slug   = m.new_slug
WHERE p.category_id = old.id;

-- 7. Ierarhie: parinte + ordine pentru categoriile pastrate/noi ---------------
UPDATE categories SET parent_id = (SELECT id FROM categories WHERE slug = 'telefoane-accesorii'), sort_order = v.so
FROM (VALUES ('telefoane-mobile',1),('huse-telefoane',2),('folii-protectie-telefon',3),
             ('incarcatoare-cabluri',4),('baterii-externe',5),('baterii-telefoane',6),
             ('suport-auto-telefoane',7),('casti',8),('accesorii-telefoane',9)) AS v(slug, so)
WHERE categories.slug = v.slug;

UPDATE categories SET parent_id = (SELECT id FROM categories WHERE slug = 'laptopuri-calculatoare'), sort_order = v.so
FROM (VALUES ('laptopuri',1),('desktop-uri',2),('workstations',3),('servere',4),
             ('monitoare',5),('periferice-software',6),('licenta-software-microsoft',7)) AS v(slug, so)
WHERE categories.slug = v.slug;

UPDATE categories SET parent_id = (SELECT id FROM categories WHERE slug = 'tv-audio'), sort_order = v.so
FROM (VALUES ('televizoare',1),('suport-tv',2),('boxe-portabile',3)) AS v(slug, so)
WHERE categories.slug = v.slug;

-- 8. Retrage categoriile inlocuite (produsele au fost deja realocate) ----------
DELETE FROM feed_category_map WHERE category_id IN (
  SELECT id FROM categories WHERE slug IN (
    'cabluri-de-date','cabluri-usb-telefoane','incarcatoare-auto','incarcatoare-telefon',
    'acumulator-extern-telefon','baterii-externe-powerbank','folii-telefoane',
    'pc-periferice-software','acumulatori-baterii-noi','noi',
    'refurbished','second-hand','touchscreen-second-hand'
  )
);
DELETE FROM categories WHERE slug IN (
  'cabluri-de-date','cabluri-usb-telefoane','incarcatoare-auto','incarcatoare-telefon',
  'acumulator-extern-telefon','baterii-externe-powerbank','folii-telefoane',
  'pc-periferice-software','acumulatori-baterii-noi','noi',
  'refurbished','second-hand','touchscreen-second-hand'
);

-- 9. Reconstruieste meniul din arborele de categorii (2 niveluri) -------------
DELETE FROM menu_items;
INSERT INTO menu_items (label, category_id, parent_id, sort_order, is_visible)
SELECT c.name, c.id, NULL, c.sort_order, true FROM categories c WHERE c.parent_id IS NULL;
INSERT INTO menu_items (label, category_id, parent_id, sort_order, is_visible)
SELECT c.name, c.id, pm.id, c.sort_order, true
FROM categories c JOIN menu_items pm ON pm.category_id = c.parent_id
WHERE c.parent_id IS NOT NULL;
