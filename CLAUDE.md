# Superieftin.ro

Site de comparare prețuri / afiliere (România). Monorepo cu trei părți:

- `web/` — Next.js 16 (React 19, Tailwind 4). Site public + admin (`/admin`, rute protejate în `web/src/app/admin/(protected)/`). Acces DB direct prin `pg` (`web/src/lib/db.ts`), query-uri în `web/src/lib/queries.ts` și `web/src/lib/admin/`.
- `worker/` — procese de fundal (tsx, ESM): scrapere (`src/scrapers/`), importere de feed-uri afiliate (`src/importers/` — Profitshare, 2Performant), workeri BullMQ (`src/workers/` — sync, alerte preț, bot Telegram), migrații (`src/migrate.ts`).
- `db/migrations/` — SQL numerotat secvențial (`NNN_nume.sql`). Se aplică idempotent de `worker/src/migrate.ts` (tabela `schema_migrations`).

Infrastructură: PostgreSQL 16 + Redis 7, orchestrate cu `docker-compose.yml` în producție. Variabilele de mediu stau în `.env` la rădăcină (negitat).

## Comenzi

```bash
# Web — dev local MEREU pe portul 3000 (next dev); dacă 3000 e ocupat, eliberează-l, nu schimba portul
cd web && npm run dev

# Worker — local (citește .env din rădăcină)
cd worker && npm run dev            # loop complet
cd worker && npm run sync:now       # sync feed-uri imediat
cd worker && npm run scrape-emag:now   # DOAR local, cu EMAG_FETCH=playwright în .env (vezi mai jos)
cd worker && npm run catalog:now    # improspateaza catalogul de categorii eMAG (sitemap)
cd worker && npm test               # teste unitare (node --test via tsx)
cd worker && npm run tracking:sync  # comisioane Profitshare → Google Ads: plan implicit; -- --confirm = validate_only (ADS_ENV=test)
cd worker && npm run tracking:e2e   # test Poarta 2 (validate_only, tranzacție anulată)
cd worker && npm run ads:validate   # campanii YAML (ads/campaigns/*.yaml): limite, guardrails, pagini live (200, stoc, „Reducere reală”, %)
cd worker && npm run ads:plan       # diferențe YAML ↔ cont Google Ads — DOAR citire
cd worker && npm run ads:apply      # implicit = plan; -- --confirm = validate_only (ADS_ENV=test); -- --confirm --prod = scriere reală (ADS_ENV=prod)

# Scraping eMAG → producție (WAF-ul eMAG blochează IP-ul VPS/datacenter cu 511):
#   1. în .env local: EMAG_FETCH=playwright   (o dată: cd worker && npx playwright install chromium)
#   2. cd worker && npm run scrape-emag:now    # rulează LOCAL, browser real trece de WAF
#   3. ./sync-emag-to-live.sh                  # urcă DOAR ofertele eMAG pe prod (upsert, fără truncate)
# Automat: LaunchAgent 'ro.superieftin.emag-scrape' (~/Library/LaunchAgents) rulează zilnic
#   la 07:00 wrapper-ul ./emag-scrape-sync.sh (scrape + sync). Log: ~/Library/Logs/superieftin-emag.log
#   Comenzi: launchctl {bootout|bootstrap} gui/$(id -u) <plist>; test acum: launchctl kickstart -k gui/$(id -u)/ro.superieftin.emag-scrape

# Migrații — local: prin worker/src/migrate.ts (citește db/migrations/ de pe disc)
# Producție: migrațiile sunt BAKED în imagine (COPY db ./db). La deploy cu migrații noi,
# reconstruiește ÎNTÂI imaginea migrate (nu e în `build web worker`), apoi rulează:
#   docker compose --profile tools build migrate
#   docker compose --profile tools run --rm migrate

# Curățenie VPS: cronul userului superieftin rulează duminica 04:00 ./cleanup-vps.sh
#   (copie locală de referință; scriptul instalat pe server e /home/superieftin/app/cleanup.sh) —
#   recreează containerul web (golește cache-ul Next.js/ISR care crește nelimitat în stratul
#   scriptibil, ~2.4GB acumulați în 15h la instalare) și rulează `docker image prune -f`
#   (doar imagini dangling). Nu atinge alte stack-uri de pe același VPS (ex. pricetoday).
#   Log: /home/superieftin/logs/cleanup.log. Rulare manuală: ssh superieftin@13.140.163.156 /home/superieftin/app/cleanup.sh
```

## Reguli critice

- **Deploy DOAR la comandă explicită a utilizatorului**, prin comanda `/deploy` (vezi `.claude/commands/deploy.md`). Niciodată deploy automat după o modificare. Flux: modifici local → testezi local → utilizatorul cere deploy.
- **Scraping-ul se testează întâi local**, nu direct pe VPS.
- **Domeniul canonic e `https://www.superieftin.ro`** (cu www). `NEXT_PUBLIC_SITE_URL` se setează din `next.config.ts` și se inline-uiește la build (arg de build în compose, nu env de runtime). Sitemap-ul e force-dynamic.
- **Codul Profitshare funcționează DOAR pe domeniul aprobat (producție)** — nu testa integrarea pe local/staging și nu raporta ca bug lipsa lui pe local.
- **La deploy cu dependențe noi**: sincronizează și `package.json` + `package-lock.json`, nu doar `src/`. Dockerfile-urile și compose se rsync-uiesc la căi explicite (vezi `/deploy`).
- **Migrații noi**: fișier nou `db/migrations/NNN_nume.sql` (numărul următor, nu modifica migrații aplicate); pe producție rulează prin serviciul `migrate` din compose.

## Taxonomie & mapare produse

- **Meniul e pe 2 niveluri**, condus de arborele din `categories` (părinte → subcategorii); `menu_items` oglindește categoriile. Trei părinți: Telefoane & Accesorii, Laptopuri & Calculatoare, TV & Audio.
- **Condiția produsului (Refurbished / Second Hand) e TAG, nu categorie** — filtrabilă transversal în orice categorie.
- **Mapare după denumire** (`name_category_rules`, migrația 020; Admin → Mapare → „Vezi ce conține”): pentru feed-uri fără categorie sau amestecate — „denumirea conține X (cuvânt întreg, fără diacritice) → categoria Y” sau „ignoră” (nu se mai importă). Aplicată la import DUPĂ `feed_category_map`, în `loadFeedRules` (`worker/src/lib/nameRules.ts`; aceeași potrivire în `web/src/lib/admin/nameMatch.ts` — modifică-le împreună). La salvare se aplică imediat pe produsele nemapate existente.
- Maparea feed → categorie: `feed_category_map` (regula specifică retailerului bate regula globală cu `retailer_id NULL`), aplicată la ingest prin `loadFeedRules`.
- **Bulk CITGrup**: pune servere/desktop/laptop/workstation/monitoare amestecate sub feed_category generice (`refurbished`, `second-hand`, `touchscreen-second-hand`). Se împart pe tip după denumire de funcția SQL `reclassify_catchall_products()` (migrația 015), apelată automat la finalul fiecărui feed-sync.
- **eMAG mapează direct**: în admin `scraper-categorii` alegi categoria de site țintă; acțiunea creează regula `feed_category_map` (retailer emag, token `emag:<path>`) → produsele scanate apar mapate de la prima rulare, fără mapare manuală. (Categoriile seed din migrația 013 — telefoane-mobile/laptopuri/televizoare — folosesc `feed_category` generic care se leagă de regulile globale existente, nu tokenul `emag:`.)
- **eMAG e scanabil DOAR local**: WAF-ul AWS al eMAG (CloudFront 511 + captcha JS) blochează orice IP de datacenter (VPS) și uneltele non-browser (curl/wget/axios prins de rate-limit). Soluția: fetcher **Playwright** (browser real, rezolvă challenge-ul JS) controlat de `EMAG_FETCH=playwright` în `.env` local (`emag.ts`; `http`/axios e default, folosit degeaba pe prod). Playwright e devDependency, browserul NU se descarcă în imaginea de prod (`PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` în worker/Dockerfile). Fluxul: scrape local → `sync-emag-to-live.sh` (upsert doar eMAG, fără truncate — restul retailerilor vin din feed-uri direct pe VPS; sync-ul șterge și ofertele eMAG de pe prod care nu mai sunt în setul local = oglindire). **Pruning** (scanarea vede doar câteva pagini, nu tot catalogul): `ingestScraper` marchează ofertele scraperului nevăzute de `STALE_DAYS=3` fără stoc (ca la feed-uri) și le șterge după `SCRAPER_OFFER_TTL_DAYS` (implicit 30) — rulează doar dacă scanarea a adus produse (un blocaj WAF nu golește datele). Feed-urile au deja marcarea stale proprie (`STALE_OFFER_DAYS=3` în `sync.worker.ts`), deci NU necesită pruning separat. Jobul cron `emag-scrape` de pe prod rulează degeaba (WAF) — inofensiv. **Profitshare NU oferă feed de produse pentru eMAG** (`affiliate-products` → „don't offer a products feed") — scraping-ul e singura sursă.
- **Cache gotcha**: modificarea directă în DB a categoriilor/meniului NU se reflectă în `unstable_cache` nici prin `revalidateTag`. Dev: șterge tot `.next` și repornește. Prod: la deploy cu rebuild de cod containerul web se reconstruiește oricum; la migrație DB-only rulează `docker compose up -d --force-recreate web`.

## Convenții

- Citește `web/AGENTS.md` înainte de a scrie cod Next.js — versiunea din proiect are breaking changes față de ce știi; docs în `node_modules/next/dist/docs/`.
- Comentariile din cod și mesajele de commit sunt în română (stil: `feat(scope): descriere`).
- Scraper nou: modul în `worker/src/scrapers/` care produce obiecte conform `types.ts`, ingerate prin `ingest.ts`; categoriile scraper-ului se administrează din admin (`scraper-categorii`), care alege dintr-un catalog populat de worker din sitemap-ul sursei (`available_scraper_categories`, refresh la fiecare scrape + jobul BullMQ `catalog-refresh` de la butonul din admin).
- **SubID pe clickuri**: `/go/[offerId]` generează un `click_id` per click, îl salvează în `ad_clicks` (migrația 017; supraviețuiește ștergerii ofertei, spre deosebire de `click_events`) și îl lipește pe linkul afiliat — Profitshare `&hash=`, 2Performant `&st=` (`web/src/lib/subid.ts`). Rețeaua se deduce din host-ul linkului, nu din `offers.affiliate_network` (NULL pe multe oferte din feed). Comisioanele Profitshare întorc valoarea în câmpul `hash`; filtrul API `filters[click_hash]` e ignorat de server → potrivirea se face local.
- **Tracking conversii (Faza 2)**: `AdClickCapture` (layout) pune gclid/gbraid/wbraid din URL în cookie-ul `se_gclid` (90 zile) DOAR cu acord „Publicitate”; până la alegere ID-ul stă DOAR într-o variabilă JS de modul (nimic în cookie/sessionStorage/localStorage — Poarta 2 GDPR; se pierde la reîncărcare) și se mută în cookie la acord; la refuz explicit nu se păstrează nimic. La retragerea acordului, `AdClickCapture` trimite `sendBeacon` cu ID-ul din cookie la `POST /api/consent/withdraw` (rate limit în memorie, `lib/rate-limit.ts`) → golește ID-urile și pune `has_ad_consent=false` în `ad_clicks`. `/go` re-verifică pe server `se_consent` înainte să scrie ID-urile în `ad_clicks` + `ad_click_at` (momentul clickului pe reclamă, din `ts`-ul cookie-ului; migrația 022). `ad_personalization` e mereu `denied` (Consent Mode și Data Manager) — bannerul nu cere acord pentru personalizare. `tracking:sync` (`worker/src/tracking/`, job BullMQ `tracking-sync` 06:30) upsert-ează `affiliate_conversions`, potrivește după `hash`=click_id, **urcă prin Data Manager API** (`ads/data-manager.ts` — `uploadClickConversions` din Google Ads API e blocat pentru integrări noi: `CUSTOMER_NOT_ALLOWLISTED_FOR_THIS_FEATURE`) și retrage anulările prin `uploadConversionAdjustments` (orderId = order_id Profitshare). Jobul rulează DOAR validate_only până la `TRACKING_SYNC_AUTO_SEND=1` + `ADS_ENV=prod`. Șterge gclid-urile din `ad_clicks` la 90 de zile de la `COALESCE(ad_click_at, created_at)` (promis în `/confidentialitate`), în `finally` — rulează și când Profitshare/Google eșuează, și în modul `plan`; aceeași fereastră de 90 de zile se aplică la upload. Tokenul OAuth trebuie să aibă scope `adwords` + `datamanager` (`npm run ads:auth`); acțiunea de conversie: `npm run ads:conversion-action` → `GOOGLE_ADS_CONVERSION_ACTION_ID`.
- **Campanii Google Ads ca și cod (Faza 3)**: `ads/campaigns/<nume>.yaml` (fișierele cu `_` sunt ignorate), cod în `worker/src/ads/campaigns/` (parser: pachetul `yaml`, devDependency — păstrează comentariile când `ads:apply` scrie ID-urile înapoi). `ads:apply` trimite tot într-o singură cerere atomică `googleAds:mutate` (ID-uri temporare); campaniile/grupurile/anunțurile noi = PAUSED, cuvintele cheie și extensiile ENABLED (nu rulează sub un grup PAUSED); nu schimbă niciodată statusul campaniilor existente; ce dispare din YAML → pauză (cuvinte/grupuri/anunțuri) sau eliminare (negative/extensii). Conversia campaniilor = obiectivul personalizat „SE | Comision Profitshare”. **Poarta policy-reviewer**: scrierea reală cere `ads/campaigns/.review/<nume>.pass` (YAML: `verdict: PASS`, `date` ISO, `sha256` = „hash review” afișat de `ads:validate`, max 7 zile; hash-ul ignoră `id`/`budget_id`) — `review.ts`. În `ADS_ENV=test` lipsa PASS-ului e doar avertisment (nu se scrie nimic). `validate_only` NU rulează revizuirea editorială Google (ex. „!!!” trece) — de aceea verificările de stil din `ads:validate` + policy-reviewer.
- **Consimțământ cookies**: banner propriu (`components/consent/`) + Consent Mode v2 (`lib/consent.ts`; default `denied` rulat `beforeInteractive` înainte de gtag). Orice tag/cookie nou de marketing se condiționează de `hasAdConsent()`/`hasAnalyticsConsent()` și se adaugă în tabelul din `/cookies` + `/confidentialitate` (textele descriu ce face REAL codul).
- **Oferte dispărute (safeguard, 2026-09-26)**: o ofertă neconfirmată de **3 zile** în niciun feed/scanare devine „fără stoc” pentru TOȚI retailerii (`worker/src/lib/stale.ts`, rulat în `runFeedSync` înainte de snapshot — independent de reușita feed-ului). Web (`lib/availability.ts`, aceeași valoare): pagina de produs arată doar ofertele disponibile; fără niciuna → „indisponibil”, `noindex`, scos din sitemap; `/go` la o ofertă indisponibilă trimite înapoi pe `/p/`; după **30 de zile** fără ofertă `src/proxy.ts` răspunde **410** (activ abia de la `PRODUCT_GONE_FROM` = 27 oct 2026 — perioadă de grație la lansare). Nimic nu se șterge — oferta revine singură când reapare în feed.
- **Mediana precalculată** (`offer_price_stats`, migrația 019): site-ul NU mai agregă `price_history` pe loc (~3 s CPU/pagină → CPU saturat la valuri de roboți). Workerul o recalculează (`worker/src/lib/price-stats.ts`) după snapshot (deci și după feed-sync), price-check, import manual și scanare. Query nou care are nevoie de mediană → `JOIN offer_price_stats`, nu `PERCENTILE_CONT` pe istoric.
- **Admin → Magazine & surse** (`/admin/magazine`, migrația 018): stare per magazin calculată zilnic la finalul `runFeedSync` (`worker/src/lib/retailer-status.ts` → `retailers.source_state/source_reason`; `feed_syncs.retailer_id` leagă sincronizarea de magazin). La schimbare de stare → Telegram către `TELEGRAM_ADMIN_CHAT_ID`. **Pauza** = `retailers.paused_at` (NU `is_active`, pe care `upsertRetailer` îl resetează la fiecare sync) și ascunde ofertele prin `OFFER_AVAILABLE_SQL`, folosit în TOATE query-urile publice. Bandou în dashboard pentru magazine blocate >48h.
- **URL-uri vechi** (WooCommerce + slug-uri de categorii redenumite): `lib/legacy-urls.ts` + `lib/legacy-map.ts` (harta, importată și de `next.config.ts` → `redirects`). 308 doar spre un echivalent real, altfel **410** — nu redirecționa în masă spre homepage (soft 404). La redenumirea unui slug de categorie, adaugă-l în `RENAMED_CATEGORIES`.
- **Datele firmei** (Contact, politici) stau într-un singur loc: `web/src/lib/company.ts`; valorile `null` apar pe site ca `[DE COMPLETAT: …]`.
- Cererile către eMAG merg DOAR prin worker, cu headerele din `emag.ts`/`emag-catalog.ts` (alt fingerprint, ex. `Accept-Encoding` cu `br`, declanșează captcha WAF; la 511/429 ne retragem, nu insistăm).

## Întreținerea acestui fișier

După orice modificare structurală (scraper/importer nou, rută admin nouă, schimbare în fluxul de deploy sau migrații, convenție nouă), actualizează acest CLAUDE.md în același commit. Documentează doar ce nu se poate deduce din cod; fișierul trebuie să rămână scurt și adevărat — o informație veche e mai rea decât una lipsă.
@docs/ads-program/REGULI.md