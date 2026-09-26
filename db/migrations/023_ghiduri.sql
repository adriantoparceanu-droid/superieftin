-- 023: Ghiduri (continut editorial: /ghiduri, /ghiduri/[slug]; editor in /admin/ghiduri)
--
-- De ce in baza de date si nu in fisiere: proprietarul publica / actualizeaza ghidurile din
-- admin, fara deploy (decizia 2026-09-27, varianta A). Preturile NU se scriu in text: corpul
-- Markdown contine marcaje ({{oferte:…}}, {{pret:…}} etc.) randate la cerere din DB, ca
-- procentele sa fie mereu adevarate (REGULI.md, regula 9).
--
-- Idempotenta: poate rula de mai multe ori fara efect.

-- Autori / verificatori. Fara autori inventati: pornim cu echipa (organizatie) si cu Adrian
-- (persoana reala, verificatorul). Se pot adauga ulterior persoane reale, cu pagina optionala (url).
CREATE TABLE IF NOT EXISTS guide_authors (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  -- 'organization' sau 'person' — conteaza pentru JSON-LD (Organization vs Person)
  kind        TEXT NOT NULL DEFAULT 'person' CHECK (kind IN ('organization', 'person')),
  bio         TEXT,
  url         TEXT,          -- pagina autorului (optional): pe site sau profil public
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO guide_authors (name, slug, kind, bio, url) VALUES
  ('Echipa Superieftin.ro', 'echipa-superieftin', 'organization',
   'Echipa care urmărește zilnic prețurile de pe superieftin.ro.', '/despre'),
  ('Adrian', 'adrian', 'person', NULL, NULL)
ON CONFLICT (slug) DO NOTHING;

CREATE TABLE IF NOT EXISTS guides (
  id                SERIAL PRIMARY KEY,
  slug              TEXT NOT NULL UNIQUE,
  title             TEXT NOT NULL,
  meta_description  TEXT,
  -- 'produs' = ghid pe un produs („merită X?”, „X vs Y”); 'categorie' = „Cele mai bune … sub N lei”
  kind              TEXT NOT NULL DEFAULT 'produs' CHECK (kind IN ('produs', 'categorie')),
  body_md           TEXT NOT NULL DEFAULT '',
  summary           TEXT,                              -- blocul „Pe scurt”
  faq               JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{ "q": "...", "a": "..." }]
  author_id         INTEGER REFERENCES guide_authors(id) ON DELETE SET NULL,
  reviewer_id       INTEGER REFERENCES guide_authors(id) ON DELETE SET NULL,
  status            TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  published_at      TIMESTAMPTZ,                       -- prima publicare (nu se schimba la re-publicare)
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  category_slug     TEXT                               -- slug din categories (fara FK: slug-urile se pot redenumi)
);

CREATE INDEX IF NOT EXISTS idx_guides_published ON guides (published_at DESC) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_guides_category ON guides (category_slug) WHERE status = 'published';

-- Produsele legate de un ghid (pentru JSON-LD Product si sectiunea „Ghiduri despre acest produs”
-- de pe /p/). Daca produsul e sters, legatura dispare; ghidul ramane.
CREATE TABLE IF NOT EXISTS guide_products (
  guide_id    INTEGER NOT NULL REFERENCES guides(id) ON DELETE CASCADE,
  product_id  BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (guide_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_guide_products_product ON guide_products (product_id);
