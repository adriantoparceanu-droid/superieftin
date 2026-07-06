-- Afiliere multi-retea: harta domeniu -> advertiser pentru rezolutie agnostica de retea.
-- Inlocuieste cuplarea pe Profitshare (retailers.ps_advertiser_id unic) cu o sursa care
-- suporta mai multe retele (Profitshare, 2Performant) si alege comisionul cel mai mare.

-- Advertiserii afiliati per retea. Un magazin (acelasi domeniu) poate aparea de mai
-- multe ori, cate o data per retea — rezolverul alege candidatul cu comisionul maxim.
CREATE TABLE IF NOT EXISTS affiliate_advertisers (
  id              SERIAL PRIMARY KEY,
  network         TEXT NOT NULL,                    -- 'profitshare' | '2performant'
  external_id     TEXT NOT NULL,                    -- id-ul advertiserului in reteaua respectiva
  name            TEXT,
  domain          TEXT,                             -- normalizat: 'emag.ro'
  advertiser_hash TEXT,                             -- hash advertiser (Profitshare) / program id (2P)
  affiliate_hash  TEXT,                             -- hash-ul tau de afiliat
  commission      NUMERIC(6,3),                     -- valoare comparabila intre retele (NULL = necunoscut)
  status          TEXT NOT NULL DEFAULT 'active',   -- active | pending | inactive
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (network, external_id)
);

-- Index pe domeniu pentru rezolutia la ingest (doar advertiserii activi).
CREATE INDEX IF NOT EXISTS idx_aff_adv_domain ON affiliate_advertisers (domain) WHERE status = 'active';

-- Din ce retea provine linkul afiliat al ofertei. NULL = neafiliat (afisat fara comision).
-- 'is_affiliate' ramane derivat (affiliate_url IS NOT NULL) — nu dublam informatia.
ALTER TABLE offers ADD COLUMN IF NOT EXISTS affiliate_network TEXT;
