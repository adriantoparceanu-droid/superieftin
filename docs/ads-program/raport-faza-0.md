# Raport Faza 0 — verificare

Data: 2026-09-26 · Branch: `ads/faza-0-verificare`
Stare: **parțial** — partea de afiliere + GA4 e gata; partea Google Ads așteaptă contul de
reclame și proiectul Google Cloud (punctele 4–5).

---

## 1. Cum se construiesc acum linkurile de afiliere

- Linkul afiliat se calculează **o singură dată, la ingest** (feed / scraper) și se salvează
  în `offers.affiliate_url`. Cod: `worker/src/lib/affiliate/` — `resolver.ts` alege, pe
  domeniu, rețeaua cu comisionul cel mai mare (Profitshare sau 2Performant).
- Formate:
  - Profitshare: `https://l.profitshare.ro/lps/{advHash}/{affHash}/?redirect={url}`
    (`worker/src/lib/profitshare.ts` → `buildAffiliateUrl`)
  - 2Performant: `https://event.2performant.com/events/click?ad_type=quicklink&aff_code=…&unique=…&redirect_to={url}`
    (`worker/src/lib/twoperformant.ts` → `buildQuicklink`)
- Clickul: `web/src/app/go/[offerId]/route.ts` citește `affiliate_url || url`, scrie în
  `click_events (offer_id, clicked_at)` și face redirect 302.

**Consecință pentru Faza 2:** subID-ul (click_id) nu trebuie pus la ingest, ci adăugat
în `/go/[offerId]` în momentul redirectului — un click_id unic per click.

Acoperire afiliere pe producție (azi):

| Retailer | Oferte | Profitshare | 2Performant |
|---|---:|---:|---:|
| CITGrup | 17.994 | 17.994 | – |
| Vegis *(exclus din reclame)* | 9.514 | 9.513 | – |
| ITGalaxy | 4.120 | 4.120 | – |
| evomag | 2.450 | – | 2.450 |
| ForIT | 1.794 | 1.794 | – |
| eMAG | 1.794 | 1.542 | – |
| Vexio | 79 | 78 | – |

~250 oferte eMAG nu au link afiliat → nu trebuie folosite ca destinație în reclame.

## 2. Parametru de tracking propriu (subID)

### Profitshare — ✅ acceptat în link (testat)
- Documentația oficială (API affiliate, secțiunea *Links*) descrie parametrul `hash`:
  `profitshare.ro/l/{id}/{hash}`. Apare înapoi în câmpul `hash` al comisioanelor.
- Noi folosim formatul `lps`. **Test real:** `l.profitshare.ro/lps/{adv}/{aff}/?redirect=URL&hash=VAL`
  → Profitshare face 303 către `app.profitshare.ro/l/{id}/VAL/?redirect=URL` — adică exact
  formatul documentat, cu hash-ul în path. Pagina răspunde 200.
  - Varianta cu hash ca segment de path în `lps` (`/lps/a/b/VAL/`) → **404**, nu o folosim.
- **Implementare propusă:** în `/go`, `affiliate_url + '&hash=' + click_id` (click_id doar
  `[a-z0-9]`, scurt, fără date personale).

### Profitshare — ⚠️ întoarcerea prin API: structura confirmată, valoarea încă nu
- Apel real `GET affiliate-commissions` (11 comisioane, iul–sep 2026): câmpul `hash` există
  în răspuns, dar e gol peste tot — normal, n-am trimis niciodată un hash.
- Filtrul documentat `filters[click_hash]` e acceptat, dar **ignorat** (un hash inexistent
  întoarce toate cele 11 comisioane) → potrivirea o facem noi, local, pe câmpul `hash`.
- **Confirmarea finală cere o conversie reală cu hash.** Propunere: în Faza 2, primul pas
  e să activăm doar `&hash=click_id` pe `/go` (fără nimic legat de Google), deploy, și
  așteptăm primele comenzi organice (volumul actual ~4–5 comenzi/lună). Dacă vrei mai
  repede: o comandă de test mică pe un magazin Profitshare, anulată ulterior.

### 2Performant (evomag) — ✅ documentat, netestat
- Quicklink-urile acceptă `&st=tag` (subtag), returnat prin API-ul de comisioane.
  De verificat în Faza 2 cu un apel real (credențialele există în `.env`).

## 3. Statusuri și întârzieri (date reale Profitshare)

| Status | Comenzi | Comision |
|---|---:|---:|
| pending | 6 | 514,81 RON |
| approved | 2 | 11,37 RON |
| canceled | 3 | – |

- Statusuri: `pending` → `approved` sau `canceled`. Pe comenzi cu mai multe produse,
  `items_status` e per produs, separat prin `|` (ex. `pending|pending|pending`).
- Câmpuri: `items_commision` = **suma** comisionului (RON) per produs;
  `items_commision_value` = **procentul** (0,5% – 9% în datele reale); `order_id` = ID unic
  Profitshare (îl folosim ca `order_id` la upload → idempotent).
- Întârziere până la aprobare: **~48–65 de zile** după comandă. Anulările vin repede (0–5 zile).
- Consecințe:
  - conversiile se trimit la Google ca `pending` (învățare rapidă), cu retragere la
    `canceled` (cum prevede deja agentul `tracking`);
  - fereastra de sync de 45 de zile din pachet e **prea scurtă** — aprobarea vine după
    ~65 de zile. Propun **90 de zile**.
- Moneda: RON (nu există câmp de monedă; toți advertiserii sunt din RO).

## 4. Rata de comision pe magazin / categorie
- Pe magazin: tabela `affiliate_advertisers.commission` = procentul maxim declarat
  (sincronizat din API). Pe comenzi reale apar procente diferite per produs → comisionul
  real pe categorie se poate calcula după ce avem volum (`items_commision_value`).
- Istoricul actual (11 comenzi, 10 eMAG) e prea mic pentru estimări pe categorie.
  market-research va porni cu procentele declarate, marcate „aproximativ”.

## 5. Google Ads API — ⏸ blocat
Necesită contul de reclame + proiectul Google Cloud (vezi `GHID-CONECTARE-GOOGLE-ADS.md`).
Scriptul de refresh token OAuth și testul de conexiune se fac după ce există OAuth client-ul
(altfel scriem cod netestabil). Variabile care lipsesc din `.env`:
`ADS_ENV`, `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`, `GOOGLE_ADS_REFRESH_TOKEN`,
`GOOGLE_ADS_LOGIN_CUSTOMER_ID`, `GOOGLE_ADS_CUSTOMER_ID_TEST`, `GOOGLE_ADS_CUSTOMER_ID_PROD`.
(`PROFITSHARE_API_USER/KEY` există deja și funcționează.)

## 6. Librăria Google Ads — DECIZIE PROPRIETAR (după ce avem contul)

| Variantă | Pro | Contra |
|---|---|---|
| **A. `google-ads-api`** (Node, comunitar) | TypeScript, același worker, API comod pentru campanii/rapoarte | Neoficial; trebuie verificat că merge fără developer token (schimbarea e din 9 sep 2026) |
| **B. REST direct** (`fetch` + OAuth) | Zero dependențe, oficial, sigur compatibil cu noul model de acces | Mai mult cod pentru crearea campaniilor (mutate-uri verbose) |
| **C. Librăria oficială Python** | Oficială, actualizată prima | Al doilea limbaj/runtime în proiect, container separat |

Recomandare: **A dacă testul fără developer token trece, altfel B**. Tot restul
worker-ului e TypeScript; C nu se justifică pentru volumul nostru.

## 7. GA4 acum
- `web/src/components/analytics/GoogleAnalytics.tsx`: gtag încărcat doar în producție,
  `afterInteractive`, **fără Consent Mode** → trebuie adăugat `consent default = denied`
  înaintea lui (Faza 1, primul punct).
- Clickurile `/go/` au deja un eveniment: `click_affiliate_link`
  (`components/analytics/AffiliateLink.tsx`) cu `product_name`, `merchant_name`, `price`,
  `category`. Pachetul cere `affiliate_click` cu `store`, `product_id`, `category`, `price`,
  `discount_pct`. **Propun să păstrăm numele existent** (are deja istoric în GA4) și să
  adăugăm doar parametrii lipsă (`product_id`, `discount_pct`) — confirmi?
- Linkul are `target=_blank`, deci evenimentul nu se pierde la navigare.

## 8. Alte constatări pentru Faza 2
- `click_events` are `ON DELETE CASCADE` pe `offers`. Ofertele eMAG se șterg după 30 de zile
  (pruning), iar comisioanele se aprobă după ~65 → **`ad_clicks` nu trebuie să depindă de
  existența ofertei** (FK `ON DELETE SET NULL` + copie a datelor necesare: retailer,
  produs, rețea).
- Tabelele noi → migrația `db/migrations/017_…sql` (fără ORM, `pg` direct).
- `tracking:sync` → job BullMQ repetitiv în worker (ca restul), nu cron de sistem.

---

## POARTA 0 — ce aștept de la tine
1. **Conturi Google:** contul de reclame + proiect Cloud + OAuth client (ghidul, pașii 1–6).
   Când le ai, reluăm punctele 5–6 (script token + test conexiune).
2. **Confirmi** metoda subID (`&hash=click_id` în `/go`) și ideea de a o activa devreme,
   separat, ca să vedem hash-ul întors pe o comandă reală?
3. **Confirmi** fereastra de sync de 90 de zile în loc de 45?
4. **Confirmi** păstrarea evenimentului GA4 `click_affiliate_link` (în loc de `affiliate_click`)?
5. Alegerea librăriei (A/B/C) — după testul pe contul de test.

Faza 1 (site) nu depinde de Google Ads și poate porni imediat după ce alegi soluția de
cookies (`docs/ads-program/prompts/faza-1.md`).

---

## Decizii Poarta 0 (2026-09-26)
1. Conturile Google: proprietarul le creează; punctele 5–6 se reiau după.
2. ✅ SubID prin `&hash=click_id` (Profitshare) / `&st=click_id` (2Performant) în `/go`,
   activat devreme, separat de restul tracking-ului (branch `ads/faza-2a-subid`).
3. ✅ Fereastră de sync 90 de zile.
4. ✅ Păstrăm evenimentul GA4 `click_affiliate_link` (redenumit peste tot în pachet),
   extins cu parametrii lipsă.
5. Librăria Google Ads: după testul pe contul de test.
6. Faza 1: cookies = **C. Banner propriu**.

---

## Actualizare 2026-09-26 — conexiunea Google Ads (punctele 4–5) ✅

- Cont de reclame: **276-008-6909** („Superieftin.ro”, RON, Europe/Bucharest), **fără MCC**.
- Proiect Google Cloud `superieftin-ads`, nivel de acces API: **Basic** (15.000 operațiuni/zi,
  include Keyword Planner → research cu volume reale în Faza 3).
- Aplicația OAuth publicată („In production”); linkurile de politici sunt live pe
  `/confidentialitate` și `/termeni`.
- `npm run ads:auth` → refresh token salvat în `.env`.
- `npm run ads:check` (API **v25**, **fără developer token**):
  - ✓ conturi accesibile (14, contul nostru inclus)
  - ✓ citire cont
  - ✓ scriere `validate_only` (buget de test) — acceptată, **nimic creat** (verificat: 0 campanii;
    singurul buget existent în cont nu e al nostru, probabil din setup-ul inițial din interfață)
- Confirmat: modelul nou fără developer token funcționează pentru proiectul nostru.

### Librăria Google Ads (punctul 6) — actualizare
Clientul REST minimal (`worker/src/ads/google-ads.ts`) funcționează deja cu noul model de acces.
Recomandare actualizată: **B. REST direct** — zero dependențe, deja testat, fără riscul ca
librăria comunitară să ceară încă developer token.
**DECIZIE PROPRIETAR (2026-09-26): B. REST direct.**

**POARTA 0: îndeplinită.**
