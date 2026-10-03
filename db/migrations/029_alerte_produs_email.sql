-- Alerte de pret pe PRODUS (orice magazin) + alerte pe EMAIL cu confirmare dubla.
-- Decizia proprietarului, 2026-10-03. Migratie aditiva: nu se sterge nicio alerta existenta.
--
-- 1. Alerta se leaga de produs (product_id), nu de o singura oferta: pleaca atunci cand ORICE
--    oferta disponibila a produsului ajunge la sau sub prag. Alertele existente (Telegram) se
--    convertesc pe produsul ofertei lor. offer_id ramane doar ca informatie („de pe ce oferta
--    s-a setat”), iar stergerea unei oferte nu mai sterge alerta (ON DELETE SET NULL).
-- 2. Abonatii pe email (email_subscribers): doar adresa + momentele de acord/confirmare + ultimul
--    email de alerte trimis (plafonul zilnic). Alerta pe email porneste doar dupa confirmare
--    (price_alerts.confirmed_at). La dezabonare se sterge abonatul → alertele lui (CASCADE).
-- 3. Re-armare (aprobata 2026-10-03): dupa anunt alerta NU se opreste. triggered_at = momentul
--    anuntului curent (NULL = armata, asteapta scaderea; NOT NULL = trimisa, asteapta ca pretul sa
--    urce peste prag + ALERT_REARM_PCT). is_active = false doar pentru alertele oprite (de
--    utilizator sau, inainte de aceasta migratie, dupa primul anunt). Vezi worker/src/lib/alert-rearm.ts.

-- ---------- 1. Alerte pe produs ----------

ALTER TABLE price_alerts ADD COLUMN IF NOT EXISTS product_id BIGINT REFERENCES products(id) ON DELETE CASCADE;

UPDATE price_alerts pa
SET product_id = o.product_id
FROM offers o
WHERE o.id = pa.offer_id AND pa.product_id IS NULL;

-- Plasa de siguranta pentru deploy: intre migratie si pornirea codului nou, botul vechi inca
-- insereaza doar offer_id. Triggerul completeaza product_id din oferta, ca NOT NULL sa nu crape.
CREATE OR REPLACE FUNCTION price_alerts_fill_product() RETURNS trigger AS $$
BEGIN
  IF NEW.product_id IS NULL AND NEW.offer_id IS NOT NULL THEN
    SELECT product_id INTO NEW.product_id FROM offers WHERE id = NEW.offer_id;
  END IF;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS price_alerts_fill_product ON price_alerts;
CREATE TRIGGER price_alerts_fill_product
  BEFORE INSERT ON price_alerts
  FOR EACH ROW EXECUTE FUNCTION price_alerts_fill_product();

ALTER TABLE price_alerts ALTER COLUMN product_id SET NOT NULL;

ALTER TABLE price_alerts ALTER COLUMN offer_id DROP NOT NULL;
ALTER TABLE price_alerts DROP CONSTRAINT IF EXISTS price_alerts_offer_id_fkey;
ALTER TABLE price_alerts
  ADD CONSTRAINT price_alerts_offer_id_fkey FOREIGN KEY (offer_id) REFERENCES offers(id) ON DELETE SET NULL;

-- Ce a declansat alerta (magazinul si pretul constatat) — apar in mesaj si in „Alertele mele”
ALTER TABLE price_alerts ADD COLUMN IF NOT EXISTS trigger_offer_id BIGINT REFERENCES offers(id) ON DELETE SET NULL;
ALTER TABLE price_alerts ADD COLUMN IF NOT EXISTS trigger_price NUMERIC(10,2);

CREATE INDEX IF NOT EXISTS price_alerts_product_active ON price_alerts (product_id) WHERE is_active = true;

-- ---------- 2. Alerte pe email ----------

CREATE TABLE IF NOT EXISTS email_subscribers (
  id             SERIAL PRIMARY KEY,
  email          TEXT NOT NULL UNIQUE,          -- litere mici, fara spatii
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),   -- prima cerere (acordul din formular)
  confirmed_at   TIMESTAMPTZ,                   -- primul click pe un link de confirmare
  last_digest_at TIMESTAMPTZ                    -- ultimul email cu alerte (plafon: 1 / zi implicit)
);

ALTER TABLE price_alerts ALTER COLUMN telegram_user_id DROP NOT NULL;
ALTER TABLE price_alerts ADD COLUMN IF NOT EXISTS email_subscriber_id INTEGER REFERENCES email_subscribers(id) ON DELETE CASCADE;
-- Momentul confirmarii: pe email = clickul pe linkul de confirmare (pana atunci alerta NU ruleaza);
-- pe Telegram = crearea (vizitatorul a pornit singur conversatia cu botul).
ALTER TABLE price_alerts ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;
UPDATE price_alerts SET confirmed_at = created_at WHERE confirmed_at IS NULL AND telegram_user_id IS NOT NULL;

ALTER TABLE price_alerts DROP CONSTRAINT IF EXISTS price_alerts_un_canal;
ALTER TABLE price_alerts
  ADD CONSTRAINT price_alerts_un_canal CHECK (num_nonnulls(telegram_user_id, email_subscriber_id) = 1);

CREATE INDEX IF NOT EXISTS price_alerts_email_subscriber ON price_alerts (email_subscriber_id);
-- O singura alerta activa confirmata per abonat + produs (o confirmare noua o inlocuieste pe cea veche)
CREATE UNIQUE INDEX IF NOT EXISTS price_alerts_email_produs_activ
  ON price_alerts (email_subscriber_id, product_id)
  WHERE email_subscriber_id IS NOT NULL AND is_active = true AND confirmed_at IS NOT NULL;

-- ---------- 3. Re-armare ----------

-- Ultimul anunt (plafonul per alerta pe Telegram) — ramane si dupa re-armare, spre deosebire de triggered_at
ALTER TABLE price_alerts ADD COLUMN IF NOT EXISTS last_notified_at TIMESTAMPTZ;
-- Ultima re-armare (pretul a urcat inapoi peste prag + marja)
ALTER TABLE price_alerts ADD COLUMN IF NOT EXISTS rearmed_at TIMESTAMPTZ;
-- Ultima schimbare de prag (conteaza ca activitate pentru limita de viata a alertei)
ALTER TABLE price_alerts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
-- Cate anunturi a trimis alerta (informativ, „Alertele mele”)
ALTER TABLE price_alerts ADD COLUMN IF NOT EXISTS notify_count INTEGER NOT NULL DEFAULT 0;

-- Alertele trimise inainte de re-armare: au anuntat o data (raman oprite, ca pana acum)
UPDATE price_alerts SET last_notified_at = triggered_at, notify_count = 1
WHERE triggered_at IS NOT NULL AND last_notified_at IS NULL;
