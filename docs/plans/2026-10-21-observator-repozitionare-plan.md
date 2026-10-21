# Plan de implementare — Observatorul reducerilor reale

**Design:** `docs/plans/2026-10-21-observator-repozitionare-design.md` (validat 2026-10-21).
**Mandat:** proprietarul a cerut implementare completă + deploy peste noapte, fără aprobări intermediare (2026-10-21, seara). Excepție: Cloudflare (doar din UI) → în raport.

## Organizare

Trei piste paralele, fiecare pe branch propriu într-un worktree, agent `site-dev`. Coordonatorul (sesiunea principală) unește în `main`, rulează testele, actualizează `CLAUDE.md`, face deploy (`./deploy.sh`) și push.

| Pistă | Branch | Migrație | Conținut |
|---|---|---|---|
| A | `seo/observator-a-index` | **035** | Politica de index „are poveste” + canonical pe variante |
| B | `seo/observator-b-black-friday` | **036** | Tracker `/black-friday-2026` + referința înghețată + snapshot zilnic + fapt pe `/p/` |
| C | `seo/observator-c-indice` | **037** | Indicele lunar `/indice`, „Când să cumperi”, repoziționare (homepage, `/despre`, JSON-LD, `llms.txt`, meniu, sitemap) |

Reguli comune pentru toate pistele:
- Nu modifica `CLAUDE.md` (coordonatorul integrează paragraful din raportul agentului).
- Testele noi se adaugă la lista explicită din `package.json` (`"test"`), web sau worker.
- Nu atinge `ads/`, garda de reclame, textul „Reducere reală” și fraza citită de `parseDiscountPct`.
- Fără Sănătate & Naturale (arborele `sanatate-naturale`) și fără `farmacie-veterinara` în paginile observatorului.
- Nu agregăm `price_history` la cerere în web: totul precalculat de worker în tabele.
- Fără prețuri/procente scrise de mână în texte, fără promisiuni (regula 9); fraze-fapt datate.
- Tokeni de design (`text-ink`, `bg-surface`…), nu culori brute. Citește `web/AGENTS.md` înainte de cod Next.js.
- Comentarii în română care explică „de ce”, commit-uri `feat(scope): …` în română.
- Gata = `cd worker && npm test && npx tsc --noEmit`, `cd web && npm test && npx tsc --noEmit && npm run lint` (fără erori noi), migrația aplicată local (`cd worker && npx tsx src/migrate.ts`), paginile noi verificate local (200, JSON-LD valid).

## Pista A — index „are poveste”

1. Migrația `035_offer_price_changes.sql`: `offer_price_stats.price_changes_60d INT` (numărul de schimbări de preț între puncte consecutive din `price_history` în 60 de zile) + completare inițială.
2. `worker/src/lib/price-stats.ts`: calculul în același upsert (LAG pe 60 de zile).
3. `web/src/lib/seo/product-index.ts`: condiția 5 — `availableStores ≥ 2` SAU `priceChanges60d ≥ 3`; motiv nou `fara-poveste`; aceeași condiție în `PRODUCT_INDEXABLE_SQL`; datele pentru `generateMetadata` din `getProductDetail` / query-ul existent.
4. Canonical pe variante: grup = aceeași categorie + aceeași marcă + denumire normalizată fără culori/cuvinte de culoare (listă conservatoare); pagina principală = cele mai multe oferte disponibile, apoi istoricul cel mai lung, apoi id-ul cel mai mic. Celelalte: canonical spre principală + scoase din sitemap. Helper pur testat.
5. Script doar-citire `worker/src/scripts/seo-index-report.ts` (`npm run seo:index-report`): câte `/p/` sunt indexabile înainte/după, pe motive — rulat pe prod după deploy pentru raport.

## Pista B — tracker Black Friday

1. Migrația `036_event_tracker.sql`: `price_events` (slug, nume, `freeze_at`, `starts_at`, `ends_at`), `event_reference_prices` (event, offer_id, mediana înghețată), `event_daily_stats` (event, zi, categorie, reduse, reale, umflate, reducere reală mediană, nr. magazine). Seed: `black-friday-2026`, freeze 1 nov. 2026, fereastră 1 nov. – 2 dec. 2026.
2. Worker `worker/src/lib/event-tracker.ts` (funcții pure + SQL), rulat după `runPriceSnapshot`: referința = mediana din `price_history` pe [freeze − 30 zile, freeze) (calculabilă oricând după freeze); agregatele zilnice din oferte disponibile (confirmate ≤ 3 zile). Definiții: redusă = preț azi ≥ 5% sub maximul din ultimele 14 zile; reală = preț ≤ referință × 0,95; umflată = redusă, nereală și maximul din 14 zile ≥ referință × 1,10.
3. Web `/black-friday-2026`: înainte de freeze — „Măsurătorile încep pe 1 noiembrie” + reducerile reale de azi (regula obișnuită); după — cifre-cheie datate, tabel pe categorie, top reduceri reale pe vertical (`AffiliateLink`), grafic zilnic (SVG propriu), metodologie, FAQ (`FAQPage`), `Dataset` JSON-LD. ISR 1 h.
4. `/p/`: rând în `priceFactRows` când oferta e umflată în fereastra evenimentului.
5. Linkuri: ghidurile BF existente nu se rescriu automat (conținut DB) — doar link din `/p/` în fereastră + din hub.

## Pista C — indice, „Când să cumperi”, repoziționare

1. Migrația `037_price_index.sql`: `price_index_monthly` (lună, categorie, coș, variație mediană, reduceri reale, magazin cel mai ieftin, `computed_at`, `retroactive`), `category_buy_timing` (categorie, săptămână, mediana coșului, % zile cu reduceri reale, durata medie).
2. Worker `worker/src/lib/price-index.ts` + job BullMQ `price-index` (`PRICE_INDEX_CRON`, implicit `0 5 1 * *`) + script `npm run price-index:now -- [--month=YYYY-MM] [--retro]`; ediția publicată nu se rescrie. `category_buy_timing` recalculat săptămânal în același job.
3. Web `/indice`, `/indice/[luna]`, `/cand-sa-cumperi`, `/cand-sa-cumperi/[categorie]` (doar categorii cu ≥ 50 de produse în coș; altfel 404). Fraze „de la iunie 2026, de când urmărim”.
4. Repoziționare: homepage (titlu/meta), `Organization.description`, `/despre`, `llms.txt`/`llms-full.txt` (secțiunea „Observator”), meniu (Black Friday 2026, Indicele prețurilor, Când să cumperi), sitemap `pagini.xml` (rutele noi, inclusiv `/black-friday-2026`), linkuri din `/c/`.

## Integrare (coordonator)

1. Merge A → B → C în `main`, rezolvare conflicte (`package.json` test lists, `worker/src/index.ts`, `sitemap`, `llms`).
2. Migrații local + toate testele + `tsc` + build web.
3. `CLAUDE.md`: paragrafele agenților.
4. `./deploy.sh` (web + worker), apoi pe prod: `seo:index-report`, `price-index:now --retro` pentru iul.–sep. + ediția oct. (doar după 1 nov. — ediția curentă se publică automat), recalcul tracker.
5. Verificare live (200, JSON-LD, robots), commit rapoarte, `git push origin main`, raport de dimineață în `docs/seo/2026-10-22-raport-noapte-observator.md`.
