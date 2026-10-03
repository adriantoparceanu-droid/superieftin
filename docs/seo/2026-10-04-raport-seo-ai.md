# Raport SEO + vizibilitate AI — superieftin.ro

**Data:** 2026-10-04 · **Tip:** audit doar-citire (cod pe `main` @ `844fe43`, site live, DB producție doar SELECT, căutări web)
**Scop:** ce schimbăm ca să urcăm în Google/Bing și să fim citați de ChatGPT / Claude / Perplexity / Google AI Overviews / Copilot.
**Pentru cine:** agenții care implementează peste noapte (pachetele A–D) și proprietarul (pachetul E + „De decis”).

> Reguli valabile pentru toate pachetele: deploy DOAR la comanda proprietarului (`/deploy`); fiecare pachet pe branch propriu (`seo/pachet-X-…`); comentarii și commit-uri în română; nu se ating `/confidentialitate`, `/termeni`, `/cookies`, bannerul de cookies, fluxul `/go/`, protecția anti-roboți, tracking-ul; pe paginile din campanii (lista la §0) nu se schimbă textele existente — doar se adaugă blocuri/marcaj care nu contrazic anunțurile; fără promisiuni de reduceri (regula 9); Sănătate & Naturale exclusă din texte noi (regula 8); fără marcaj `Review`/`AggregateRating`.

---

## 0. Pagini protejate (Google Ads `final_url`)

Din `ads/campaigns/*.yaml` (fără `_template.yaml`):

| URL | Campanie |
|---|---|
| `/p/telefon-mobil-iphone-17-pro-max-256gb-dual-sim-5g-cosmic-orange` | iphone-17-pro-max |
| `/p/telefon-mobil-galaxy-s26-ultra-256gb-12gb-ram-dual-sim-5g-cobalt-violet` | galaxy-s26-ultra |
| `/p/telefon-mobil-galaxy-s26-ultra-1tb-16gb-ram-dual-sim-5g-cobalt-violet` | galaxy-s26-ultra |
| `/p/telefon-mobil-galaxy-z-fold7-256gb-12gb-ram-dual-sim-5g-silver-shadow` | samsung-pliabile |
| `/p/telefon-mobil-galaxy-z-flip7-fe-256gb-8gb-ram-dual-sim-5g-white` | samsung-pliabile |
| `/reduceri-reale/laptopuri` | (landing categorie) |

Schimbările de **șablon** din `/p/[slug]` și `/reduceri-reale/[categorie]` le afectează și pe acestea. Sunt permise doar dacă: (1) textul vizibil existent rămâne neschimbat (verdict, „Reducere reală”, procentul, „Vezi oferta”, „Anunță-mă când scade prețul”, „pe Telegram”); (2) pagina rămâne `index` și 200; (3) `cd worker && npm run ads:validate` trece după schimbare (verifică 200, stoc, „Reducere reală”, %). Ce nu respectă asta → „De decis”.

---

## 1. Rezumat executiv

### Diagnostic în 6 rânduri
1. **ChatGPT (GPTBot) și Claude (ClaudeBot) primesc 403 de la Cloudflare** („Your request was blocked.”), deși `robots.txt` le permite. OAI-SearchBot, ChatGPT-User, PerplexityBot, Claude-SearchBot, Googlebot, bingbot trec (200).
2. **Canonical greșit moștenit din layout**: orice pagină fără canonical propriu (404-uri, căutare) declară canonical = homepage, iar 404-urile au simultan `noindex` ȘI `index, follow`.
3. **Subcategoriile `/c/<sub>` nu sunt în sitemap** (doar cele 6 categorii-părinte), iar `/reduceri-reale/*` nu are niciun link intern. Sitemap-ul are 29.063 URL-uri într-un singur fișier de 6 MB, cu `lastmod` fals (97% = „azi”).
4. **Conținut subțire**: `/p/` are ~120 de cuvinte proprii (fără descriere, specificații, produse similare); `/c/` nu are niciun text (coloana `categories.description` e goală la toate cele 40 de categorii); titlurile `/c/` se generează din slug („Telefoane accesorii”, „Elecrocasnice”).
5. **Comparația propriu-zisă e rară**: doar 6 produse au ≥2 magazine disponibile; valoarea reală, unică în RO, e **istoricul + mediana 30 de zile** — asta trebuie pus în față în texte, date structurate și llms.txt (fapte citabile).
6. **Zero prezență externă**: superieftin.ro nu e menționat nicăieri (Reddit, forumuri, presă). Concurenții mari (compari.ro, price.ro) blochează roboții non-JS cu Cloudflare → loc liber pentru noi ca sursă citată de AI dacă îi lăsăm să intre.

### Top 10 acțiuni

| # | Acțiune | Pachet | Impact | Efort |
|---|---|---|---|---|
| 1 | Deblochează GPTBot + ClaudeBot (și ceilalți roboți AI) în Cloudflare → AI Crawl Control / „Block AI bots” | E | Mare (AI) | 10 min |
| 2 | Scoate `alternates.canonical` și `robots` din layout-ul rădăcină; `not-found.tsx` în română, doar `noindex` | A1–A2 | Mare | Mic |
| 3 | Sitemap: adaugă `/c/<subcategorie>` și `/t/<tag>`, scoate categoriile goale, `lastmod` real, împărțire în sitemap index | A7 | Mare | Mediu |
| 4 | `/c/`: titlu/descriere din `category.name` + cifre live; canonical propriu pe `?page=N`; `noindex` pe categorii goale și pe `?brand=`; `?page` peste limită → 404 | A3 | Mare | Mic |
| 5 | Texte pe 14 categorii (paragraf + 3–5 FAQ, cifre live prin marcaje) + `FAQPage` | B | Mare | Mediu |
| 6 | `/p/`: bloc „Fapte despre preț” (minim/maxim 90 zile, mediana, data verificării) + „Alte variante” + „Produse similare”; JSON-LD corectat (AggregateOffer, url pagină, mpn, breadcrumb cu nume) | A4 | Mare | Mediu |
| 7 | Publică ciornele 5 și 4 (gata), repară 3 și 2; scrie 3 ghiduri noi (Black Friday/reduceri reale, televizoare pe diagonale, încărcătoare USB-C/GaN) | C | Mare (GEO) | Mediu |
| 8 | Organization + WebSite JSON-LD sitewide (cu `@id`, logo, date firmă), titlu homepage cu brand, autor „Adrian” cu bio + URL | A6, C | Mediu | Mic |
| 9 | Linkuri interne spre `/reduceri-reale/*` (din `/c/`, homepage, footer) + hub nou `/reduceri-reale` + JSON-LD ItemList/Breadcrumb pe landing-uri | A8 | Mediu | Mic |
| 10 | `llms.txt` extins (fapte, cifre live, categorii `/c/`, ghiduri, contact) + `llms-full.txt`; IndexNow activ (cheia lipsește → `/indexnow-key.txt` = 404) + Bing Webmaster Tools | D, E | Mediu (AI/Bing) | Mic |

### Ce e gata de implementat peste noapte
- **A (SEO tehnic)** — gata, fără dependențe.
- **B (texte categorii)** — gata; cere o migrație nouă (`030_…`), aplicată pe prod doar la deploy.
- **C (ghiduri)** — gata pentru scriere + import ca *draft*; **publicarea o face proprietarul din Admin → Ghiduri** (poarta cu checklist e voit umană — vezi „De decis” D3).
- **D (roboți AI + llms.txt)** — partea de cod e gata; efectul real depinde de pasul manual E1 din Cloudflare.
- **E** — doar proprietarul.

---

## 2. Constatări pe secțiuni (cu dovezi)

### 2.1 Acces roboți (Cloudflare + robots.txt)

`robots.txt` live (generat de `web/src/app/robots.ts:8-19`):
```
User-Agent: *
Allow: /
Disallow: /go/
Disallow: /api/
Sitemap: https://www.superieftin.ro/sitemap.xml
```
Răspunsul real pe `/` și `/ghiduri` (curl, 2026-10-04 ~01:35, câte 1–3 cereri/UA):

| User-Agent | `/` | `/robots.txt` | Observații |
|---|---|---|---|
| Browser (Chrome) | 200 | 200 | |
| Googlebot | 200 | 200 | |
| bingbot | 200 | 200 | |
| Google-Extended | 200 | 200 | (e doar token de robots.txt, nu crawler real) |
| **GPTBot** | **403** | 200 | `server: cloudflare`, corp `Your request was blocked.` (25 B, text/plain) |
| **ClaudeBot** | **403** | 200 | idem |
| **anthropic-ai** | **403** | — | idem |
| **CCBot** | **403** | — | idem |
| **Bytespider** | **403** | — | idem |
| OAI-SearchBot | 200 | 200 | |
| ChatGPT-User | 200 | 200 | |
| Claude-SearchBot / Claude-User | 200 | — | |
| PerplexityBot / Perplexity-User | 200 | — | |
| Applebot-Extended | 200 | — | |

Concluzie: blocajul **nu e în cod** (nimic în `web/src`, `worker/src`, nginx din repo) — e regula Cloudflare pentru „AI crawlers / training” (setarea „Block AI bots” sau AI Crawl Control → Block pe categoria „AI Crawler”). Roboții „de căutare/la cerere” trec, cei de „antrenare” nu. Decizia proprietarului (îi permitem) → pașii E1.

Cloudflare **nu** servește un `robots.txt` gestionat (al nostru e intact) — bine, nu trebuie activat „Managed robots.txt” (ar adăuga `Disallow` pentru roboții AI).

### 2.2 Sitemap

- `https://www.superieftin.ro/sitemap.xml`: **6.060.238 B, 29.063 URL-uri** într-un singur fișier (limita e 50.000 / 50 MB — suntem la 58%; la creșterea catalogului petmart/feed-uri noi trecem pragul).
- Componență: `/p/` 29.022 · `/reduceri-reale/` 26 · `/c/` **6** · ghiduri 3 · statice 6.
- `/c/` include doar părinții (`getCategories()` filtrează `parent_id IS NULL`, `web/src/lib/queries.ts:500-514`; folosit în `web/src/app/sitemap.ts:47-52`). **Subcategoriile — exact paginile cu produse (telefoane-mobile, laptopuri, televizoare…) — lipsesc.** Ele sunt găsite doar prin meniu.
- Include `/c/sanatate-naturale` (ok pentru SEO organic; regula 8 e despre reclame) dar și categorii fără niciun produs disponibil dacă sunt părinți (vezi 2.6).
- `lastmod`: 28.083 = 2026-10-03, 971 = 2026-10-01 → `products.updated_at` se atinge la fiecare sync, deci nu semnalează nimic. Categoriile/landing-urile au `new Date()` (`sitemap.ts:49`, `:63`) → „modificat acum” la fiecare cerere. Google ignoră `lastmod` care minte sistematic.
- Produse indisponibile: excluse corect (`getAllProductSlugs`, `queries.ts:709-720`, cu `OFFER_AVAILABLE_SQL`), cache 24 h → până la 24 h decalaj (acceptabil).
- `/t/<tag>` (ex. `/t/refurbished`, 200) **nu e în sitemap**, deși „laptop refurbished” are 2.900 căutări/lună și „laptop second hand” 3.600 (`ads/research/2026-09-27-oportunitati-v2.md:213-219`).
- `/ghiduri/metodologie` e listat de două ori ca tip (static + ghiduri) — nu e dublură de URL, ok.

### 2.3 Canonical, robots meta, 404 / soft-404

- **`web/src/app/layout.tsx:42-43`**: `robots: { index: true, follow: true }` și `alternates: { canonical: SITE_URL }` în layout-ul rădăcină → moștenite de orice pagină fără metadata proprie.
  - `/nu-exista-pagina` (404): `<title>404: This page could not be found.</title>` (engleză), `<meta name="robots" content="noindex">` **și** `<meta name="robots" content="index, follow">`, canonical = `https://www.superieftin.ro`.
  - `/p/nu-exista-produs` (404): titlul implicit al site-ului, aceleași meta contradictorii.
  - `/cautare?q=iphone`: `noindex, nofollow` + canonical = homepage (`web/src/app/cautare/page.tsx:22`). `nofollow` oprește descoperirea produselor din rezultate; canonical spre homepage e semnal contradictoriu.
- **`/c/[categorie]`** (`web/src/app/c/[categorie]/page.tsx:16-27`): canonical mereu `/c/<slug>`:
  - `?page=2` → canonical spre pagina 1 (Google recomandă canonical propriu pe paginare; altfel produsele de pe paginile 2–16 se descoperă greu).
  - `?brand=Samsung` → canonical spre bază, `index, follow` (ok ca deduplicare, dar vezi „De decis” D5 pentru pagini de brand indexabile).
  - `?page=999` → **200** cu „Niciun produs găsit” (soft-404).
  - Categorii fără produse disponibile (monitoare 0/3182, servere 0/8246, workstations 0/3596, baterii-telefoane 0, licențe 0, huse 1, boxe 1) → 200, `index`, „Niciun produs găsit” (soft-404), toate în meniu pe fiecare pagină. Cauza: CITGrup și ForIT pe pauză.
  - `getCategoryBySlug` (`queries.ts:527-537`) nu verifică `is_visible` → categoriile ascunse sunt accesibile direct.
- `/reduceri-reale` (fără categorie) → 404; nu există hub.
- `/reduceri-reale/<sub>` fără reduceri → 200, `index`, blocul „Acum nu avem reduceri reale…” + cele mai apropiate 8 produse — conținut subțire și aproape duplicat cu `/c/` (vezi D4: nu îl punem pe noindex fără proprietar, pentru că `ads-guard` pune pe pauză landing-urile noindex).
- `/p/` indisponibil: `noindex, follow` (`p/[slug]/page.tsx:54`) — corect; din 27 oct `src/proxy.ts` dă 410 pentru ~24.809 produse (fără ofertă de 30 zile) — corect, dar se va vedea în Search Console ca scădere de pagini indexate (așteptat).
- Redirecturi: `http→https`, `apex→www` = 301; slash final → 308; parametri `utm_*` pe `/p/` → 200 cu canonical curat. Ok.

### 2.4 Titluri, meta description, headings

| Tip | Titlu live | Problemă |
|---|---|---|
| `/` | `Reduceri reale pe piața din România` | Fără brand (template-ul `%s | superieftin.ro` nu se aplică pe segmentul rădăcină) și fără „comparator de prețuri”/„istoric preț”. H1: „Reduceri REALE, nu trucuri de marketing” (`components/HeroBanners.tsx:21`). |
| `/c/telefoane-mobile` | `Telefoane mobile — prețuri și reduceri reale | superieftin.ro` | Titlul vine din **slug** (`c/[categorie]/page.tsx:18-19`), nu din `category.name` → „Telefoane accesorii” (lipsește „&”), „Elecrocasnice”, fără diacritice. Descrierea e identică pe toate categoriile, cu alt cuvânt. Fără cifre. |
| `/p/…` | `Telefon mobil Nokia 105 (2024), Dual Sim (Mov) — preț azi de la 138,99 RON | superieftin.ro` | Bun ca intenție; adesea >70 caractere (Google trunchiază, ok). Descrierea: „Prețul curent pentru X la evomag.ro. Grafic de preț…” — repetitivă, fără fapte (mediana, minimul). |
| `/reduceri-reale/…` | `Reduceri reale la telefoane mobile | superieftin.ro` | Ok. |
| `/ghiduri/…` | titlul ghidului | Ok; `guides` nu are `meta_title` separat. |

- **Headings**: `ProductCard` folosește `<h2>` pentru numele produsului (`web/src/components/ProductCard.tsx:44`) → homepage are 23 de H2 (aproape toate nume de produse), `/c/telefoane-mobile` 48 de H2. Ierarhia semantică e diluată; secțiunile reale („Top reduceri reale”, „Departamente populare”) sunt la același nivel cu cardurile.
- **OpenGraph**: `openGraph` setat în pagină înlocuiește complet pe cel din layout → pe `/c/` și `/p/` lipsesc `og:type`, `og:site_name`, `og:locale` (verificat live pe `/p/…nokia…`: fără `og:type`). Ghidurile repetă corect câmpurile (`ghiduri/[slug]/page.tsx:33-43`).
- `lang="ro"` pe `<html>` — corect. hreflang nu e necesar (o singură limbă/țară).

### 2.5 Date structurate (JSON-LD) — validare manuală

| Pagină | Ce există | Erori / lipsuri |
|---|---|---|
| `/` | `WebSite` + `SearchAction` (`app/page.tsx:65-76`) | Fără `@id`, fără `publisher`; **nu există `Organization` nicăieri pe site** (doar ca `publisher` în ghiduri, `lib/guides/jsonld.ts:24-34`). URL-uri hardcodate (nu din `SITE_URL`). |
| `/c/` | `ItemList` (primele 10) + `BreadcrumbList` | Ok sintactic. Primele elemente pe `/c/telefoane-mobile` (sortare preț) sunt **un adaptor USB-C → jack și un încărcător** — produse mapate greșit în telefoane-mobile (problemă de mapare, nu de cod). Fără `FAQPage` (nu există FAQ). |
| `/p/` | `Product` + `Offer[]` + `BreadcrumbList` (`p/[slug]/page.tsx:105-134`) | (1) `Offer.url` = `/go/<id>` — URL blocat în robots.txt și redirect afiliat; trebuie URL-ul paginii. (2) Fără `AggregateOffer` (`lowPrice`/`highPrice`/`offerCount`). (3) Fără `sku`/`mpn` (`products.part_no` există) și fără `gtin`. (4) `brand` lipsește la 17.749 produse (226 telefoane disponibile). (5) Produs fără oferte → `offers: []` (Google: „Either offers, review or aggregateRating should be specified”) — pagina e noindex, dar e eroare în raport. (6) `category` = slug. (7) Breadcrumb: poziția 2 = slug cu spații („telefoane mobile”), lipsește nivelul părinte; vizibil la fel (`:151-159`). (8) Fără `itemCondition` (Refurbished/Second Hand sunt tag-uri). |
| `/reduceri-reale/` | **nimic** | Lipsesc `ItemList` + `BreadcrumbList`. |
| `/ghiduri/` | nimic | Ar merita `CollectionPage`/`ItemList` + Breadcrumb. |
| `/ghiduri/<slug>` | `BlogPosting` + `BreadcrumbList` + `FAQPage` + `Product`×N | Bine construit. `Product.offers[].url` tot `/go/` (`lib/guides/jsonld.ts:103`). Verificatorul „Adrian” e `Person` fără `url`/`description` (DB: `guide_authors` id 2 fără bio/url) → E-E-A-T slab. Notă: Google afișează rich results FAQ doar pentru site-uri guvernamentale/medicale din 2023, dar `FAQPage` rămâne util pentru AI și Bing. |

### 2.6 Conținut subțire, duplicate, calitatea catalogului (date producție)

- **Produse**: 56.342 total; 29.022 disponibile (indexabile); 27.320 indisponibile (noindex). Fără categorie: 10.574. Fără brand: 17.749.
- **`/p/`**: niciun câmp de descriere în `products`. Text propriu vizibil ~120 de cuvinte (verdict, preț, magazin, nota de afiliere, „Date insuficiente…” la istoric scurt); restul de ~300 de cuvinte = meniul (randat de două ori: desktop + mobil).
- **Comparație**: doar **6 produse** au ≥2 magazine disponibile. Petmart 13.110, Vegis 6.651, evomag 5.884, ITGalaxy 2.381, eMAG 511 (scanare manuală), rowenta 382; CITGrup 0/17.994 și ForIT 0/1.794 pe pauză. ⇒ textele nu trebuie să promită „compară N magazine” pe `/p/`; diferențiatorul citabil este istoricul + mediana.
- **Duplicate**: 49 de grupuri / 102 produse cu nume identic (mai ales laptopuri evomag cu part_no diferit, ex. „HP ProBook 4 G2i … argintiu” ×5); **168 de grupuri de variante de culoare** (telefoane, laptopuri, TV); Galaxy S26 Ultra în 45 de produse, inclusiv slug-uri cu alt format (`smartphone-galaxy-s26-ultra-s948-…` vs `telefon-mobil-galaxy-s26-ultra-…`). Canonical între variante = schimbare de indexare a unor URL-uri existente (inclusiv cele din reclame) → „De decis” D6; între timp, legăturile „Alte variante” (A4) ajută.
- **Categorii**: `categories.description` gol la toate 40. Slug + nume „elecrocasnice/Elecrocasnice” greșit.

### 2.7 Linkuri interne și breadcrumbs

- Homepage: 18 linkuri `/p/`, ~40 `/c/` (meniu), 1 `/ghiduri`, **0 `/reduceri-reale/`**. Pe `/c/`: 0 linkuri spre `/reduceri-reale/`. Footer (`components/Footer.tsx:5-12`): Ghiduri, Despre, Contact + politici — fără Metodologie, fără reduceri reale. ⇒ cele 26 de landing-uri sunt orfane (doar sitemap + llms.txt).
- `/p/` → doar breadcrumb spre categorie și ghiduri legate; **niciun link spre produse similare/variante** → paginile de produs sunt fundături pentru crawler.
- `/reduceri-reale/*` → link „Cum verificăm” spre `/despre` (ar fi mai bine `/ghiduri/metodologie`, pagina-sursă pentru AI).
- Breadcrumbs vizibile pe `/c/`, `/p/`, `/reduceri-reale/`, ghiduri — ok; pe `/p/` cu slug în loc de nume și fără părinte.

### 2.8 Performanță / CWV (aproximativ, fără Lighthouse)

| Pagină | HTML (necomprimat) | `<script>` | Imagini | TTFB |
|---|---|---|---|---|
| `/` | 250 KB (29 KB gzip) | 60 | 24, toate `loading="lazy"` | 0,14 s |
| `/c/telefoane-mobile` | 327 KB | 86 | 48 lazy | 0,13 s |
| `/c/laptopuri` | — | — | — | 0,22 s |
| `/reduceri-reale/laptopuri` | 165 KB (pt. telefoane) | 49 | 20 lazy | 0,26 s |
| `/p/…` | 84–100 KB | — | 1, `priority` | 0,07–0,11 s |

- JS din chunk-uri (10 fișiere pe `/c/`): ~200 KB necomprimat — rezonabil pentru Next 16.
- **LCP probabil**: pe `/p/` imaginea produsului, servită `unoptimized` direct de pe CDN-ul magazinului (`cdni.itgalaxy.ro`, `static2.evomag.ro`, petmart…) (`p/[slug]/page.tsx:166-174`) → LCP depinde de serverele lor (fără AVIF/WebP, fără redimensionare). Pe homepage, primul card din hero e și el lazy.
- Cache: `/`, `/c/`, `/reduceri-reale/`, `/ghiduri` sunt `force-dynamic` (`cache-control: private, no-store`), `cf-cache-status: DYNAMIC` peste tot; `/p/` e ISR 3600 s (`x-nextjs-cache: HIT`). Datele sunt în `unstable_cache`, deci TTFB e bun. Nu e o problemă SEO acum.
- HTML-ul mare vine din meniul dublat + payload-ul RSC (JSON-LD apare de două ori în HTML pe `/c/` — o dată ca script, o dată în payload; nu e eroare, Google citește doar scriptul).

### 2.9 AI / GEO

- **llms.txt** (`web/src/app/llms.txt/route.ts`, 3,9 KB live): bun ca bază (definiția reducerii reale, metodologie scurtă, afiliere). Lipsesc: cifre live (câte produse/magazine urmărim, de când avem istoric), lista categoriilor `/c/` (are doar `/reduceri-reale/`), pagina Contact și datele firmei, o secțiune „Cum să ne citezi / ce date avem pe fiecare pagină de produs”, `llms-full.txt`, link spre sitemap, data actualizării; include „Elecrocasnice” (typo din DB).
- **Conținut citabil**: ghidul publicat (1.653 cuvinte, 4 tabele, FAQ, autor, date) e formatul ideal. Paginile `/p/` nu au fraze factuale complete („Cel mai mic preț din ultimele 90 de zile a fost X lei, pe <dată>”) — AI-ul nu citează grafice. `/despre` explică metodologia, dar fără cifre/istoric/„de când”.
- **Entitate**: nu există `Organization` JSON-LD sitewide, nici `sameAs` (nu există profiluri sociale/externe), nici `logo`. Datele firmei există în `web/src/lib/company.ts` (Digital Pro Shop SRL, CUI 50523367, contact@superieftin.ro).
- **Prezență externă** (WebSearch, raport fork concurență): **zero mențiuni** pentru „superieftin.ro”/„superieftin”. AI-urile citează gadget.ro, mobilissimo, playtech, presa (euronews, economedia) și Consiliul Concurenței pe tema reducerilor de Black Friday.
- **IndexNow** (folosit de Bing/Copilot, Yandex): `INDEXNOW_KEY` nesetat pe prod → `/indexnow-key.txt` = 404.

### 2.10 Concurență (WebSearch; index US, deci prezență, nu poziție exactă în Google.ro)

| Căutare | Cine apare |
|---|---|
| comparator preturi telefoane romania | gadget.ro, capital.ro, extensia Pretzi; menționați price.ro, compari.ro, shopmania |
| iphone 16 pret cel mai mic | hotnews, economedia, mobilissimo, altex, gadget.ro |
| samsung galaxy s25 pret comparare | mobilissimo („Preț și disponibilitate” per model) |
| laptop gaming ieftin 2026 | aproape doar site-uri străine — **loc liber în RO** |
| televizor 55 inch pret comparator | price.ro (pagini de căutare internă indexate), okazii.ro, samsung.com/ro |
| monitor 27 inch pret | price.ro `/rezultate~monitor-27-144.html`, okazii |
| casti wireless pret | okazii, compari (produs), altex, price.ro brand+categorie |
| istoric pret emag | gadget.ro (articol), extensiile istoric-preturi.info, xPrice |
| reduceri reale black friday istoric pret | euronews, Consiliul Concurenței (via romania-insider, economedia), wall-street |
| cel mai bun telefon 2026 sub 2000 lei | playtech.ro, infocontact, gadget.ro TOP 5, forum.softpedia |

Ce au ei și noi nu: pagini de filtru indexabile (brand × categorie, diagonală, Hz) cu titlu/H1 proprii (price.ro, okazii); pagini „Preț <model> în România” cu tabel preț × variantă × magazin (mobilissimo); ghiduri „cel mai bun X sub Y lei 2026” (gadget, playtech); un ghid „istoric preț eMAG”; o pagină despre reducerile reale de Black Friday cu exemple concrete; specificații pe produs; pagini „despre” cu cifre și autori cu profil; mențiuni externe. compari.ro și price.ro întorc „Just a moment…” (Cloudflare JS challenge) chiar și la UA de browser fără JS → roboții AI fără JS probabil nu le pot citi paginile ⇒ **oportunitate: noi putem fi sursa citabilă pentru prețuri RO**.

### 2.11 Ghiduri ciornă (tabela `guides`, prod)

| id | slug | Cuvinte / produse | [DE VERIFICAT] | Verdict |
|---|---|---|---|---|
| 1 | `iphone-17-pro-max-256gb-dupa-iphone-18` | 999 / 4 | 0 | **publicat** |
| 5 | `samsung-galaxy-s26-ultra-256gb-ghid` | 1008 / 4 (toate ITGalaxy, disponibile) | 0 | **Publicabil** după verificarea surselor secundare (IP68, 60 W, specificații S25 Ultra) + checklist |
| 4 | `merita-samsung-galaxy-z-fold7` | 1021 / 3 (ITGalaxy, disponibile) | 0 | **Publicabil** după verificarea greutate/grosime/încărcare pe samsung.com/ro + checklist |
| 3 | `lg-oled-c6-vs-samsung-oled-s90f-55` | 990 / 2 | 4 (HDR10+ pe C6, panou S90F ×2, eARC C6) + fraza „DV rulează în HDR10” | **După remediere**: șterge rândurile nesigure; LG C6 doar pe eMAG (risc indisponibil fără scanare) |
| 2 | `laptopuri-pentru-studenti-si-birou` | 1415 / 6 | 8 | **După remediere**: HP 15-fd0089nq (id 96034) **indisponibil** → înlocuit (propunere în review_notes: Acer Aspire Lite 15 AL15-46P-R5ST); fraza „ordonate după nivelul de preț” e falsă acum; MacBook și Slim 3 depind de eMAG |

Toate: autor 1 („Echipa Superieftin.ro”), verificator 2 („Adrian”, fără bio/URL), 5 FAQ, meta 146–156 caractere, fără afirmații de sănătate sau prețuri scrise de mână, checklist din `review_notes` nebifat. Fișierele sursă sunt în `content/ghiduri/drafts/`.

### 2.12 Categorii cu cel mai mare potențial pentru texte (fără Sănătate & Naturale)

Date prod 2026-10-04 (Disp = produse cu ofertă disponibilă; Red = reduceri reale azi; Istoric = de când).

| Prioritate | slug | Disp | Red | Ret | Preț median | Istoric | Cerere (estimare) |
|---|---|---|---|---|---|---|---|
| 1 | `telefoane-mobile` | 756 | 20 | 4 | 2.913 lei | 13.06 | foarte mare |
| 2 | `laptopuri` | 1.221 | 88 | 2 | 7.358 lei | 13.06 | foarte mare |
| 3 | `televizoare` | 702 | 63 | 2 | 2.555 lei | 14.06 | foarte mare (sezon BF) |
| 4 | `hrana-uscata` | 1.945 | 0 | 1 | 140 lei | 03.10 | mare (KP: „hrana uscata caini” 2.900, „royal canin” 6.600) |
| 5 | `incarcatoare-cabluri` | 1.334 | 106 | 3 | 58 lei | 12.06 | mare |
| 6 | `desktop-uri` | 795 | 19 | 1 | 2.863 lei | 13.06 | medie |
| 7 | `aspiratoare` | 100 | 0 | 1 | 1.000 lei | 27.09 | mare |
| 8 | `baterii-externe` | 282 | 15 | 2 | 149 lei | 13.06 | mare |
| 9 | `suport-tv` | 669 | 89 | 1 | 152 lei | 14.06 | medie |
| 10 | `hrana-umeda` | 1.235 | 0 | 1 | 10 lei | 03.10 | medie (KP: „hrana umeda pisici”) |
| 11 | `componente-pc-server` | 506 | 27 | 1 | 1.248 lei | 26.09 | medie |
| 12 | `folii-protectie-telefon` | 326 | 13 | 2 | 59 lei | 12.06 | medie |
| 13 | `jucarii-pet` | 866 | 0 | 1 | 20 lei | 03.10 | mică–medie |
| 14 | `t/refurbished` (tag) | — | — | — | — | — | mare (KP: „laptop second hand” 3.600, „laptop refurbished” 2.900) — dar CITGrup e pe pauză; text doar după ce revine feed-ul |

Plus 3 părinți-hub (text scurt, fără FAQ): `telefoane-accesorii`, `laptopuri-calculatoare`, `tv-audio`, `animale-de-companie`.
Volumul pentru electronice e estimat calitativ (nu avem export Keyword Planner pentru ele în repo — pet + refurbished au, în `ads/research/`). **Atenție**: la animale istoricul începe pe 03.10 → până pe ~03.11 textele nu pomenesc mediana/reducerile reale ca pe ceva existent în categorie.

---

## 3. PACHETE DE LUCRU

Fiecare pachet: branch propriu din `main`, commit-uri mici `feat(seo): …`, fără deploy. Fișierele „deținute” de fiecare pachet sunt listate ca să nu apară conflicte; unde două pachete ating același fișier, e precizat punctul exact de inserție.

### Pachet A — SEO tehnic în cod (`seo/pachet-a-tehnic`)

**Fișiere deținute**: `web/src/app/layout.tsx`, `web/src/app/not-found.tsx` (nou), `web/src/app/page.tsx` (doar metadata + JSON-LD), `web/src/app/c/[categorie]/page.tsx` (metadata, robots, notFound, link spre reduceri — NU zona de text, care e a lui B), `web/src/app/p/[slug]/page.tsx`, `web/src/app/reduceri-reale/[categorie]/page.tsx` (doar JSON-LD + link metodologie), `web/src/app/reduceri-reale/page.tsx` (nou), `web/src/app/sitemap.ts` (+ eventual `web/src/app/sitemap/…`), `web/src/app/cautare/page.tsx` (metadata), `web/src/app/t/[slug]/page.tsx` (metadata), `web/src/components/ProductCard.tsx`, `web/src/components/Footer.tsx` (doar adăugare linkuri), `web/src/lib/queries.ts` (query-uri noi), `web/src/lib/seo/*` (nou: helperi), `web/src/lib/guides/jsonld.ts` (doar `productLd`).

**A1. Layout fără canonical/robots globale**
- `layout.tsx:42-43`: șterge `robots` și `alternates.canonical`. Adaugă `openGraph` complet aici + un helper `web/src/lib/seo/og.ts` (`withOg({title, description, url, type})`) care repetă `siteName: 'superieftin.ro'`, `locale: 'ro_RO'`, `type` — folosit de `/c/`, `/p/`, `/t/`, `/reduceri-reale/`.
- Verifică că fiecare pagină indexabilă are canonical propriu: `/`, `/c/`, `/p/`, `/t/`, `/reduceri-reale/*`, `/ghiduri*`, `/despre`, `/contact`, `/ghiduri/metodologie` (deja au). `/confidentialitate`, `/termeni`, `/cookies` au deja canonical propriu (verificat în cod) → **nu le atinge**.
- Acceptare: `curl` pe `/nu-exista` și `/p/nu-exista` → un singur `<meta name="robots" content="noindex">`, fără `<link rel="canonical">`; `/cautare?q=x` → fără canonical.

**A2. `not-found.tsx` în română**
- Titlu „Pagina nu există”, H1, linkuri spre categoriile principale, `/reduceri-reale`, `/ghiduri`, formular de căutare (GET `/cautare`). `robots: { index: false }`. Status rămâne 404.

**A3. Pagini de categorie `/c/[categorie]`**
- Metadata din `category.name` (deja adus de `getCategoryBySlug`), nu din slug: titlu `${name} — prețuri, istoric și reduceri reale` (≤60 car. unde se poate); descriere cu cifre live din `getCategoryProductCount` + nr. mărci + prețul minim, ex. „756 de telefoane mobile de la 4 magazine, cu istoric de preț. Vezi prețul de azi față de mediana ultimelor 30 de zile.” — **fără** „reduceri garantate”/procente.
- Paginare: `?page=N` (N≥2) → canonical `/c/<slug>?page=N`, titlu cu sufix „— pagina N”; `N > totalPages` (și totalPages≥1) → `notFound()`.
- `?sort=`/`?tot=1` → canonical spre varianta fără ele (cum e acum). `?brand=` → `robots: { index: false, follow: true }` (până la D5).
- `totalCount === 0` și fără selecția aleatorie → `robots: { index: false, follow: true }`.
- `getCategoryBySlug`: categoriile cu `is_visible = false` → 404 (query nou sau filtru în pagină; nu schimba semnătura folosită de admin).
- Sub header, link vizibil „Vezi doar reducerile reale din <categorie> →” spre `/reduceri-reale/<slug>` (doar dacă categoria nu e în `sanatate-naturale`, ca la sitemap).
- Acceptare: `/c/telefoane-accesorii` title conține „Telefoane & Accesorii”; `/c/monitoare` are `noindex`; `/c/telefoane-mobile?page=2` canonical `?page=2`; `?page=999` → 404.

**A4. Pagina de produs `/p/[slug]`** (atenție §0 — nu se modifică niciun text existent)
- JSON-LD `Product`:
  - `offers`: dacă ≥1 ofertă → `AggregateOffer` (`lowPrice`, `highPrice`, `offerCount`, `priceCurrency: 'RON'`, `availability`) cu `offers: Offer[]` în interior; fiecare `Offer.url` = URL-ul paginii `/p/<slug>` (NU `/go/`).
  - `url`, `sku` = id produs, `mpn` = `part_no` (dacă există; extinde `getProductDetail` să-l aducă), `gtin13` doar dacă există coloană EAN validă (13 cifre); `brand` doar când există; `itemCondition` = `RefurbishedCondition`/`UsedCondition` dacă produsul are tag-ul refurbished/second-hand, altfel `NewCondition`.
  - Fără oferte → **nu** emite `Product` (ca în `lib/guides/jsonld.ts:87-88`).
  - Aceeași corectură `Offer.url` în `lib/guides/jsonld.ts:97-104`.
- Breadcrumb (JSON-LD + vizibil): Acasă → <Părinte> → <Categorie (nume)> → produs. Extinde `getProductDetail` cu `category_name`, `parent_slug`, `parent_name` (JOIN pe `categories` prin `category_id`).
- Bloc nou **„Pe scurt despre preț”** (sub „Istoricul prețului”, NU deasupra butoanelor): 2–3 fraze generate din date, ex. „În ultimele 90 de zile, cel mai mic preț înregistrat a fost 129,99 lei (12 august 2026), iar cel mai mare 149,99 lei. Mediana ultimelor 30 de zile: 138,99 lei. Ultima verificare: 3 octombrie 2026, la evomag.ro.” Fără verdict/promisiuni; dacă istoricul are <2 puncte: „Urmărim prețul din <data primului punct>.” Folosește aceleași valori ca graficul (`history`, `bestOffer.median_price`).
- Bloc nou **„Alte variante”**: produse disponibile din aceeași categorie cu numele normalizat identic după eliminarea culorii/ultimului segment (query nou în `queries.ts`, cache 3600, max 8, `OFFER_AVAILABLE_SQL`). Doar linkuri + preț.
- Bloc nou **„Produse similare”**: 6 produse disponibile din aceeași categorie (același brand întâi, preț apropiat ±30%), query nou cu cache.
- Meta description: adaugă un fapt („mediana 30 de zile: X lei” dacă există) fără cuvântul „reducere” — la produsele din §0 descrierea poate fi schimbată (nu e text de anunț), dar păstrează mențiunea magazinului.
- `og:type` corect prin helperul din A1.
- Acceptare: Rich Results Test / validator schema.org fără erori pe 3 produse (unul cu brand, unul fără, unul indisponibil fără `Product`); `npm run ads:validate` trece; textele existente neschimbate (diff doar adăugiri).

**A5. Ierarhia de headings**
- `ProductCard.tsx:44`: `<h2>` → `<h3>` (aceleași clase). Verifică paginile care folosesc cardul fără un H2 de secțiune deasupra (`/c/`, `/reduceri-reale/`, `/cautare`, `/t/`) și adaugă un `<h2 className="sr-only">Produse</h2>` unde lipsește.

**A6. Entitate + homepage**
- `layout.tsx` (sau component `web/src/components/seo/SiteJsonLd.tsx`): `Organization` cu `@id: SITE_URL#organization`, `name: 'superieftin.ro'`, `legalName`, `url`, `logo` (în `web/public/` nu există un logo — doar SVG-urile implicite Next; creează `web/public/logo.png` pătrat ≥112 px din logo-ul din header, sau omite `logo` și notează în PR), `email`, `address`, `taxID` din `lib/company.ts`, `sameAs: []` (gol până la E5). `WebSite` mutat din `page.tsx:65-76` cu `@id: SITE_URL#website`, `publisher: {@id: …#organization}`, `inLanguage: 'ro-RO'`, URL-uri din `SITE_URL`.
- `lib/guides/jsonld.ts` `publisherLd()` → referință la același `@id`.
- Homepage: `title: { absolute: 'superieftin.ro — comparator de prețuri cu istoric și reduceri reale' }`; descrierea cu cifre live (nr. produse urmărite, nr. magazine). H1 rămâne (design) — opțional un `<p>` sub el cu „Comparator de prețuri cu istoric pentru magazinele online din România”.

**A7. Sitemap**
- Împarte în sitemap index: `sitemap.ts` cu `generateSitemaps()` (Next 16 — citește `node_modules/next/dist/docs/` pentru API-ul exact, conform `web/AGENTS.md`): `0` = statice + ghiduri + `/c/` (părinți **și subcategorii**) + `/t/` + `/reduceri-reale/*` + hubul nou; `1..n` = produse câte 10.000. Actualizează `robots.ts` să listeze fiecare sitemap (sau un index `/sitemap.xml` prin route handler dacă API-ul nu-l generează) — ambele variante sunt ok, alege una și documenteaz-o în CLAUDE.md.
- Exclude `/c/` cu 0 produse disponibile (aceeași regulă ca A3 noindex). Păstrează `sanatate-naturale` în `/c/` (SEO organic e permis), exclude-o doar din `/reduceri-reale/` (ca acum).
- `lastmod` real: produse = ultima schimbare de preț (`max(price_history.recorded_at)` unde prețul diferă de precedentul — dacă e prea scump, `max(offer_price_stats.computed_at)` NU, pentru că se recalculează des; varianta acceptabilă: `max(o.last_price_change_at)` dacă există coloana, altfel omite `lastmod` la produse); categorii/landing-uri: omite `lastModified` (mai bine nimic decât „acum”); ghiduri: `updated_at` (corect deja).
- Acceptare: `curl /sitemap.xml` (sau index) listează toate subcategoriile vizibile cu produse (`/c/telefoane-mobile`, `/c/laptopuri`, `/c/televizoare` …); niciun fișier >10.000 URL; `/c/monitoare` absent; produsele indisponibile absente.

**A8. Landing-uri `/reduceri-reale/`**
- `reduceri-reale/[categorie]/page.tsx`: adaugă `ItemList` (produsele afișate) + `BreadcrumbList` (Acasă → Categorie → Reduceri reale); linkul „Cum verificăm” (`:84`) poate rămâne spre `/despre` (text de landing de reclamă; nu schimba) — adaugă în schimb, jos, „Metodologia completă” spre `/ghiduri/metodologie`.
- Hub nou `web/src/app/reduceri-reale/page.tsx`: listă de categorii (fără Sănătate & Naturale) cu nr. de reduceri reale live, H1 „Reduceri reale azi, pe categorii”, explicația regulii (5% sub mediana 30 zile), `ItemList` + Breadcrumb, `force-dynamic` ca restul. Adaugă-l în sitemap și în llms.txt (coordonare cu D: D citește lista din aceeași funcție).
- Footer: adaugă „Reduceri reale” (`/reduceri-reale`) și „Metodologie” (`/ghiduri/metodologie`) în `FOOTER_LINKS` (doar adăugare; ordinea linkurilor de politici neschimbată).
- Homepage: link „Toate reducerile reale →” lângă secțiunea „Top reduceri reale” (`app/page.tsx:128`).

**A9. Căutare și tag-uri**
- `/cautare`: `robots: { index: false, follow: true }`; fără canonical.
- `/t/[slug]`: titlu/descriere cu cifre live, `noindex` dacă 0 produse, canonical propriu pe paginare (ca A3), adăugate în sitemap.

**A10. (opțional, dacă rămâne timp) Imagini**
- Nu activa optimizarea Next pentru toate imaginile (CPU pe VPS — vezi D8). Doar: primul card din hero-ul homepage-ului fără `loading="lazy"` (`fetchPriority="high"`).

**Teste A**: `cd web && npm test` + `npm run build` local + `npm run dev` (port 3000) și verificare cu `curl -s localhost:3000/<url> | grep -E 'canonical|robots|<title>|ld\+json'` pentru: `/`, `/c/telefoane-mobile`, `/c/telefoane-mobile?page=2`, `/c/telefoane-mobile?brand=Samsung`, `/c/monitoare`, `/p/<3 produse>`, `/reduceri-reale`, `/reduceri-reale/laptopuri`, `/nu-exista`, `/cautare?q=x`, `/sitemap.xml`. Validare JSON-LD: extrage scripturile și rulează `JSON.parse` + verificare manuală a câmpurilor; după deploy, Rich Results Test pe 3 URL-uri. `cd worker && npm run ads:validate` (pagini live — doar după deploy; local verifică manual că textele din §0 sunt neschimbate).
**Riscuri A**: sitemap index greșit → Google pierde URL-uri (verifică în GSC după deploy); query-urile noi pe `/p/` (variante/similare) trebuie să fie ieftine (indexuri pe `category_id`, LIMIT, `unstable_cache`) — amintește-ți incidentul din 26 sep cu `NOT EXISTS` corelat (`lib/availability.ts:23-25`); noindex pe categorii goale scoate din index `/c/monitoare` etc. (dorit; revin automat când CITGrup revine).

---

### Pachet B — Texte pe categorii (`seo/pachet-b-texte-categorii`)

**Fișiere deținute**: `db/migrations/030_category_content.sql` (nou), `web/src/lib/category-content.ts` (nou: query + randare marcaje), `web/src/components/CategoryIntro.tsx` + `CategoryFaq.tsx` (noi), `content/categorii/<slug>.json` (noi), `worker/src/scripts/import-category-content.ts` (nou) + script npm `categorii:import`, admin opțional. În `web/src/app/c/[categorie]/page.tsx` atinge **doar** două puncte: `<CategoryIntro>` imediat după `</div>` de header (după `:167`) și `<CategoryFaq>` după grila de produse (după `:302`) + JSON-LD `FAQPage` emis din `CategoryFaq`. (Dacă A e deja pe main, rebase; conflictul e minim.)

**Ce exact**
1. Migrația `030_category_content.sql`: pe `categories` adaugă `intro_md TEXT`, `faq JSONB NOT NULL DEFAULT '[]'`, `content_updated_at TIMESTAMPTZ`. (Coloana `description` existentă rămâne neatinsă — e folosită ca descriere scurtă/meta dacă vrei; nu e necesar.)
2. Marcaje live pentru categorie (randate pe server, ca la ghiduri, în `lib/category-content.ts`; necunoscut → eroare la import):
   `{{cat:produse}}` (nr. produse disponibile, inclusiv subcategorii pe părinți), `{{cat:magazine}}`, `{{cat:branduri-top}}` (top 5 mărci după nr. produse), `{{cat:pret-min}}`, `{{cat:pret-median}}`, `{{cat:reduceri}}` (nr. reduceri reale acum — dacă 0, fraza care îl conține trebuie scrisă neutru: „Acum sunt {{cat:reduceri}} produse…” e ok), `{{cat:istoric-de-la}}` (luna/anul primei înregistrări). Toate cu `OFFER_AVAILABLE_SQL` și `offer_price_stats` (fără `PERCENTILE_CONT` pe istoric — CLAUDE.md „Mediana precalculată”). Cache `unstable_cache` 3600 s, tag `products`.
3. Randare: Markdown cu același `renderMarkdown` (`lib/guides/markdown.ts`, `html: false`). Intro-ul apare **doar** pe pagina 1, fără `?brand`/`?sort`/`?tot` (altfel text duplicat pe variante). FAQ: `<h2>Întrebări frecvente despre <categorie></h2>` + `<h3>` per întrebare + `FAQPage` JSON-LD (textul răspunsului randat cu cifrele reale, fără Markdown).
4. Conținut: `content/categorii/<slug>.json` = `{ slug, intro_md, faq: [{q,a}], review: { facts: [...], checklist: [...] } }` pentru cele **14 categorii** din §2.12 (rândurile 1–13 + hubul `animale-de-companie`; `t/refurbished` doar după revenirea CITGrup) + 3 părinți-hub cu intro scurt (`telefoane-accesorii`, `laptopuri-calculatoare`, `tv-audio`). Per categorie:
   - Intro 90–150 de cuvinte: ce găsești, ce urmărim (istoric zilnic, mediana 30 zile, ce înseamnă „reducere reală” — o frază + link `/ghiduri/metodologie`), 1–2 fraze cu marcaje (`{{cat:produse}}`, `{{cat:magazine}}`, `{{cat:pret-median}}`), un sfat de cumpărare factual, nespecific de brand (ex. TV: „diagonala se alege după distanța de privire”), link spre ghidul legat (dacă există/va exista) și spre `/reduceri-reale/<slug>`.
   - 3–5 FAQ, întrebări pe care oamenii le caută realmente (ex. „Cât costă un televizor de 55 inch?” → răspuns cu `{{cat:pret-median}}` doar dacă marcajul are sens pe categorie; altfel răspuns calitativ), „Când e cel mai bun moment să cumperi…?” → răspuns care explică cum citești graficul de pe pagina produsului, **fără** „la Black Friday scade sigur”.
   - Interzis: promisiuni de reduceri („cele mai mici prețuri garantate”, „economisești X%”), procente sau prețuri scrise de mână, „compară N magazine” acolo unde produsele au un singur magazin (vezi §2.6 — formulează „urmărim prețurile de la {{cat:magazine}} magazine”), afirmații de sănătate (inclusiv la animale: fără „sănătos”, „digestie”, „previne”, „veterinar recomandă”), Sănătate & Naturale.
   - Animale (`hrana-uscata`, `hrana-umeda`, `jucarii-pet`, `animale-de-companie`): istoric de la 03.10 → nu afirma că există reduceri/mediană relevantă; scrie „urmărim prețurile zilnic din octombrie 2026”.
   - Corectează numele categoriei „Elecrocasnice” → „Electrocasnice” **doar în `name`** (slug-ul rămâne; redenumirea slug-ului e D1) — prin importer (UPDATE explicit pe `name`), cu mențiune în PR.
5. Importer (model: `content/ghiduri/README.md` + `worker/src/lib/guide-drafts.ts`): plan implicit, `--confirm` scrie, totul-sau-nimic, validează marcajele și cuvintele interzise (listă: `garantat`, `cel mai mic preț din România`, `economisești`, `%` scris de mână, cifre urmate de „lei”, `vindecă|tratează|detoxifică|sănătos|imunitate`). La scriere: `revalidateTag('categories')` nu ajunge din worker → după import pe prod: `docker compose up -d --force-recreate web` (CLAUDE.md „Cache gotcha”) — documentează în README.
6. Actualizează CLAUDE.md (secțiune scurtă: migrația 030, marcajele `{{cat:…}}`, comanda de import).

**Criterii de acceptare**: 14 + 3 fișiere JSON valide; importul local în plan arată 17 categorii; `/c/telefoane-mobile` (pagina 1) afișează intro + FAQ cu cifre egale cu cele din header (`756 produse`); `?page=2` și `?brand=` nu afișează intro/FAQ; `FAQPage` valid; niciun cuvânt interzis (testul importerului); intro-ul nu apare pe `/c/` din Sănătate & Naturale (nu au fișier).
**Teste**: `cd worker && npm test` (teste noi pentru validatorul de marcaje/cuvinte), `cd web && npm test` (test pentru randarea marcajelor cu date fictive), dev local cu DB local (migrația prin `worker/src/migrate.ts`).
**Riscuri**: migrație pe prod = deploy cu rebuild `migrate` (CLAUDE.md); query-urile pentru marcaje pe părinți (agregat pe subcategorii) — folosește aceleași filtre ca `getCategoryProductCount(…, includeSub=true)`; text identic între categorii surori = conținut duplicat → fiecare intro scris separat.

---

### Pachet C — Ghiduri (`seo/pachet-c-ghiduri`)

**Fișiere deținute**: `content/ghiduri/drafts/*.json` (cele existente + 3 noi). Fără cod. Fluxul și formatul: `content/ghiduri/README.md`.

**C1. Ciorne existente — reparare** (fișierele din `content/ghiduri/drafts/`; reimportul ca draft suprascrie ciorna din DB — confirmă întâi cu un SELECT că `updated_at` din DB = 27.09, adică nimeni n-a editat-o în admin; dacă diferă, NU reimporta, notează):
- `samsung-galaxy-s26-ultra-256gb-ghid` (id 5) și `merita-samsung-galaxy-z-fold7` (id 4): verifică faptele marcate în `review.facts` cu status `de_verificat` pe samsung.com/ro (IP68, 60 W, greutate, grosime, încărcare) → `confirmat` cu URL sau rescrie fraza; nu schimba nimic altceva.
- `lg-oled-c6-vs-samsung-oled-s90f-55` (id 3): rezolvă cele 4 `[DE VERIFICAT]` (sursă oficială lg.com/ro, samsung.com/ro) sau șterge rândul/fraza; verifică „DV rulează în HDR10 pe Samsung”. Dacă LG C6 (id 136770) nu are ofertă disponibilă în momentul lucrului, adaugă în `review.warnings` riscul eMAG.
- `laptopuri-pentru-studenti-si-birou` (id 2): înlocuiește HP 15-fd0089nq (id 96034, indisponibil) cu un laptop **evomag/ITGalaxy disponibil** din același segment (verifică prin SELECT cu `OFFER_AVAILABLE_SQL`); rezolvă cele 8 `[DE VERIFICAT]`; scoate „ordonate după nivelul de preț” sau reformulează („în ordinea profilului de utilizare”); preferă produse non-eMAG pentru stabilitate.
- Import pe prod ca draft (comanda din README, întâi fără `--confirm`, apoi cu). Ghidul publicat (id 1) nu se atinge (importerul îl sare oricum).

**C2. Trei ghiduri noi** (`kind`, produse disponibile non-eMAG verificate prin SELECT la momentul scrierii, 1.000–1.600 cuvinte, „Pe scurt” 2–4 fraze cu răspunsul direct, H2 sub formă de întrebări, ≥1 tabel comparativ Markdown, 5 FAQ, `review.facts` cu surse, `[DE VERIFICAT: …]` acolo unde nu ești sigur):
1. **`reduceri-reale-black-friday-cum-verifici`** — „Black Friday 2026: cum verifici dacă o reducere e reală” (`kind: categorie`, `category_slug: null`). De ce: cerere sezonieră mare (nov.), subiect citat de presă/AI (Consiliul Concurenței, „prețul de referință = cel mai mic din ultimele 30 de zile”) și noi avem exact metoda + date. Conținut: regula legală a prețului anterior (Directiva Omnibus transpusă în RO — **[DE VERIFICAT: actul normativ și articolul exact]**, sursă oficială), diferența „minimul 30 zile” (regula magazinului) vs „mediana 30 zile” (regula noastră) cu un exemplu explicat în cuvinte, pași concreți (graficul, mediana, alerta de preț), 3–4 exemple live `{{istoric-pret:…}}` / `{{reducere:…}}` pe produse cu istoric bogat (televizoare/laptopuri evomag, încărcătoare ITGalaxy). Fără statistici agregate scrise de mână („X% din reduceri…”) — nu avem marcaj pentru ele. Fără promisiunea că vor fi reduceri.
2. **`televizor-43-50-55-65-inch-ce-diagonala`** — „Ce televizor să cumperi: 43, 50, 55 sau 65 inch și cât costă” (`kind: categorie`, `category_slug: televizoare`). Date: 702 disponibile, 63 reduceri reale, istoric din 14.06; median pe diagonale (55" ~3.000, 65" ~4.130, 43" ~1.700, 50" ~2.160 lei — **nu le scrie în text**, folosește `{{pret:…}}` pe produse reprezentative). Structură: distanța de privire → diagonală, rezoluție/panou (LED, QLED, OLED, Mini LED) pe scurt, câte un produs reprezentativ pe diagonală (`{{oferte:…}}`), `{{comparatie:…}}` pentru 55", link spre ghidul LG C6 vs S90F (dacă se publică) și spre `/reduceri-reale/televizoare`, `/c/suport-tv`.
3. **`incarcator-usb-c-gan-ce-putere`** — „Încărcător USB-C: ce putere îți trebuie (20 W, 45 W, 65 W) și ce înseamnă GaN” (`kind: categorie`, `category_slug: incarcatoare-cabluri`). Date: 1.334 disponibile, 106 reduceri reale (cel mai mare număr în afara Sănătate), istoric din 12.06, mărci Baseus/UGREEN/Hama/Samsung/Apple. Structură: puterea după dispozitiv (telefon/tabletă/laptop), PD/PPS, de ce contează cablul (60 W vs 100/240 W), GaN pe scurt, tabel „dispozitiv → putere minimă” (fapte tehnice cu surse oficiale USB-IF/producători), 4–6 produse `{{oferte:…}}`, link spre ghidurile de telefoane.
   - Rezerve (dacă unul din cele 3 nu are produse stabile): „Telefon bun până în 1.500 lei în 2026” (atenție la 226 de telefoane fără brand), „Suport TV de perete: VESA, greutate, fix sau articulat” (89 reduceri reale), „Laptop gaming ieftin 2026” (nișă fără concurență RO).
- Import pe prod ca draft (README). **Nu publica** — vezi D3.
- Autor/verificator: importerul pune „Echipa Superieftin.ro” / „Adrian”. Pentru E-E-A-T, proprietarul completează bio + URL pentru „Adrian” (E6).

**Criterii de acceptare**: `npm run ghiduri:import -- ../content/ghiduri/drafts` (plan) fără erori local **și** pe prod (slug-urile de produs există pe prod); zero cuvinte de sănătate; zero prețuri/procente scrise de mână (grep `[0-9] ?lei|%` în `body_md`/`summary`/`faq` → doar în marcaje); `[DE VERIFICAT` rămâne doar unde chiar e nesigur (blochează publicarea — intenționat); fiecare ghid are link intern spre ≥1 `/c/` și `/reduceri-reale/`.
**Riscuri**: produse eMAG devin indisponibile în 3 zile fără scanare manuală → blocurile live arată „indisponibil”; un reimport suprascrie editările făcute în admin (verifică `updated_at` întâi); afirmația juridică din ghidul 1 trebuie confirmată de proprietar.

---

### Pachet D — Acces roboți AI + llms.txt (`seo/pachet-d-ai`)

**Fișiere deținute**: `web/src/app/robots.ts`, `web/src/app/llms.txt/route.ts`, `web/src/app/llms-full.txt/route.ts` (nou), `web/src/lib/seo/site-facts.ts` (nou: cifre live comune, cache 3600 — poate fi refolosit de A pe homepage, dar D îl creează; dacă A ajunge primul pe main, refolosește-l).

**D1. robots.ts**
- Păstrează grupul `*` neschimbat. Adaugă grupuri explicite pentru `GPTBot`, `OAI-SearchBot`, `ChatGPT-User`, `ClaudeBot`, `Claude-SearchBot`, `Claude-User`, `PerplexityBot`, `Perplexity-User`, `Google-Extended`, `Applebot-Extended`, `CCBot`, `Bingbot` cu **aceleași** `Allow: /` + `Disallow: /go/` + `Disallow: /api/` — ATENȚIE: un robot care are grup propriu NU mai citește grupul `*`, deci disallow-urile trebuie repetate în fiecare grup (altfel le-am deschide `/go/` — interzis). Rostul: semnal explicit de permisiune și protecție dacă Cloudflare activează vreodată robots gestionat.
- Opțional (comentat în cod, decide E1): `Content-Signal: search=yes, ai-input=yes, ai-train=yes` (convenția Cloudflare) — Next `MetadataRoute.Robots` nu suportă directive custom → dacă se vrea, `robots.txt` devine route handler; **nu** face asta fără motiv.
- Acceptare: `curl localhost:3000/robots.txt` conține fiecare grup cu `Disallow: /go/`; test unitar care parsează ieșirea și verifică pentru fiecare UA că `/go/123` e interzis și `/p/x` permis.

**D2. llms.txt (rescriere, același URL)**
- Antet: nume, o frază „ce este”, **fapte live** din `site-facts.ts`: nr. produse urmărite (disponibile), nr. magazine active, de când avem istoric (prima înregistrare), nr. reduceri reale acum, data generării (Europe/Bucharest).
- „Cum funcționează” (păstrează metodologia actuală, corectă) + o frază onestă: „Majoritatea produselor au o singură ofertă monitorizată; valoarea principală e istoricul de preț și comparația cu mediana.”
- „Ce date găsești pe o pagină de produs”: preț azi per magazin, data verificării, mediana 30 zile, minim/maxim 90 zile, verdict (reducere reală / interval obișnuit / peste mediană).
- Secțiuni: Pagini principale (Despre, Metodologie, Contact, Ghiduri, `/reduceri-reale` hub — dacă există, altfel omite), Ghiduri (toate publicate, cu meta), **Categorii** (`/c/<slug>` pentru părinți și subcategorii cu produse, cu nr. de produse; include Sănătate & Naturale — SEO organic e permis — dar fără landing de reduceri, ca acum), Reduceri reale pe categorii (ca acum), Operator (Digital Pro Shop SRL, contact@superieftin.ro din `lib/company.ts`), Sitemap.
- „Note pentru asistenți”: prețurile se schimbă zilnic — citați cu data; reducere reală = definiția; linkurile spre magazine sunt de afiliere.
- `Cache-Control: public, max-age=3600` (ca acum).
- **D3. `llms-full.txt`**: conținutul llms.txt + textul integral (Markdown) al paginilor Despre, Metodologie și al ghidurilor publicate (`summary` + `body_md` cu marcajele înlocuite prin text simplu „vezi prețul live pe <URL>” — nu randa prețuri aici, ca să nu fie citate prețuri vechi). Link spre el din llms.txt.
- Acceptare: `curl localhost:3000/llms.txt` < 20 KB, conține `/c/telefoane-mobile`, `/ghiduri/metodologie`, contact, cifre ≠ 0; `llms-full.txt` conține textul ghidului publicat; zero `{{`.
**Riscuri**: query-urile pentru fapte trebuie să fie ieftine (cache; fără agregări pe `price_history` — pentru „de când avem istoric” folosește `min(recorded_at)` cu index sau o constantă documentată); Sănătate & Naturale în llms.txt e ok pentru organic, dar nu crea landing-uri de reduceri pentru ea.

---

### Pachet E — Pași manuali pentru proprietar

**E1. Cloudflare — permite roboții AI** (cauza 403-urilor din §2.1):
1. dash.cloudflare.com → domeniul `superieftin.ro` → **AI Crawl Control** (în unele conturi: *Security → Bots* sau *AI Audit*).
2. Tab-ul **Crawlers**: pentru `GPTBot` (OpenAI), `ClaudeBot` (Anthropic), `PerplexityBot`, `OAI-SearchBot`, `Google-Extended`, `Applebot-Extended`, `CCBot`, `Meta-ExternalAgent`, `Amazonbot` → **Allow** (decizia ta: „îi permitem”; `Bytespider` poate rămâne Block — e agresiv și nu aduce trafic).
3. *Security → Settings* (sau *Bots*): **„Block AI bots” / „Block AI Scrapers and Crawlers” → Off** (sau „Do not block”). Dacă e setat „Block on all pages”, el bate setările per-crawler.
4. **Managed robots.txt** (AI Crawl Control → robots.txt): lasă **dezactivat** (al nostru e corect; cel gestionat adaugă `Disallow` pentru AI).
5. *Security → Bots → Bot Fight Mode*: poate rămâne pornit (nu blochează roboții verificați), dar dacă după pașii 2–3 GPTBot tot primește 403/challenge, oprește-l și verifică *Security → WAF → Custom rules* pentru reguli pe `cf.verified_bot_category` sau user-agent.
6. **Nu atinge** regulile care protejează `/go/` (rate-limit, token) — sunt în aplicație, nu în Cloudflare; dacă există o regulă WAF pe `/go/`, las-o.
7. Verificare (din terminal): `curl -s -o /dev/null -w "%{http_code}\n" -A "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)" https://www.superieftin.ro/` → `200` (la fel cu `ClaudeBot/1.0`). În AI Crawl Control → *Metrics* ar trebui să apară cereri „Allowed”.

**E2. Google Search Console**
- Trimite sitemap-ul nou (după deploy A7) și scoate-l pe cel vechi dacă URL-ul se schimbă.
- *Pages*: urmărește „Duplicate, Google chose different canonical” (ar trebui să scadă după A1/A3) și „Soft 404” (`/c/monitoare` etc.).
- *URL Inspection* → „Request indexing” pentru: `/`, `/c/telefoane-mobile`, `/c/laptopuri`, `/c/televizoare`, `/reduceri-reale`, ghidurile nou publicate.
- Rich Results Test pe 2–3 `/p/` după A4 (Product/merchant listing — ar putea apărea ca „Product snippets”).
- Așteaptă-te la scădere de „pagini indexate” după 27 oct (410 pe ~24.800 produse) — e dorit.

**E3. Bing Webmaster Tools** (alimentează Copilot și ChatGPT search parțial)
- bing.com/webmasters → *Import from Google Search Console* (cel mai rapid) → trimite sitemap-ul.
- **IndexNow**: generează o cheie (32 hex), pune `INDEXNOW_KEY=<cheie>` în `.env` pe VPS, recreează containerul web → verifică `https://www.superieftin.ro/indexnow-key.txt` = 200 cu cheia. Codul de ping există deja la publicarea ghidurilor.

**E4. Mapare produse** (Admin → Mapare → „Vezi ce conține”): produsele de tip adaptor/încărcător/cablu care apar în `telefoane-mobile` (primele rezultate la sortarea „Preț mic” pe `/c/telefoane-mobile`) → reguli „denumirea conține *adaptor*/*incarcator*/*cablu* → incarcatoare-cabluri”. Afectează ItemList-ul și prima impresie a categoriei.

**E5. Prezență externă (entitate pentru AI)**
- Creează profiluri minime cu același nume/logo/descriere: Facebook Page, LinkedIn Company, eventual X/Instagram → trimite URL-urile, ca să fie puse în `Organization.sameAs` (A6).
- Un studiu cu datele noastre înainte de Black Friday (ex. „Cât de des a fost prețul de Black Friday sub mediana pe 30 de zile la televizoare, 2026”) trimis la gadget.ro, wall-street.ro, economedia, playtech — e exact modul în care Consiliul Concurenței a ajuns în toate răspunsurile AI pe subiect. Postări utile (nu spam) pe forum.softpedia / r/Romania când cineva întreabă de prețuri, cu link spre graficul produsului.
- Listări în articolele „comparatoare de prețuri România”.

**E6. E-E-A-T**: Admin → Ghiduri → autori: completează pentru „Adrian” bio (1–2 fraze: cine e, ce experiență are cu prețurile/electronicele) și URL (pagina `/despre#echipa` sau LinkedIn). Opțional, o secțiune „Cine suntem” mai bogată pe `/despre` (pagina e permisă, dar o modifici tu sau cere explicit).

**E7. Publicare ghiduri**: după C, din Admin → Ghiduri: deschide ciornele 5 și 4 → bifează checklist-ul → „Publică”; apoi 3 și 2 dacă nu mai au `[DE VERIFICAT]`; ghidurile noi după ce citești faptele din „Fișa de verificare”.

---

## 4. De decis de proprietar

| # | Subiect | Variante | Recomandare |
|---|---|---|---|
| D1 | Slug-ul `elecrocasnice` (greșit) | (a) lași slug-ul, corectezi doar numele (B face asta); (b) redenumești slug-ul în `electrocasnice` + `RENAMED_CATEGORIES` (308) | (b) acum, cât categoria e nouă și are puține linkuri; e schimbare de URL → doar cu acordul tău |
| D2 | Blocare `Bytespider`, `CCBot` | permiți tot / blochezi doar Bytespider | Blochează Bytespider, permite restul |
| D3 | Publicarea ghidurilor de către agenți | (a) agenții doar importă ca draft, tu publici din admin (2 min/ghid); (b) agenții publică prin SQL după ce rezolvă tot | (a) — poarta cu checklist e făcută special pentru verificare umană; (b) o ocolește |
| D4 | `/reduceri-reale/<x>` fără nicio reducere | rămân `index` (acum) / `noindex` când 0 reduceri | `noindex` ar fi mai curat pentru SEO, dar `ads-guard` pune pe pauză grupurile al căror landing e `noindex` → doar dacă accepți asta pentru `/reduceri-reale/laptopuri` |
| D5 | Pagini indexabile brand × categorie (ex. `/c/telefoane-mobile?brand=Samsung` → `/c/telefoane-mobile/samsung`) | nu / da pentru top 20 combinații cu ≥20 produse | Da, într-o etapă următoare: e principalul avantaj al price.ro/okazii; cere URL-uri noi + texte |
| D6 | Variante de culoare / duplicate (168 + 49 grupuri, ex. S26 Ultra în 45 de produse) | (a) doar linkuri „Alte variante” (A4); (b) canonical spre varianta principală; (c) pagină de model care grupează variantele | (a) acum; (c) pe termen mediu. (b) atinge paginile din campanii (ex. iPhone 17 Pro Max Cosmic Orange vs Deep Blue) → decizia ta |
| D7 | Titluri `/p/` cu prețul în titlu | păstrezi / „<Model> — preț și istoric de preț” | Păstrează pentru moment (CTR bun); schimbarea atinge titlurile paginilor din reclame |
| D8 | Optimizarea imaginilor (Next Image pe CDN-urile magazinelor) | nu / da cu `remotePatterns` + cache | Măsoară întâi CPU-ul pe VPS; LCP mai bun, dar risc de CPU la valuri de roboți |
| D9 | Text pe `/t/refurbished` | acum / după revenirea CITGrup | După revenirea feed-ului (azi aproape fără produse refurbished disponibile) |
| D10 | Linkul „Cum verificăm” de pe `/reduceri-reale/*` spre `/despre` | lași / schimbi spre `/ghiduri/metodologie` | Lasă-l (e pe landing de reclamă); A adaugă un link suplimentar jos |
| D11 | Pagini „preț <model>” tip mobilissimo (agregare pe model, cu tabel variantă × magazin) | — | Proiect separat după D6(c) |

---

## 5. Anexă — comenzi folosite (reproducibile, doar citire)

```bash
UA_GPT='Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)'
curl -s -D - -o /dev/null -A "$UA_GPT" https://www.superieftin.ro/            # 403, server: cloudflare
curl -s https://www.superieftin.ro/sitemap.xml | grep -o '<loc>[^<]*</loc>' | grep -c '/c/'   # 6
curl -s https://www.superieftin.ro/nu-exista | grep -oE '<meta name="robots"[^>]*>|<link rel="canonical"[^>]*>'
curl -s -o /dev/null -w '%{http_code}\n' https://www.superieftin.ro/indexnow-key.txt          # 404
```
Datele din DB: SELECT-uri pe `categories`, `products`, `offers` (`OFFER_AVAILABLE_SQL`), `offer_price_stats`, `guides`, `guide_authors`, `guide_products` — 2026-10-04.
