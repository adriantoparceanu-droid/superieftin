# Statistici GA4 în admin — design

Data: 2026-09-28 · Status: aprobat de proprietar · Branch: `feat/admin-statistici`

## Scop

Trafic general pe site vizibil în admin, fără să intri în GA4: vizitatori, surse de trafic,
pagini, clickuri spre magazine, dispozitive, noi vs. reveniți. Lângă cifrele GA4 punem
clickurile reale din baza noastră de date, pentru că GA4 vede doar vizitatorii care au acceptat
cookie-urile de analiză.

## Decizii

| Întrebare | Alegere | De ce |
|---|---|---|
| Cum ajung datele în admin | Workerul le salvează zilnic în Postgres | pagină rapidă, merge când Google e jos, istoric la noi, se unește cu clickurile/comisioanele (același model ca `offer_price_stats`) |
| Autentificare GA4 | Cont de serviciu, rol Viewer, scope `analytics.readonly` | nu expiră, separat de tokenul Google Ads, doar citire |
| Bibliotecă | Niciuna nouă: JWT semnat cu `crypto` din Node + `fetch` | la fel ca integrarea Google Ads existentă |

## Arhitectură și flux de date

- **Sursa**: GA4 Data API `properties/{id}:runReport`.
- **Configurare** (`.env`): `GA4_PROPERTY_ID` (numeric), `GA4_SERVICE_ACCOUNT_JSON` (cheia JSON a contului de serviciu).
- **Job BullMQ `ga4-sync`** (worker), cron `GA4_SYNC_CRON`, implicit `15 6 * * *` (înainte de `tracking-sync` 06:30),
  plus buton „Actualizează acum” în admin.
  - Fiecare rulare aduce **ultimele 3 zile** (GA4 corectează datele până la 48 h) și face upsert.
  - Prima rulare (tabel gol) aduce **ultimele 90 de zile**.
  - La eroare nu șterge nimic; după 3 eșecuri consecutive → Telegram către `TELEGRAM_ADMIN_CHAT_ID`.
- **Migrația `025_ga4_stats.sql`**:
  - `ga4_daily` — un rând pe zi: `users`, `new_users`, `sessions`, `engaged_sessions`, `page_views`,
    `avg_engagement_seconds`, `affiliate_clicks`, `synced_at`.
  - `ga4_daily_breakdown` — (`day`, `kind`, `key`) cu `sessions`, `users`, `page_views`, `affiliate_clicks`.
    `kind` ∈ `source` (sursă / mediu), `page`, `landing`, `device`, `retailer`, `product` (după `product_id`), `category`.
    Doar **top 50 pe tip și pe zi**.
  - `ga4_sync_state` — ultima rulare reușită, ultima eroare, numărul de eșecuri consecutive.
- **Adminul** citește doar din Postgres; clickurile reale vin din `click_events` pe aceeași perioadă.

## Pagina `/admin/statistici`

- În meniu: „Statistici”, sub „Dashboard”.
- Perioadă: 7 / 30 / 90 de zile (implicit 30), fiecare cifră cu variația față de perioada anterioară de aceeași lungime.
- Carduri: Utilizatori (cu % noi), Sesiuni, Afișări de pagină, Clickuri spre magazine (GA4),
  Clickuri reale (DB) cu „GA4 vede ~X%”, Rată de click (clickuri afiliate / sesiuni).
- Grafic pe zile (`recharts`): sesiuni + clickuri spre magazine.
- Tabele top 10 (+ „restul”): surse de trafic, pagini de intrare (cu rata de click), pagini vizitate,
  magazine (GA4 vs. DB), produse, categorii, dispozitive.
- Subsol: nota despre consimțământ, „actualizat ultima dată la …”, butonul „Actualizează acum”.
- `/admin` primește un card mic (utilizatori + clickuri, 7 zile) cu link spre „Statistici”.
- Fără configurare → pagina arată pașii de configurare, nu erori.

## Comenzi noi

- `cd worker && npm run ga4:check` — test de conexiune (nu scrie nimic).
- `cd worker && npm run ga4:sync:now` — sincronizare imediată.

## Testare

- Teste unitare (`node --test`): transformarea răspunsului GA4 → rânduri DB, limitarea top 50,
  calculul perioadei anterioare.
- Local cu date reale: `ga4:sync:now` → `localhost:3000/admin/statistici`.
- Deploy doar la cerere (`/deploy`); migrație nouă → întâi `docker compose --profile tools build migrate`.

## Riscuri și limite

- Cifrele GA4 sunt subnumărate (consimțământ) — de aceea stau lângă clickurile reale din DB.
- Datele sunt de ieri, nu în timp real.
- Cota GA4 API: ~15 rapoarte/zi, mult sub limita gratuită.
- Confidențialitate: stocăm doar agregate, fără ID-uri de utilizator; niciun cookie nou →
  `/cookies` și `/confidentialitate` rămân neschimbate.
- Cheia contului de serviciu stă doar în `.env` (REGULI.md, regula 5) și poate doar să citească GA4.

## Extindere: cuvinte cheie (2026-09-28, migrația 026)

GA4 Data API nu expune datele Search Console (`organicGoogleSearchQuery` e „not a valid dimension”;
dimensiunile organice dau „(not provided)”), iar dimensiunile Google Ads din GA4 erau goale.
Aprobat de proprietar: două surse citite direct, în același job `ga4-sync`:

- **Organic**: Search Console Search Analytics API (zi × căutare × pagină), același cont de serviciu
  (`webmasters.readonly`, utilizator „Restricționat”) → `gsc_daily`, top 500/zi, rescrie ultimele 5 zile
  (întârziere 2–3 zile), 90 la prima rulare.
- **Reclame**: Google Ads `search_term_view` (GAQL, doar citire) → `ads_search_terms`, rescrie 7 zile.
- O sursă care eșuează devine avertisment în `ga4_sync_state.warnings`, fără să anuleze GA4.
- Admin: secțiunea „Cuvinte cheie” — Organic (clickuri, afișări, CTR, poziție medie ponderată, pagina
  principală) și Reclame (clickuri, afișări, cost, CPC, ⚠ dacă termenul e deja organic în top 3).
