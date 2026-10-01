-- 027: Clickuri interne (admin, roboti, unelte de test) separate de clickurile clientilor
--
-- De ce: /go/ inregistra orice click — si pe cele facute de proprietar din browserul cu care
-- intra in admin, si verificarile facute cu curl / scripturi. Dashboard-ul trebuie sa arate
-- doar clickurile reale ale clientilor.
--   - click_events: clickurile interne NU se mai scriu deloc (tabela = doar clienti).
--   - ad_clicks: randul se scrie in continuare (click_id-ul trebuie sa existe, altfel o comanda
--     de test n-ar mai putea fi potrivita), dar marcat is_internal = true. tracking:sync nu
--     trimite la Google conversii din clickuri interne, iar statisticile din admin le ignora.
-- Clickurile de dinainte de migratie nu pot fi deosebite (nu salvam user-agent / cookie-uri),
-- deci raman numarate ca reale; dispar din fereastra de 30 de zile pana la sfarsitul lui oct. 2026.
--
-- Idempotenta: poate rula de mai multe ori fara efect.

ALTER TABLE ad_clicks ADD COLUMN IF NOT EXISTS is_internal boolean NOT NULL DEFAULT false;
