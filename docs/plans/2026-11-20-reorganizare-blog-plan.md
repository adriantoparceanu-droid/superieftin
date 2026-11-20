# Reorganizare în blog — plan de implementare

Design: `docs/plans/2026-11-20-reorganizare-blog-design.md` · Aspect ales: **varianta A „Revista”**
(canvas: https://claude.ai/artifact/WkhTPSibxTR1p52J3f4Cim, artboard „A — Revista”).
Branch: `reorganizare-blog`. Deploy DOAR la `/deploy`, în „ziua schimbării” (etapa 6).

Stare la 20.11.2026: eMAG pe pauză pe producție (`retailers.paused_at`, motivul în `pause_reason`).

Fiecare etapă = commit(uri) separate, cu teste. Ordinea contează: etapele 1–4 nu schimbă nimic
public (site-ul vechi merge), etapa 5 e conținutul, etapa 6 comută totul.

---

## Etapa 1 — Regula „cel mai ieftin magazin partener” (fundația)

- `web/src/lib/best-offer.ts` (nou, pur + query): `pickBestOffer(offers)` — doar disponibile
  (aceeași condiție ca `OFFER_AVAILABLE_SQL`) ȘI `affiliate_url` nenul; preț minim; la egalitate
  `last_seen`/confirmarea cea mai recentă. `getBestOffers(productIds[])` — un singur query pentru
  toate produsele unui articol (fără N+1).
- Test: `web/src/lib/best-offer.test.ts` — fără afiliat exclus, indisponibil exclus, magazin pe
  pauză exclus, egalitate, listă goală → `null`.

## Etapa 2 — Cardul de produs + marcajele din articole

- `web/src/components/guides/ProductPick.tsx` (nou): cardul din varianta A — poză, nume,
  „Cel mai bun preț găsit la magazinele partenere”, preț, buton „Vezi la <magazin>” prin
  `AffiliateLink` (→ `/go/`). Fără ofertă → „Momentan indisponibil la magazinele partenere”, fără
  buton. Fără mediană, procente, „Reducere reală”, grafic.
- `components/guides/GuideBody.tsx`: `{{oferte:ID}}` și `{{pret:ID}}` → `ProductPick`;
  `{{comparatie:A,B}}` → tabel de specificații + câte un `ProductPick` compact pe coloană;
  `{{reducere}}` și `{{istoric-pret}}` scoase din setul public.
- Validarea marcajelor, modificată ÎMPREUNĂ (regula din CLAUDE.md): `MARKER_TYPES` din web și
  `worker/src/lib/guide-drafts.ts` — marcajele scoase sunt respinse la import și la salvarea din
  admin. Verifică întâi că cele 11 ghiduri publicate nu le folosesc (altfel le rescriem în etapa 5).
- `components/guides/preview-client-refs.ts`: adaugă componenta client nouă, dacă e cazul.
- Teste: randarea cardului (cu/ fără ofertă), validarea marcajelor scoase (web + worker, paritate).

## Etapa 3 — Unealta internă de cercetare

- `worker/src/scripts/cercetare.ts` + `npm run cercetare -- --tema=<slug> [--buget=N] [--limit=N]`
  (doar citire): candidați disponibili cu afiliat din tema (+ subcategorii), coloane: produs,
  cel mai bun preț + magazin, mediana 30 z, min/max 30 z, min 90 z (din `price_history`), nr.
  magazine, `price_changes_60d`, slug. Ieșire tabel + `--json`.
- `web/src/app/admin/(protected)/cercetare/page.tsx`: același tabel cu filtre (temă, buget,
  doar reduceri reale) + `/admin/cercetare/[slug]` = fișa veche de produs (graficul
  `PriceStepChart`, `VerdictCard`, lista de oferte) — reutilizează componentele din
  `components/product/`. Protejat de layout-ul admin (deja noindex).
- Link în meniul adminului.

## Etapa 4 — Verificarea săptămânală a articolelor

- `worker/src/lib/guide-health.ts` (pur, testat): pentru un articol publicat → probleme:
  produs fără ofertă disponibilă cu afiliat; preț peste bugetul din titlu (regex „sub N lei”);
  `updated_at` > 90 de zile.
- Job BullMQ `guide-health` (`GUIDE_HEALTH_CRON`, implicit luni 07:30, Europe/Bucharest):
  rezumat Telegram către `TELEGRAM_ADMIN_CHAT_ID` doar când există probleme; în admin
  (`/admin/ghiduri`) coloană „Probleme”. Nu modifică articolele.
- Teste: `guide-health.test.ts`.

## Etapa 5 — Conținutul (în paralel cu 1–4)

- 10 articole noi, ca ciorne JSON în `content/ghiduri/drafts/` (top pe buget, comparații, ghiduri
  de alegere, „Merită acum?”), subiecte din Search Console + termeni Ads + `npm run cercetare`.
  Import: `npm run ghiduri:import` (local, apoi pe prod ca ciorne). Proprietarul verifică/publică.
- Articole care înlocuiesc observatorul: „Black Friday 2026: câte reduceri au fost reale”,
  „Ce s-a scumpit în octombrie/noiembrie” (din indice), „Când să cumperi un televizor” (din timing).
- Cele 11 ghiduri existente: verificare că se randează corect cu cardul nou.
- `/c/<temă>`: textele `intro_md` revizuite să nu mai promită liste de produse/prețuri.

## Etapa 6 — Ziua schimbării (un singur deploy web + worker)

**Pagini publice (varianta A):**
- `app/page.tsx` (homepage): articolul principal + „Cele mai citite” (din GA4 `ga4_daily_breakdown`,
  pagini `/ghiduri/` pe 30 de zile; fără date → cele mai noi) + „Articole noi”. Componente noi în
  `components/home/` (cele vechi de reduceri se șterg).
- `components/Header.tsx`: meniul = temele (părinții din `categories`) + „Despre noi”;
  `OBSERVATOR_LINKS` scoase.
- `app/c/[categorie]/page.tsx`: pagina temei = intro + articolele din temă (articol ↔ temă:
  prin produsele legate în `guide_products` → categoriile lor; dacă nu ajunge, coloană nouă
  `guides.category_id`, migrația 038) + FAQ. Fără listă de produse, filtre, paginare.
  Subcategoriile → 308 spre părinte (sau propria pagină de temă doar dacă au ≥ 3 articole).
- `app/cautare/page.tsx`: caută în articole, nu în produse.

**Adrese care dispar** (în `src/proxy.ts` / `next.config.ts` → `redirects`, harta pură în
`web/src/lib/blog-redirects.ts`, testată):
- `/p/<slug>` → 308 `/ghiduri/<articol>#produs-<slug>` dacă produsul apare într-un articol publicat
  (cel mai recent actualizat), altfel 410.
- `/reduceri-reale/*`, `/indice/*`, `/cand-sa-cumperi/*`, `/black-friday-2026` → 308 spre
  articolul echivalent (din etapa 5) sau 410. `/t/*` → 410. `/feeds/products.xml` → 410.
- Legacy (`/produs`, `/product`, `/shop`, `/categorie-produs`…): țintele spre `/p/` se rescriu
  spre articol sau 410 (`lib/legacy-map.ts`) — fără lanțuri de redirect.
- Ancorele `#produs-<slug>` puse pe `ProductPick`.

**SEO**: sitemap-ul (`lib/seo/sitemap*.ts`) = homepage + teme + articole + pagini legale (fără
`produse-N.xml`; sitemap-index păstrat la același URL); `llms.txt` / `llms-full.txt` fără
observator; `ORGANIZATION_DESCRIPTION` → blog de recomandări; JSON-LD `Product` scos (rămâne
`Article`). `lib/seo/product-index.ts` + dublura din worker + `seo:index-report` → scoase.

**Alerte de preț** (Telegram + email): mesaj de rămas-bun (un singur digest/Telegram, text aprobat
de proprietar), apoi ștergerea abonaților/alertelor; formularele și `PriceAlertCard` scoase;
workerul de email și botul rămân doar pentru rămas-bun, apoi se opresc. `/cookies` și
`/confidentialitate` actualizate (nu mai stocăm emailuri pentru alerte).

**Google Ads**: înainte de deploy, toate campaniile „SE | …” pe pauză (proprietarul, manual, sau
`pauseOnly`). `ads/campaigns/*.yaml` arhivate; campanii noi spre articole = task separat
(ads-builder + policy-reviewer PASS). Garda `ads-guard`: adaptată la landing-uri `/ghiduri/` (citea
„Reducere reală” de pe `/p/`) sau oprită până la campaniile noi.

**Rămâne neschimbat**: feed-uri, scanare eMAG (locală), `price_history`, `offer_price_stats`,
snapshot, `/go/` (anti-roboți, click_id), `tracking:sync`, consimțământ, GA4.

**Verificare înainte de deploy**: `cd web && npm test`, `cd worker && npm test`, TypeScript;
local: 30 de adrese vechi din sitemap-ul de pe prod → 308 spre articol existent sau 410 (script
în scratchpad); homepage/temă/articol la 375 px și 1280 px; un click pe card trece prin `/go/`
(E2E existent, `--host-resolver-rules`).

**După deploy**: Search Console — retrimite sitemap-ul, URL Inspection pe homepage + 3 articole;
GA4 — `click_affiliate_link` din articole; Profitshare — fără schimbări încă.

## Etapa 6b — SEO + AI (Google și asistenți AI), parte din ziua schimbării

Decizie proprietar 20.11.2026: produsele din articole = **recenzie editorială cu pro/contra**
(Product + Review cu `positiveNotes`/`negativeNotes`, autor real, FĂRĂ note/stele, FĂRĂ preț în
schemă). Înlocuiește regula veche „fără marcaj Review” DOAR pentru acest caz (fără
`AggregateRating`, fără note inventate). Pro/contra = marcaje `{{pro: …}}` / `{{contra: …}}` după
cardul produsului, vizibile pe pagină (etapa 2).

**Date structurate (JSON-LD, `@id`-uri comune cu `lib/seo/jsonld.ts`):**
- Articol: `BlogPosting` cu `headline`, `description`, `image` (obligatoriu pentru rezultate
  îmbogățite), `author` = `Person` cu `url` spre `/autori/<slug>`, `publisher` = Organization `@id`,
  `datePublished`/`dateModified`, `mainEntityOfPage`, `inLanguage: ro-RO`, `articleSection` (tema),
  `about`/`mentions` (produsele); `WebPage.reviewedBy` = verificatorul.
- Per produs recomandat: `Product` (`name`, `image`, `brand`, `gtin`/`mpn` doar dacă le avem
  sigur) cu `review` = `Review` (`author`, `datePublished`, `positiveNotes`/`negativeNotes` ca
  `ItemList`). Fără `offers`, fără `url` spre `/p/`. De verificat în Rich Results Test dacă Google
  cere `reviewRating` pentru afișare — dacă da, decide proprietarul (fără note inventate).
- Top-uri: `ItemList` cu produsele, `url` = ancora `#produs-<slug>` din articol.
- `BreadcrumbList` (Acasă → Temă → Articol), `FAQPage` (doar întrebările vizibile).
- Homepage: `WebSite` (+ `SearchAction` spre căutarea în articole) + `Organization` + `ItemList`
  articole noi. Temă `/c/`: `CollectionPage` + `ItemList` articole + `BreadcrumbList` + `FAQPage`.
- Autori: `/autori/<slug>` (nou) = `ProfilePage` + `Person` (`name`, `description`, `jobTitle`,
  `sameAs` doar profile reale) + lista articolelor. Coloanele există (`guide_authors.bio/url`).

**Pagini și semnale de încredere (E-E-A-T):**
- Fiecare articol: autor + verificator vizibili cu link, „Publicat” + „Actualizat” vizibile,
  notă de afiliere vizibilă sus („Unele linkuri sunt de afiliere…”), link spre metodologie.
- `/ghiduri/metodologie` rescrisă: cum alegem produsele (date de preț interne, specificații de la
  producător, cine verifică), cum ne finanțăm, cât de des actualizăm.
- Cuprins cu ancore pe H2 (salturi din Google), un singur H1, `alt` pe toate imaginile.
- Bloc „Articole înrudite” (aceeași temă, prin produse) + linkuri interne din homepage și temă.

**Tehnic:**
- Imagine Open Graph per articol generată (`opengraph-image.tsx`, Next `ImageResponse`: titlu +
  temă + logo), `twitter:card = summary_large_image`; aceeași imagine în `BlogPosting.image`.
- Linkurile afiliate: `rel="sponsored nofollow"` (deja în `AffiliateLink` — de păstrat).
- Sitemap: homepage, teme, articole (`lastmod` = `updated_at`), autori, pagini legale;
  imaginile articolelor ca `image:image`.
- RSS `/ghiduri/feed.xml` (descoperire rapidă, agregatoare, asistenți AI) + `<link rel=alternate>`.
- `llms.txt` / `llms-full.txt` rescrise: identitate „blog de recomandări”, lista articolelor cu
  rezumat, metodologia; fără observator/comparator. `robots.txt`: AI deblocat (există).
- IndexNow la publicare (există). Core Web Vitals: `next/image` cu dimensiuni, fonturi
  preîncărcate, fără CLS din carduri; Lighthouse ≥ 90 pe mobil pentru homepage + 1 articol.

**Verificare**: teste pentru generatorii JSON-LD (forma exactă, fără `offers`, fără `/p/`);
Rich Results Test + Schema Markup Validator pe 3 articole (local prin tunel sau după deploy);
Search Console: retrimite sitemap-ul, URL Inspection pe homepage + 3 articole.

## Etapa 7 — eMAG (după 2–4 săptămâni de blog live)

- Profitshare: sursă nouă de trafic declarată „blog / site de conținut” pentru `www.superieftin.ro`
  și reaplicare la eMAG. Doar după acceptare: reluare pauză eMAG (Admin → Magazine).

## Documentație (în aceleași commit-uri)

CLAUDE.md: secțiunile Ghiduri, SEO tehnic, Observator, Alerta de preț, Admin → Alerte, Filtrul de
marcă, Pagina `/p/`, Tokeni (homepage), garda Ads, „Oferte dispărute” (410 la `/p/`) — rescrise sau
scoase; secțiune nouă „Blog de recomandări” (regula ofertei, cardul, cercetarea, verificarea
săptămânală). Memoria: `reorganizare-blog-nov-2026`.

## Riscuri / de decis pe parcurs

- Câți abonați la alerte se pierd (de numărat în etapa 6, înainte de rămas-bun).
- Legătura articol ↔ temă: prin produse (fără migrație) sau `guides.category_id` (migrația 038).
- „Cele mai citite” are nevoie de date GA4 pe `/ghiduri/` — la început va arăta cele mai noi.
