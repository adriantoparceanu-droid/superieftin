-- Administrarea magazinelor și a surselor lor (Admin → Magazine & surse).
--
-- 1. Pauză manuală: proprietarul poate ascunde imediat toate ofertele unui magazin (ex. când
--    o rețea îi oprește programul), cu motiv + notă. Ofertele NU se șterg; la reactivare revin.
-- 2. Starea sursei, calculată zilnic de worker (worker/src/lib/retailer-status.ts):
--    ok | paused | feed_empty | feed_rejected | feed_missing | feed_error | program_inactive |
--    scan_failed | manual_only | stale — cu motivul în română și data de când durează.
--    La schimbarea stării, workerul trimite o avertizare pe Telegram proprietarului.
-- 3. feed_syncs.retailer_id: fiecare sincronizare știe acum ce magazin a atins (înainte doar
--    numele feed-ului), ca starea să se poată calcula per magazin.

ALTER TABLE retailers
  ADD COLUMN IF NOT EXISTS paused_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pause_reason       TEXT,
  ADD COLUMN IF NOT EXISTS admin_note         TEXT,
  ADD COLUMN IF NOT EXISTS source_state       TEXT,
  ADD COLUMN IF NOT EXISTS source_reason      TEXT,
  ADD COLUMN IF NOT EXISTS source_state_since TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS source_checked_at  TIMESTAMPTZ;

ALTER TABLE feed_syncs ADD COLUMN IF NOT EXISTS retailer_id INTEGER;
CREATE INDEX IF NOT EXISTS idx_feed_syncs_retailer ON feed_syncs (retailer_id, synced_at DESC);

-- Completare pentru istoricul existent: feed-urile au numele magazinului în denumire
-- („Telefoane Mobile - ForIT”, „evomag.ro — Televizoare”). Cele fără potrivire rămân NULL
-- și se completează corect de la următoarea sincronizare.
UPDATE feed_syncs fs SET retailer_id = r.id
FROM retailers r
WHERE fs.retailer_id IS NULL
  AND fs.source IN ('profitshare', '2performant', 'upload')
  AND fs.feed_name ILIKE '%' || r.slug || '%';

UPDATE feed_syncs fs SET retailer_id = r.id
FROM retailers r
WHERE fs.retailer_id IS NULL AND fs.source = 'scraper' AND fs.feed_link = 'scraper:' || r.slug;
