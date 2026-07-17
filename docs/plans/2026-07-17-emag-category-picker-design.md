# Selector de categorii eMAG în admin (design validat)

**Problema:** în `/admin/scraper-categorii`, path-ul categoriei eMAG se tastează manual.
Un path greșit înseamnă 404 silențios la scraping — produsele nu apar și nimeni nu știe de ce.

**Soluția:** eMAG publică sitemap-ul oficial de categorii
(`https://www.emag.ro/sitemaps/categories-index.xml` → `categories-0.xml`, ~1815 categorii,
format `https://www.emag.ro/<path>/c`). Worker-ul îl descarcă și îl salvează în DB;
adminul alege dintr-o listă cu căutare, nu mai tastează path-uri.

## Componente

**1. Migrația `014_available_scraper_categories.sql`** — catalogul categoriilor *disponibile*
(distinct de `scraper_categories` = cele *alese pentru scanare*):

- `retailer_id` + `path` (PK compus), `label` (derivat din slug), `last_seen_at`.
- `retailer_id` de la început: tabela se refolosește pentru un viitor scraper (ex. Altex).
- Categoriile dispărute din sitemap NU se șterg — rămân cu `last_seen_at` vechi
  (un sitemap servit greșit nu ne golește catalogul).

**2. Worker** — `syncEmagCategoryCatalog()` în `worker/src/scrapers/emag-catalog.ts`:

- Descarcă indexul + fișierele de sitemap (1-2 cereri, ~350KB), extrage path-urile din `<loc>`,
  derivă eticheta (`masini-de-spalat-rufe` → „Masini de spalat rufe"), upsert în bloc.
- Rulează automat la începutul fiecărei rulări a scraper-ului eMAG (best-effort:
  dacă eșuează, scraping-ul continuă cu catalogul existent).
- Job BullMQ nou `catalog-refresh` pe coada `sync` (pentru butonul din admin)
  + flag CLI `--catalog` (`npm run catalog:now`) pentru rulare manuală locală.

**3. Admin** — formularul din `/admin/scraper-categorii` devine client component cu căutare:

- Tastezi ≥2 caractere → listă filtrată (label + path); click → se completează automat
  path, etichetă și feed category (toate rămân editabile).
- Categoriile deja adăugate apar marcate și nu se pot re-selecta.
- Buton „Actualizează lista din eMAG" → server action care pune jobul `catalog-refresh`
  în coadă (worker-ul face cererea către eMAG, nu containerul web).
- Catalog gol (worker nerulat încă) → formularul funcționează ca înainte, cu introducere manuală.

## Decizii luate

- **Sursa listei: worker → DB** (nu fetch din web, nu listă statică) — tot traficul către eMAG
  rămâne în worker, unde există deja rate-limiting și User-Agent configurat; adminul citește instant din DB.
- Refresh automat la cadența scraper-ului existent (cron 02:00) — fără cron nou.
- Fără ștergere la dispariția din sitemap — doar `last_seen_at` învechit.

## Testare

- Teste unitare pentru parsarea sitemap-ului și derivarea etichetei (`emag-catalog.test.ts`,
  adăugat la `npm test` în worker).
- Verificare locală: migrația 014, `npm run catalog:now`, pagina admin pe :3000.
