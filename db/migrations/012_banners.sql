-- Bannere administrabile pe homepage (stil Porto): un banner mare (slot 'main') si doua mici
-- sub el (slot 'small_left', 'small_right'), toate gestionate din /admin/bannere.
-- Tip: 'image' (imagine + link) sau 'html' (cod HTML/JS brut, ex. bannere de afiliere).

CREATE TABLE banners (
  id          BIGSERIAL PRIMARY KEY,
  slot        TEXT NOT NULL,                         -- 'main' | 'small_left' | 'small_right'
  type        TEXT NOT NULL DEFAULT 'image',         -- 'image' | 'html'
  title       TEXT,                                  -- nume intern (pentru admin)
  image_url   TEXT,                                  -- pentru type='image'
  link_url    TEXT,                                  -- unde duce click-ul (optional)
  alt         TEXT,                                  -- text alternativ imagine
  html        TEXT,                                  -- pentru type='html' (cod brut cu <script> permis)
  is_active   BOOLEAN NOT NULL DEFAULT true,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Cautarea de pe homepage: bannerul activ per slot, dupa ordine.
CREATE INDEX banners_slot_active_idx ON banners (slot, is_active, sort_order);
