# Integrare Profitshare — înlocuirea web scraping-ului

**Data:** 2026-06-11
**Status:** validat cu utilizatorul

## Decizie

Înlocuim complet scraperele HTML (eMAG, Forit) cu integrarea Profitshare, în variantă **hibridă**:

1. **Feed CSV** (zilnic) — import catalog complet de la toți advertiserii acceptați în cont.
2. **API `/affiliate-products/`** (la câteva ore) — verificare rapidă de preț pentru produsele
   prioritare (alerte active, produse populare), prin filtrul `part_no`.

Scraperele `emag.ts` și `forit.ts` se elimină. Datele existente (produse, istoric prețuri) se păstrează.

## Documentația API (api.profitshare.ro, secțiunea RO)

- **Autentificare:** HMAC-SHA1. Headers: `Date`, `X-PS-Client` (API USER), `X-PS-Accept: json`,
  `X-PS-Auth` = HMAC-SHA1(API_KEY, `{VERB}{path}/?{query_string}/{api_user}{date}`).
  Toleranță de ceas: ±20 secunde (NTP obligatoriu).
- **`GET /affiliate-advertisers/`** — advertiseri activi (id, name, logo, category, url).
- **`GET /affiliate-feeds/`** — feed-urile CSV configurate în dashboard: `link` (descărcare),
  `type`, `name`, `updated_at`, `status`, `advertisers`. Limită: 60 cereri/min.
- **`GET /affiliate-products/`** — 20 produse/pagină, limită 60 cereri/min.
  Filtre: `filters[advertisers]`, `filters[part_no]` (SKU). Câmpuri: link, name, image,
  price_vat, price, advertiser_id, advertiser_name, category_name. Fără stoc, brand sau ID unic.
- **`POST /affiliate-links/`** — generare linkuri afiliate (100 cereri/min). Nu îl folosim per
  produs (limita ar bloca importul în masă); linkurile se construiesc local cu pattern-ul
  `l.profitshare.ro/lps/{advertiserHash}/{affiliateHash}/?redirect=`.

**Constrângere cheie:** paginarea la 20/pagină face imposibilă aducerea catalogului eMAG integral
prin API — de aceea importul de catalog se face din feed CSV, iar API-ul servește doar
verificărilor punctuale prin `part_no`.

## Arhitectură și flux de date

Scheletul existent rămâne: BullMQ + Redis + Postgres + upsert tranzacțional
`products → offers → price_history`, alerte Telegram, invalidare cache site.

**Flux 1 — `feed-sync` (zilnic, 04:00, după regenerarea feed-urilor ~03:00):**
1. `GET /affiliate-feeds/` → pentru fiecare feed activ comparăm `updated_at` cu ultima
   sincronizare din `feed_syncs`; descărcăm doar feed-urile regenerate.
2. CSV procesat în streaming (rând cu rând, fără încărcare integrală în memorie).
3. Normalizare → upsert. La final: verificare alerte + invalidare cache.

**Flux 2 — `price-check` (la 3h, configurabil):**
1. Selectăm produsele prioritare cu `part_no`: alerte active + cele mai accesate.
2. `GET /affiliate-products/?filters[part_no]=...` — un apel aduce prețul de la toți
   advertiserii care vând produsul. Throttling 60 req/min.
3. Upsert → `price_history` ca până acum.

**Advertiseri:** `GET /affiliate-advertisers/` populează automat tabela `retailers`
(advertiser nou acceptat = retailer nou, fără cod).

## Unificarea produselor între retaileri

Matching pe **`part_no`/EAN din feed** (index unic parțial pe `products.part_no`),
cu **fallback pe `slug`** normalizat din nume (mecanismul actual) când codul lipsește.

## Schimbări în schemă (migrația `006_profitshare.sql`)

- `products.part_no TEXT` + index unic parțial `WHERE part_no IS NOT NULL`.
- `retailers.ps_advertiser_id INT UNIQUE`, `retailers.logo_url TEXT`.
- Tabelă nouă `feed_syncs` (feed_link, ps_updated_at, synced_at, products_count, status).

## Schimbări în cod (worker)

- `lib/profitshare.ts` — client API complet: semnare HMAC, `getAdvertisers()`, `getFeeds()`,
  `getProducts()`, throttling, retry.
- `lib/upsert.ts` — upsert-ul mutat din scrape.worker, extins cu `part_no`.
- `importers/feed.ts` — descărcare CSV streaming + mapare coloane → produs normalizat.
- `workers/sync.worker.ts` — joburile `feed-sync` și `price-check`.
- Eliminate: `scrapers/emag.ts`, `scrapers/forit.ts`, `workers/scrape.worker.ts`,
  dependența `cheerio`.
- `.env`: `PROFITSHARE_API_USER/KEY`, `FEED_SYNC_CRON`, `PRICE_CHECK_INTERVAL_HOURS=3`.

**Categorii:** `category_name` din Profitshare → categorii site printr-o mapare configurabilă;
categoriile necunoscute se importă cu slug auto-generat (nimic nu se pierde).

## Tratarea erorilor

- `AuthTimeDifference` logat explicit (drift de ceas > 20s).
- Throttling preventiv + backoff exponențial pe 429/5xx (retry BullMQ).
- Feed suspect (sub 50% din rândurile sincronizării anterioare) → import abandonat, DB neatins,
  status scris în `feed_syncs`.
- Oferte dispărute din feed după N sincronizări → `in_stock = false` (nu se șterg; istoricul rămâne).

## Testare (local; deploy doar la comandă explicită)

1. Unit: semnare HMAC (vector din documentație), parser CSV (fixture).
2. Integrare cu credențiale reale: `getAdvertisers()` → validare autentificare;
   descărcare feed real → descoperirea coloanelor CSV exacte și ajustarea mapării.
3. Rulare completă locală (`sync:now`) → verificare produse pe site-ul local.

## Migrare

Produsele actuale rămân; matching-ul pe slug le leagă de ofertele Profitshare la primul import,
iar `part_no` se completează din feed. Forit rămâne activ doar dacă e între advertiserii acceptați.
