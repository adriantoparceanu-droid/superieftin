-- Sectiune noua "Sănătate & Naturale" pentru produsele Vegis.ro (suplimente, ceaiuri,
-- cosmetice naturale, alimente bio etc.) — ~7400 produse care nu aveau loc in taxonomia de
-- electronice. Regulile sunt SPECIFICE retailerului Vegis: termeni ca "gel", "corp", "par",
-- "copii", "alimente" sunt generici si nu trebuie sa prinda produse de la alti retaileri.
-- Idempotent (upsert pe slug + ON CONFLICT pe reguli).

-- 1. Parinte + subcategorii ---------------------------------------------------
INSERT INTO categories (name, slug, sort_order, is_visible) VALUES
  ('Sănătate & Naturale', 'sanatate-naturale', 4, true)
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order, parent_id = NULL, is_visible = true;

INSERT INTO categories (name, slug, is_visible) VALUES
  ('Suplimente alimentare',            'suplimente-alimentare',          true),
  ('Ceaiuri & infuzii',                'ceaiuri-infuzii',                true),
  ('Uleiuri esențiale & aromaterapie', 'uleiuri-esentiale-aromaterapie', true),
  ('Cosmetice & îngrijire',            'cosmetice-ingrijire',            true),
  ('Miere & produse apicole',          'miere-apicole',                  true),
  ('Alimente bio & sănătoase',         'alimente-bio',                   true),
  ('Curățenie & casă',                 'curatenie-casa',                 true),
  ('Sănătate copii',                   'sanatate-copii',                 true)
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, is_visible = true;

-- 2. Ierarhie -----------------------------------------------------------------
UPDATE categories SET parent_id = (SELECT id FROM categories WHERE slug = 'sanatate-naturale'), sort_order = v.so
FROM (VALUES ('suplimente-alimentare',1),('ceaiuri-infuzii',2),('uleiuri-esentiale-aromaterapie',3),
             ('cosmetice-ingrijire',4),('miere-apicole',5),('alimente-bio',6),
             ('curatenie-casa',7),('sanatate-copii',8)) AS v(slug, so)
WHERE categories.slug = v.slug;

-- 3. Reguli de mapare (specifice Vegis) ---------------------------------------
-- JOIN retailers (nu subquery): daca Vegis nu exista, nu se insereaza nicio regula
-- (evita crearea de reguli globale gresite pe un DB fara Vegis).
INSERT INTO feed_category_map (retailer_id, feed_category, category_id, tag_ids)
SELECT r.id, v.fc, c.id, '{}'::int[]
FROM (VALUES
  -- Suplimente alimentare
  ('capsule, comprimate','suplimente-alimentare'),('comprimate/capsule','suplimente-alimentare'),
  ('pulbere','suplimente-alimentare'),('pachete suplimente','suplimente-alimentare'),
  ('tincturi simple','suplimente-alimentare'),('tincturi compuse','suplimente-alimentare'),
  ('fiole','suplimente-alimentare'),('gemoderivate','suplimente-alimentare'),
  ('supozitoare','suplimente-alimentare'),('imunitate','suplimente-alimentare'),
  ('gripa si raceala','suplimente-alimentare'),('fertilitate / virilitate','suplimente-alimentare'),
  ('vitamina b12','suplimente-alimentare'),('orl','suplimente-alimentare'),
  ('detoxifiere','suplimente-alimentare'),('slabire si modelare','suplimente-alimentare'),
  ('suplimente pentru slabire','suplimente-alimentare'),('cod liver oil','suplimente-alimentare'),
  ('fibre','suplimente-alimentare'),('suplimente','suplimente-alimentare'),
  ('remedii','suplimente-alimentare'),('pachete exclusive','suplimente-alimentare'),
  -- Ceaiuri & infuzii
  ('ceaiuri doze','ceaiuri-infuzii'),('ceaiuri vrac','ceaiuri-infuzii'),('ceaiuri pentru slabit','ceaiuri-infuzii'),
  -- Uleiuri esentiale & aromaterapie
  ('uleiuri esentiale','uleiuri-esentiale-aromaterapie'),('aromaterapie','uleiuri-esentiale-aromaterapie'),
  ('relaxare','uleiuri-esentiale-aromaterapie'),('masaj','uleiuri-esentiale-aromaterapie'),
  -- Cosmetice & ingrijire
  ('par','cosmetice-ingrijire'),('ten','cosmetice-ingrijire'),('corp','cosmetice-ingrijire'),
  ('gel','cosmetice-ingrijire'),('maini','cosmetice-ingrijire'),('picioare','cosmetice-ingrijire'),
  ('ochi','cosmetice-ingrijire'),('machiaj','cosmetice-ingrijire'),('balsam','cosmetice-ingrijire'),
  ('deodorante','cosmetice-ingrijire'),('sapunuri/ gel dus','cosmetice-ingrijire'),('baie','cosmetice-ingrijire'),
  ('acnee-tratamente','cosmetice-ingrijire'),('pete','cosmetice-ingrijire'),('manichiura','cosmetice-ingrijire'),
  ('ingrediente cosmetice','cosmetice-ingrijire'),('pachete cosmetice','cosmetice-ingrijire'),
  ('cosmetice','cosmetice-ingrijire'),('cosmetice cu miere de manuka','cosmetice-ingrijire'),
  ('cosmetice pentru slabit','cosmetice-ingrijire'),('unguente, geluri, solutii','cosmetice-ingrijire'),
  ('igiena bucala','cosmetice-ingrijire'),('uz general','cosmetice-ingrijire'),
  -- Miere & produse apicole
  ('miere de albine','miere-apicole'),('miere de manuka','miere-apicole'),('laptisor de matca','miere-apicole'),
  ('polen albine','miere-apicole'),('apicole','miere-apicole'),
  -- Alimente bio & sanatoase
  ('nuci, seminte','alimente-bio'),('fulgi, musli','alimente-bio'),('fainuri, tarate, grau','alimente-bio'),
  ('paste','alimente-bio'),('cereale boabe','alimente-bio'),('leguminoase','alimente-bio'),
  ('conserve','alimente-bio'),('fructe uscate','alimente-bio'),('dulciuri sanatoase','alimente-bio'),
  ('gustari, saratele','alimente-bio'),('creme tartinabile','alimente-bio'),('unt de arahide','alimente-bio'),
  ('faina fara gluten','alimente-bio'),('faina integrala','alimente-bio'),('fara gluten','alimente-bio'),
  ('cafea, cacao','alimente-bio'),('cacao','alimente-bio'),('condimente, sare','alimente-bio'),
  ('otet, uleiuri','alimente-bio'),('ulei','alimente-bio'),('uleiuri','alimente-bio'),
  ('produse bio','alimente-bio'),('batoane proteice','alimente-bio'),('seminte germinare','alimente-bio'),
  ('dulceata & gem','alimente-bio'),('dulciuri, indulcitori','alimente-bio'),('indulcitori naturali','alimente-bio'),
  ('siropuri','alimente-bio'),('sucuri, siropuri','alimente-bio'),('fara zahar','alimente-bio'),
  ('produse vegane','alimente-bio'),('alimente','alimente-bio'),('alimentare','alimente-bio'),
  ('pachete alimentare','alimente-bio'),('superalimente','alimente-bio'),
  -- Curatenie & casa
  ('uz casnic','curatenie-casa'),('spalat vase','curatenie-casa'),('detergent','curatenie-casa'),
  ('detergenti','curatenie-casa'),('ingrijire animale','curatenie-casa'),
  -- Sanatate copii
  ('copii','sanatate-copii'),('produse pentru copii','sanatate-copii')
) AS v(fc, cslug)
JOIN categories c ON c.slug = v.cslug
JOIN retailers r ON r.slug = 'vegis'
ON CONFLICT (COALESCE(retailer_id, 0), lower(feed_category))
DO UPDATE SET category_id = EXCLUDED.category_id;

-- 4. Aplicare retroactiva pe produsele Vegis nemapate -------------------------
UPDATE products p SET category_id = m.category_id, category = c.slug, updated_at = now()
FROM feed_category_map m
JOIN categories c ON c.id = m.category_id
WHERE m.retailer_id = (SELECT id FROM retailers WHERE slug = 'vegis')
  AND lower(coalesce(p.feed_category, '')) = lower(m.feed_category)
  AND p.category_id IS NULL
  AND EXISTS (SELECT 1 FROM offers o WHERE o.product_id = p.id AND o.retailer_id = m.retailer_id);

-- 5. Adauga ramura noua in meniu (non-distructiv) -----------------------------
INSERT INTO menu_items (label, category_id, parent_id, sort_order, is_visible)
SELECT c.name, c.id, NULL, c.sort_order, true FROM categories c
WHERE c.slug = 'sanatate-naturale'
  AND NOT EXISTS (SELECT 1 FROM menu_items m WHERE m.category_id = c.id);

INSERT INTO menu_items (label, category_id, parent_id, sort_order, is_visible)
SELECT c.name, c.id, pm.id, c.sort_order, true
FROM categories c
JOIN categories p ON p.id = c.parent_id
JOIN menu_items pm ON pm.category_id = p.id
WHERE p.slug = 'sanatate-naturale'
  AND NOT EXISTS (SELECT 1 FROM menu_items m WHERE m.category_id = c.id);
