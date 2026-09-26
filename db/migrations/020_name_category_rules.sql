-- Mapare după denumire (Admin → Mapare categorii), pentru produsele fără categorie în feed.
--
-- Unele feed-uri nu au câmpul de categorie (ex. „Pc EvoMag” de la 2Performant: doar titlu,
-- preț, imagine) sau amestecă tipuri diferite sub aceeași categorie. O regulă spune:
-- „dacă denumirea conține unul din cuvintele X → categoria Y” sau „→ ignoră”.
--   - se aplică la import DUPĂ regulile pe categorie de feed (feed_category_map), doar
--     produselor rămase fără categorie;
--   - retailer_id NULL = pentru toți retailerii;
--   - action 'ignore' = produsul nu se mai importă (și ofertele existente se ascund);
--   - terms = cuvinte separate prin virgulă, potrivite ca CUVÂNT ÎNTREG, fără diferență
--     de majuscule („PC” nu prinde „PCIe”);
--   - priority mai mic = verificată prima (prima potrivire câștigă).

CREATE TABLE IF NOT EXISTS name_category_rules (
    id           SERIAL PRIMARY KEY,
    retailer_id  INTEGER REFERENCES retailers(id) ON DELETE CASCADE,
    terms        TEXT NOT NULL,
    category_id  INTEGER REFERENCES categories(id) ON DELETE CASCADE,
    action       TEXT NOT NULL DEFAULT 'map' CHECK (action IN ('map', 'ignore')),
    priority     INTEGER NOT NULL DEFAULT 100,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (action = 'ignore' OR category_id IS NOT NULL)
);

-- Subcategorie nouă pentru componente (decizia proprietarului, 2026-09-26): procesoare,
-- HDD/SSD, memorii — inclusiv de server. Redenumibilă / ștergabilă din Admin → Categorii.
INSERT INTO categories (name, slug, is_visible)
VALUES ('Componente PC & server', 'componente-pc-server', true)
ON CONFLICT (slug) DO NOTHING;

UPDATE categories
SET parent_id = (SELECT id FROM categories WHERE slug = 'laptopuri-calculatoare'),
    sort_order = COALESCE((SELECT max(sort_order) + 1 FROM categories
                           WHERE parent_id = (SELECT id FROM categories WHERE slug = 'laptopuri-calculatoare')), 99)
WHERE slug = 'componente-pc-server' AND parent_id IS NULL;

-- Oglinda în meniu (meniul e condus de arborele de categorii)
INSERT INTO menu_items (label, category_id, parent_id, sort_order, is_visible)
SELECT c.name, c.id, pm.id, c.sort_order, true
FROM categories c
JOIN categories p ON p.id = c.parent_id
JOIN menu_items pm ON pm.category_id = p.id
WHERE c.slug = 'componente-pc-server'
  AND NOT EXISTS (SELECT 1 FROM menu_items m WHERE m.category_id = c.id);
