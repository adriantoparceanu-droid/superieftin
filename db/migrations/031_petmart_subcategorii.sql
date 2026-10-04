-- 031: subcategorii noi sub „Animale de Companie” + maparea feed-ului Petmart (2026-10-04).
--
-- De ce: ~8.300 de produse Petmart (63%) aveau category_id NULL — apăreau pe /p/, în căutare și
-- în sitemap, dar NU în meniu, pe /c/ sau pe homepage. Feed-ul are 279 de categorii proprii
-- („Zgarzi Caini”, „Filtre Interne”…); le grupăm pe teme, cu acordul proprietarului.
--
-- Idempotentă: categoriile/meniul se creează doar dacă lipsesc, regulile existente nu se
-- suprascriu (ON CONFLICT DO NOTHING), iar produsele mapate deja nu se ating.
-- Pe o bază fără Petmart (ex. locală goală) creează doar categoriile.
-- „Farmacie veterinară” e pe site, dar NU în reclame (afirmații de sănătate — regula 8).
-- După migrație pe prod: recreează containerul web (vezi „Cache gotcha” în CLAUDE.md).

-- 1) Subcategoriile noi (parinte: animale-de-companie)
INSERT INTO categories (name, slug, parent_id, sort_order, is_visible)
SELECT v.name, v.slug, p.id, v.sort_order, true
FROM (VALUES
  ('Farmacie veterinară',     'farmacie-veterinara',  40),
  ('Igienă & îngrijire',      'igiena-ingrijire-pet', 41),
  ('Zgărzi, lese & hamuri',   'zgarzi-lese-hamuri',   42),
  ('Culcușuri & transport',   'culcusuri-transport',  43),
  ('Castroane & hrănitoare',  'castroane-hranitoare', 44),
  ('Acvaristică',             'acvaristica',          45),
  ('Reptile',                 'reptile',              46),
  ('Rozătoare',               'rozatoare',            47),
  ('Păsări',                  'pasari',               48),
  ('Fermă',                   'ferma',                49)
) AS v(name, slug, sort_order)
JOIN categories p ON p.slug = 'animale-de-companie'
ON CONFLICT (slug) DO NOTHING;

-- 2) Meniul oglindește categoriile (sub elementul „Animale de Companie”)
INSERT INTO menu_items (label, category_id, parent_id, sort_order, is_visible)
SELECT c.name, c.id, mp.id, c.sort_order, true
FROM categories c
JOIN categories pc ON pc.id = c.parent_id AND pc.slug = 'animale-de-companie'
JOIN menu_items mp ON mp.category_id = pc.id AND mp.parent_id IS NULL
WHERE c.slug IN ('farmacie-veterinara', 'igiena-ingrijire-pet', 'zgarzi-lese-hamuri', 'culcusuri-transport',
                 'castroane-hranitoare', 'acvaristica', 'reptile', 'rozatoare', 'pasari', 'ferma')
  AND NOT EXISTS (SELECT 1 FROM menu_items m WHERE m.category_id = c.id);

-- 3) Reguli feed_category_map pentru Petmart: fiecare categorie din feed (fără regulă încă) →
--    subcategoria temei ei. Ordinea WHEN contează (ex. „Farmacie Pasari” → farmacie, nu păsări).
--    Potrivirea se face pe textul fără diacritice, cu litere mici. Ce nu se potrivește
--    („General”, „Diverse accesorii pisici”, promoții) rămâne nemapat → inbox-ul din Admin → Mapare.
WITH petmart AS (
  SELECT id FROM retailers WHERE slug = 'petmart'
),
feed_cats AS (
  SELECT DISTINCT trim(p.feed_category) AS feed_category,
         lower(translate(trim(p.feed_category), 'ăâîșțşţĂÂÎȘȚŞŢ', 'aaistStaaistSt')) AS f
  FROM products p
  JOIN offers o ON o.product_id = p.id
  JOIN petmart r ON r.id = o.retailer_id
  WHERE p.category_id IS NULL AND COALESCE(trim(p.feed_category), '') <> ''
),
classified AS (
  SELECT feed_category, CASE
    WHEN f ~ 'diet|farmacie|antiparazit|dermatolog|suplimente|vitamine|digestiv|afectiuni|otice|oftalmolog|imunostim|antiinflam|antibiotic|calmante|antidiareic|feromoni|cicatriz|paraziti|infectiilor|viermilor'
      THEN 'farmacie-veterinara'
    WHEN f ~ 'lapte' THEN 'hrana-umeda'
    WHEN f ~ 'reptil|terar' THEN 'reptile'
    WHEN f ~ 'rozatoare' THEN 'rozatoare'
    WHEN f ~ 'pasari' THEN 'pasari'
    WHEN f ~ 'ferma|bovine|ovine|suine|cai$|^cai|furaje|capcane|combatere|insecticide|fungicide|moluscocide|repelente|atractante|igiena adapost'
      THEN 'ferma'
    WHEN f ~ 'acvar|pesti|iaz|filtr|pomp|co2|alge|fertiliz|betta|carasi|ciclide|refract|skimmer|pietre aer|sare marina|aragonit|bacterii|ventuze|razuit|magneti|masa filtranta|plante artific|robineti|furtun|supape|electrozi|garnituri|fitinguri|compresoare|incalzitoare|lampi led|becuri|termometre|hidrometre|teste|aditivi|solutii|lemne si rad|nisip si piet|decoruri|pad acv|silicon|sticla|ceramice|pensete|breeding|hrana (granule|fulgi|stick|wafers|naturala|speciala|peleti|tablete|weekend|crestere|de crestere)|controlere|electrovalve|reductoare|valve|reactoare|incalzire si racire|plase|accesorii diverse iluminare'
      THEN 'acvaristica'
    WHEN f ~ 'nisip igienic|litier|igiena|sampoan|balsam|parfum|periaj|cosmetic|forfecute|bureti|covoare absorb|intre spalari|deodorante'
      THEN 'igiena-ingrijire-pet'
    WHEN f ~ 'zgarzi|lese|hamuri|botnite|dresaj|fluiere|fraie' THEN 'zgarzi-lese-hamuri'
    WHEN f ~ 'culcus|perne|paturi|cosuri|custi|transport|genti|centre de joaca|sisal|curte|auto|fashion|hainute'
      THEN 'culcusuri-transport'
    WHEN f ~ 'castroane|hranitoare|adapatoare|dozatoare' THEN 'castroane-hranitoare'
    WHEN f ~ 'jucarii' THEN 'jucarii-pet'
    WHEN f ~ 'delicii|hrana' THEN 'hrana-uscata'
  END AS slug
  FROM feed_cats
)
INSERT INTO feed_category_map (retailer_id, feed_category, category_id)
SELECT r.id, cl.feed_category, c.id
FROM classified cl
JOIN categories c ON c.slug = cl.slug
CROSS JOIN petmart r
ON CONFLICT (COALESCE(retailer_id, 0), lower(feed_category)) DO NOTHING;

-- 4) Aplică regulile pe produsele Petmart nemapate existente (importul le aplică oricum la
--    următorul feed-sync; aici doar ca să apară imediat). Aceeași potrivire ca loadFeedRules:
--    lower(trim(feed_category)).
UPDATE products p
SET category_id = m.category_id
FROM offers o
JOIN retailers r ON r.id = o.retailer_id AND r.slug = 'petmart'
JOIN feed_category_map m ON m.retailer_id = r.id
WHERE o.product_id = p.id
  AND p.category_id IS NULL
  AND lower(trim(p.feed_category)) = lower(m.feed_category);
