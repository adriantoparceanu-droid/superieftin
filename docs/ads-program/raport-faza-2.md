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

## Ce e făcut pe branch (actualizat 2026-09-26, agentul `tracking`)

| # | Punct | Stare | Unde |
|---|---|---|---|
| – | Schema `affiliate_conversions` | ✅ (migrația 021, aplicată doar local) | `db/migrations/021_affiliate_conversions.sql` |
| 1 | Captare gclid/gbraid/wbraid la aterizare | ✅ testat în browser (Playwright, 4 scenarii) | `web/src/components/consent/AdClickCapture.tsx`, `web/src/lib/adclick.ts`, `app/layout.tsx` |
| 2 | `/go` scrie ID-urile Google + `has_ad_consent` | ✅ testat local (5 scenarii curl) | `web/src/app/go/[offerId]/route.ts` |
| 3 | `getCommissions()` + parsare | ✅ apel real (11 comisioane, 90 zile; filtrul de dată funcționează) | `worker/src/lib/profitshare.ts` |
| 4 | `tracking:sync` + job BullMQ | ✅ plan pe date reale; job doar validate_only | `worker/src/tracking/`, `worker/src/index.ts` |
| 5 | Acțiunea „Comision Profitshare” | ✅ cod + **validate_only trecut**; ❌ NEcreată (cere acordul tău) | `worker/src/ads/conversion-action.ts` |
| 6 | GA4 `click_affiliate_link` + ghid | ✅ | `AffiliateLink.tsx`, `docs/ads-program/ghid-setari-ga4.md` |
| 7 | `/cookies` + `/confidentialitate` | ✅ texte după codul real | `web/src/app/cookies/`, `web/src/app/confidentialitate/` |
| 8 | Test E2E validate_only | ⚠️ parțial — upload-ul cere pașii tăi de mai jos | `npm run tracking:e2e` |

### Descoperire importantă: upload-ul se face prin Data Manager API, nu prin Google Ads API

Test real (validate_only, 2026-09-26) pe `customers:uploadClickConversions`:
`notAllowlistedError.CUSTOMER_NOT_ALLOWLISTED_FOR_THIS_FEATURE` — „New integrations for uploading
click conversions should use the Data Manager API. Usage of ConversionUploadService.UploadClickConversions
is limited to existing users.” Din 15 iunie 2026 Google a rezervat serviciul integrărilor care
au mai trimis conversii. Nu e o decizie de arhitectură deschisă: e singura cale.
- **Upload** → Data Manager API (`datamanager.googleapis.com/v1/events:ingest`), REST direct,
  același client OAuth, `validateOnly` suportat, doar gclid/gbraid/wbraid (fără date personale).
- **Retrageri** → rămân pe Google Ads API `uploadConversionAdjustments` (funcționează — testat).
- Consecință: refresh token-ul trebuie să includă scope-ul `datamanager` (vezi „Ce trebuie să faci”).

### Rezultat test E2E (Poarta 2, validate_only, tranzacție anulată)

Click cu gclid inventat (cu acord) → 2 comisioane fixture → potrivite 2/2 → plan: 1 de trimis
(15,40 RON = 10,00 + 5,40, pending) + 1 de retras (anulat după trimitere) → validare:
- **Retragere:** `conversionAdjustmentUploadError.CONVERSION_NOT_FOUND` — eroarea specifică
  „conversia nu există” ⇒ autentificare, format, cont și cerere corecte. ✅
- **Upload:** `HTTP 403 ACCESS_TOKEN_SCOPE_INSUFFICIENT` — tokenul actual are doar scope `adwords`.
  Eroare de autorizare, NU de format ⇒ testul upload-ului se reia după pașii tăi. ⏸
- `uploaded_at` / `retracted_at` neschimbate după validare (corect); baza locală neatinsă.
- **De știut:** Data Manager verifică clickul (gclid) ASINCRON, după primire; la `validateOnly`
  documentația spune că diagnosticul NU e disponibil. Deci pentru upload e posibil ca validarea să
  răspundă simplu „OK” (format corect) în loc de „click inexistent”. Criteriul Poarta 2 pentru
  upload devine: **răspuns 200 la validateOnly** (de confirmat de proprietar).

## Ce trebuie să faci tu (proprietarul)

1. **Activează „Data Manager API”** în proiectul Google Cloud care deține OAuth client-ul
   (console.cloud.google.com → APIs & Services → Library → „Data Manager API” → Enable).
2. **Regenerează refresh token-ul** cu ambele permisiuni: `cd worker && npm run ads:auth`
   (te loghezi în browser, bifezi ambele permisiuni — Google Ads și Data Manager; tokenul se scrie
   singur în `.env`, nu se afișează). Dacă ecranul de consimțământ OAuth e în „Testing”, scope-ul
   nou poate trebui adăugat și la OAuth consent screen → Data access.
3. **Aprobă crearea acțiunii „Comision Profitshare”** (principală, Cumpărare, Upload clicks,
   numărare „Toate”, fereastră 90 zile, valoare din fiecare conversie, RON). Comanda, rulată de tine
   sau la cererea ta explicită:
   `ADS_ENV=prod npm run ads:conversion-action -- --confirm --prod` (din `worker/`; ADS_ENV
   doar pentru această comandă, `.env` rămâne pe test). Pune ID-ul afișat în `.env` →
   `GOOGLE_ADS_CONVERSION_ACTION_ID=` (local și pe VPS).
4. După 1–3: `npm run tracking:e2e` → upload-ul trebuie să treacă validarea (200 sau eroare despre gclid).
5. **Acțiunea existentă „Achiziție”** (Pagină web, PRINCIPALĂ, Cumpărare) — nu vindem direct, deci
   nu se va declanșa corect; recomand s-o treci pe **Secundară** înainte de campanii (altfel Google
   are două conversii principale de cumpărare).
6. Pașii GA4 din `docs/ads-program/ghid-setari-ga4.md` (după deploy).

## De confirmat de proprietar (am ales varianta conservatoare)

- **Jobul automat** `tracking-sync` (06:30, după feed-sync 04:00 și backfill 05:30): DOAR
  validate_only. Trimiterea reală = `TRACKING_SYNC_AUTO_SEND=1` **și** `ADS_ENV=prod` în `.env`.
- **Valoarea schimbată după trimitere** (ex. comandă aprobată parțial): doar se loghează, nu
  trimitem automat ajustare RESTATEMENT. Se poate adăuga dacă vrei valori exacte în Google Ads.
- **Comenzile fără dată de fus orar**: `order_date` din Profitshare e tratat ca ora României
  (logic, dar nedocumentat de Profitshare).
- **Statusuri necunoscute** (altele decât pending/approved/canceled/paid) → tratate ca `pending` și
  semnalate în log.
- **Acordul la momentul clickului**: se trimite la Google doar dacă clickul `/go` s-a făcut cu acord.
  Dacă vizitatorul își retrage acordul după click, dar înainte de sync, conversia tot pleacă
  (prelucrarea a fost legală la momentul colectării). Variantă mai strictă posibilă — decizia ta /
  a `policy-reviewer`.
- **`sessionStorage` înainte de acord**: cerut explicit în specificație; e tot „stocare pe
  dispozitiv” (ePrivacy art. 5(3)), deși nu pleacă nicăieri și dispare la închiderea filei.
  Alternativa mai strictă: doar o variabilă în memoria JS (se pierde la reîncărcarea paginii).
  De verificat de `policy-reviewer`; am descris-o transparent în `/cookies`.
- **Retenție:** `tracking:sync` șterge gclid/gbraid/wbraid din `ad_clicks` după 90 de zile de la click
  (altfel textul „cel mult 90 de zile” din `/confidentialitate` n-ar fi adevărat pentru server).

## Ce a rămas

- Pașii 1–4 de mai sus (tu), apoi reluarea E2E pentru upload.
- `policy-reviewer` pe partea GDPR (captare, `/go`, `/cookies`, `/confidentialitate`) → **Poarta 2**.
- Deploy doar la „da” explicit (`/deploy`): migrația 021 cere rebuild `migrate`; pe VPS în `.env`:
  `GOOGLE_ADS_*` (inclusiv tokenul nou și `GOOGLE_ADS_CONVERSION_ACTION_ID`), `ADS_ENV=test`.
  Worker-ul are fișiere noi (`src/tracking/`, `src/ads/`) — fără dependențe npm noi.
- 2Performant (evomag, `&st=`): comisioanele lor nu sunt încă citite de `tracking:sync`.
- Lint web: 3 erori PREEXISTENTE în fișiere neatinse (`admin/(protected)/bannere/page.tsx`,
  `components/consent/CookieBanner.tsx`) — pentru `site-dev`.

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
