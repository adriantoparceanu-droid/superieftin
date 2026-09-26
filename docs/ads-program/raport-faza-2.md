# Raport Faza 2 — tracking conversii (predare pentru sesiunea nouă)

Data: 2026-09-26 · Branch: `ads/faza-2-tracking` (pornit din `main`, NU e pe producție)

> **Pentru sesiunea nouă:** coordonatorul deleagă — Faza 2 o face agentul **`tracking`**
> (`.claude/agents/tracking.md`), verificarea GDPR agentul **`policy-reviewer`**. Nu scrie
> coordonatorul codul direct (decizia proprietarului). Răspunsurile către proprietar: în română.

## Starea generală a proiectului (ce e deja pe producție, `main` = producție)

- Faza 0 ✅ — Google Ads API conectat (cont **276-008-6909**, fără MCC, acces **Basic**, API v25,
  fără developer token). `npm run ads:auth` / `ads:check` în `worker/`. Librăria: **REST direct**
  (`worker/src/ads/google-ads.ts`). Regula 4 = `validate_only` pe contul real (`ADS_ENV=test`).
- Faza 1 ✅ pe producție — banner cookies propriu + Consent Mode v2, pagini de încredere cu datele
  firmei, prag ±5% mediană, `/reduceri-reale/[categorie]`, redirecționări 301/410, fix-uri mobil.
  Re-audit policy-reviewer (`review/2026-09-26-faza-1-reaudit.md`): 4 blocante vechi rezolvate,
  2 blocante noi (N1 text consimțământ, N2 Cloudflare) **reparate și urcate** (consimțământ v2).
  **De făcut:** re-verificare restrânsă de `policy-reviewer` pe live (bannerul + /confidentialitate)
  → dacă PASS, **Poarta 1 închisă**. Recomandările R10–R19 din re-audit rămân deschise (neblocante).
- Livrat pe lângă faze (pe producție): click_id pe `/go` (`ad_clicks`, migrația 017), ofertele
  neconfirmate 3 zile ascunse + „indisponibil”/410 (din 27 oct), Admin → Magazine & surse (stare +
  pauză + Telegram către proprietar, migrația 018), mediana precalculată `offer_price_stats`
  (migrația 019, pagini reci ~1 s în loc de 40 s), mapare după denumire + „ignoră” +
  subcategoria „Componente PC & server” (migrația 020). Detalii în `CLAUDE.md`.

## Deciziile proprietarului pentru Faza 2 (2026-09-26)

1. **Schema `affiliate_conversions` aprobată** — migrația `db/migrations/021_affiliate_conversions.sql`
   (deja scrisă și comisă pe branch, aplicată DOAR local).
2. **Programare:** job **BullMQ în worker** (ca restul joburilor), după feed-sync-ul de dimineață.
3. **Pornire:** jobul automat rulează **doar `validate_only`** la început. Trimiterea reală o
   activează proprietarul (ADS_ENV=prod), după primele comisioane potrivite corect și după
   pornirea campaniilor.
4. Eveniment GA4: se păstrează `click_affiliate_link` (există în
   `web/src/components/analytics/AffiliateLink.tsx`), se extinde cu parametrii lipsă.
5. Fereastra de sync Profitshare: **90 de zile** (aprobarea vine după ~48–65 de zile).

## Ce e făcut pe branch

- `db/migrations/021_affiliate_conversions.sql` (comis).
- `web/src/lib/adclick.ts` — cookie `se_gclid` (90 zile, doar cu acord „Publicitate”),
  `idsFromSearch()`, `parseAdClickCookie()` (validare `[A-Za-z0-9_-]`).
- `web/src/lib/consent.ts` — `parseConsentCookie()` (folosibil pe server, pentru `/go`).

## Ce a rămas (agentul `tracking`, apoi `policy-reviewer`)

1. **Captare la aterizare** — componentă client montată în `app/layout.tsx`: cu acord → cookie
   `se_gclid`; fără acord → doar `sessionStorage` (`se_gclid_pending`), mutat în cookie dacă
   acordul vine în aceeași sesiune; la retragerea acordului → ștergere. Ascultă
   `CONSENT_CHANGE_EVENT` din `lib/consent.ts`.
2. **`/go/[offerId]`** — citește `se_gclid` + `se_consent` (server, `parseConsentCookie`, ads=true)
   și scrie `gclid/gbraid/wbraid` + `has_ad_consent` în `ad_clicks` (coloanele există din 017).
3. **Worker:** `getCommissions()` în `worker/src/lib/profitshare.ts` (paginat, ultimele 90 zile;
   câmpuri: `order_id`, `order_status` pending/approved/canceled, `items_commision` = sume
   separate prin `|`, `hash` = click_id; filtrul API `click_hash` e IGNORAT → potrivire locală).
4. **`tracking:sync`** (script + job BullMQ): upsert `affiliate_conversions` → potrivire cu
   `ad_clicks` → upload `customers/{id}:uploadClickConversions` (orderId = order_id, valoare RON,
   `consent.adUserData=GRANTED`, partialFailure) → retrageri `uploadConversionAdjustments`
   (RETRACTION) pentru comisioanele devenite canceled. Plan implicit; `--confirm` trimite;
   `ADS_ENV=test` → validate_only (nu setează `uploaded_at`). Idempotent.
5. **Acțiunea de conversie „Comision Profitshare”** (UPLOAD_CLICKS, PURCHASE, principală) —
   creare prin API: întâi validate_only; crearea reală cere acordul explicit al proprietarului.
6. **GA4:** extinde `click_affiliate_link` cu `product_id`, `discount_pct`; scrie
   `docs/ads-program/ghid-setari-ga4.md` (eveniment cheie, dimensiuni personalizate, filtru trafic
   intern, legătura GA4 ↔ Google Ads, import ca conversie SECUNDARĂ).
7. **Politici:** în `/cookies` înlocuiește rândul „gclid/gbraid/wbraid” cu cookie-ul real
   `se_gclid` (recomandarea R10 din re-audit); verifică `/confidentialitate`.
8. **Test end-to-end cu validate_only** (POARTA 2): click cu gclid inventat → comision fixture →
   potrivire → upload validat; Google respinge gclid-ul inventat — eroarea specifică dovedește că
   cererea e corectă. NU se încarcă conversii false în contul real.
9. `policy-reviewer` pe partea GDPR → **Poarta 2**. Deploy doar la „da” explicit (`/deploy`);
   migrația 021 cere rebuild `migrate` înainte (vezi `.claude/commands/deploy.md`).

## Alte lucruri deschise (nu țin de Faza 2)

- **CITGrup / ForIT:** feed-uri oprite de Profitshare — ascunse automat, revin singure când
  Profitshare le reactivează. Starea se vede în Admin → Magazine & surse (+ Telegram).
- **evomag „Pc EvoMag”:** feed fără categorie → proprietarul regenerează feed-ul în 2Performant
  cu coloanele category/brand/product_id/gtin, sau mapează din Admin → Mapare → „Vezi ce conține”.
- **eMAG:** profilul Playwright stă în `/var/folders/...` (macOS îl poate goli → captcha din nou).
  Propus: `EMAG_PW_PROFILE=~/.superieftin/emag-pw-profile` în `.env` + o rezolvare de captcha
  (`EMAG_PW_HEADED=1 npm run scrape-emag:now`). Nedecis.
- **Faza 3:** pe producție reducerile reale sunt azi în principal la telefoane, încărcătoare,
  folii, baterii externe, televizoare (evomag). market-research pornește de la datele reale
  (acces Basic → Keyword Planner disponibil), nu de la șablonul „Laptopuri”.
- Nimic nu e împins pe GitHub (proprietarul n-a cerut push).
