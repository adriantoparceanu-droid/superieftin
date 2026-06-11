-- Dashboard de administrare: utilizatori, categorii ierarhice, taguri,
-- mapare feed -> categorii per retailer, constructor de meniu.

CREATE TABLE admin_users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  parent_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,  -- max 2 niveluri (impus de aplicatie)
  description TEXT,
  icon TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_categories_parent ON categories(parent_id);

CREATE TABLE tags (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL
);

CREATE TABLE product_tags (
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, tag_id)
);
CREATE INDEX idx_product_tags_tag ON product_tags(tag_id);

-- Regula de mapare: (retailer, categoria din feed) -> categoria site + taguri.
-- retailer_id NULL = regula globala; regula specifica retailerului are prioritate.
CREATE TABLE feed_category_map (
  id SERIAL PRIMARY KEY,
  retailer_id INTEGER REFERENCES retailers(id) ON DELETE CASCADE,
  feed_category TEXT NOT NULL,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  tag_ids INTEGER[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_feed_map_unique
  ON feed_category_map (coalesce(retailer_id, 0), lower(feed_category));

CREATE TABLE menu_items (
  id SERIAL PRIMARY KEY,
  label TEXT NOT NULL,
  category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
  url TEXT,                                                         -- alternativa la category_id
  parent_id INTEGER REFERENCES menu_items(id) ON DELETE CASCADE,    -- dropdown (max 2 niveluri)
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  CHECK (category_id IS NOT NULL OR url IS NOT NULL)
);

ALTER TABLE products ADD COLUMN category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL;
ALTER TABLE products ADD COLUMN feed_category TEXT;
CREATE INDEX idx_products_category_id ON products(category_id);

ALTER TABLE feed_syncs ADD COLUMN source TEXT NOT NULL DEFAULT 'profitshare';
ALTER TABLE feed_syncs ADD COLUMN filename TEXT;
ALTER TABLE feed_syncs ADD COLUMN unmapped_count INTEGER;

-- ============ Migrarea datelor existente ============

-- Categoriile-text actuale devin categorii reale (nume prettificat din slug)
INSERT INTO categories (name, slug, sort_order)
SELECT initcap(replace(category, '-', ' ')), category,
       row_number() OVER (ORDER BY count(*) DESC)
FROM products
GROUP BY category;

-- Tintele din vechea mapare care nu exista inca drept categorii
INSERT INTO categories (name, slug)
SELECT DISTINCT initcap(replace(site_category, '-', ' ')), site_category
FROM category_map
WHERE site_category NOT IN (SELECT slug FROM categories);

-- Leaga produsele de categoriile create; pastreaza textul brut pentru remapare
UPDATE products p SET
  category_id = c.id,
  feed_category = p.category
FROM categories c WHERE c.slug = p.category;

-- Vechile mapari devin reguli globale
INSERT INTO feed_category_map (retailer_id, feed_category, category_id)
SELECT NULL, cm.ps_category, c.id
FROM category_map cm JOIN categories c ON c.slug = cm.site_category;

DROP TABLE category_map;

-- Meniu initial: categoriile cu produse, in ordinea marimii
INSERT INTO menu_items (label, category_id, sort_order, is_visible)
SELECT c.name, c.id, c.sort_order, true
FROM categories c
WHERE EXISTS (SELECT 1 FROM products p WHERE p.category_id = c.id)
ORDER BY c.sort_order;
