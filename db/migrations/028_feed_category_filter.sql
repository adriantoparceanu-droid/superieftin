-- 028: Filtru de categorii per feed extern (external_feeds.category_filter)
--
-- De ce: unele feed-uri 2Performant sunt uriase si dominate de un singur tip de produs
-- (ex. evomag „Solutii mobile”: ~17.000 de produse, ~82% huse de telefon). Proprietarul
-- alege din Admin → Surse feed („Alege categoriile”) CE categorii din feed (<category>) se importa.
--
-- Semnificatia coloanei:
--   NULL  = importa toate categoriile (comportamentul de pana acum — feed-urile existente
--           raman neschimbate)
--   '{}'  = nu importa nimic pana alegi categoriile (feed-ul e sarit complet la sync, fara
--           descarcare si fara rand in feed_syncs, deci nu apare ca „feed gol” in starea magazinului)
--   lista = doar categoriile din lista (comparatie fara diferenta de majuscule / spatii la capete)
--
-- Debifarea unei categorii NU sterge nimic: ofertele ei nu mai sunt confirmate de feed si
-- devin „fara stoc” singure dupa 3 zile (marcarea stale existenta).
--
-- Idempotenta: poate rula de mai multe ori fara efect.

ALTER TABLE external_feeds ADD COLUMN IF NOT EXISTS category_filter text[] NULL;
