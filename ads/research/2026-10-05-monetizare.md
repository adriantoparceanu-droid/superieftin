# Monetizare dincolo de afilierea actuală — research (5 oct. 2026)

> Autor: agentul market-research. Doar citire: DB-ul de producție (SELECT, sesiune read-only),
> WebSearch/WebFetch. Nimic implementat, nimeni contactat, nimic scris în DB sau în conturi.
> AdSense e exclus prin decizia proprietarului; nu e reluat aici.

---

## 1. Rezumat executiv

1. **Problema de acum nu e modelul de monetizare, ci audiența.** Site-ul are ~200 de vizitatori
   reali pe lună (GA4, sept.), 0 clickuri organice din Google în sept.–oct. și ~20–40 de clickuri
   umane spre magazine pe lună. La volumul ăsta, ORICE model (CPC de la magazine, abonamente,
   newsletter sponsorizat, display) aduce sub 100 lei/lună. Comisioanele aprobate până azi: **12,16 lei**
   (plus 507 lei în așteptare, din care 394 lei = o singură comandă eMAG).
2. **Recomandarea #1 — Black Friday 2026 (eMAG: 6 noiembrie) ca moment de creștere, nu doar de vânzare:**
   pagină „Reduceri reale de Black Friday, verificate față de mediana pe 30 de zile” + lista de email
   construită acum (alertele există deja, double opt-in). E singurul lucru care poate muta și traficul,
   și comisioanele în următoarele 5 săptămâni, cu efort mic și fără risc nou.
3. **Recomandarea #2 — lărgește afilierea în rețelele pe care le ai deja** (importerele există):
   programe cu comision mai bun decât IT-ul (Noriel 7% pentru Crăciun, Libris 8%, Giftspot 7%),
   plus verificarea în panouri dacă Altex / Flanco / Cel.ro au program activ la care poți aplica;
   apoi coduri de reducere din `affiliate-vouchers` (Profitshare), afișate doar dacă sunt valabile.
4. **Recomandarea #3 — validează un venit B2B care NU depinde de trafic:** rapoarte / monitorizare de
   prețuri pentru magazine mici sau branduri (benchmark: Prisync 99–399 USD/lună). Doar ca pilot cu
   1–2 clienți și numai după o verificare juridică a dreptului de a folosi datele (feed-urile
   rețelelor și scanarea eMAG au restricții).
5. **Nu recomand acum:** CSS Google Shopping (cere ≥50 de domenii de magazine; tu ai ~10), cashback,
   abonament premium, extensie de browser, aplicație mobilă, listări plătite / poziții sponsorizate
   (prea puțin trafic ca magazinele să plătească; plus risc pentru credibilitatea „reducere reală”).

---

## 2. Cifrele interne (producție, citite pe 5 oct. 2026)

### 2.1 Trafic (GA4 — `ga4_daily`, `ga4_daily_breakdown`)

| Lună | Utilizatori | Sesiuni | Sesiuni implicate | Afișări pagini | Clickuri afiliere (GA4) |
|---|---:|---:|---:|---:|---:|
| iulie 2026 | 105 | 131 | 65 | 663 | 68 |
| august 2026 | 92 | 96 | 35 | 124 | 14 |
| septembrie 2026 | 183 | 199 | 75 | 748 | 46 |
| octombrie (1–4) | 18 | 29 | 15 | 228 | 21 |

- Surse ultimele 30 de zile (sesiuni / clickuri afiliere): direct 82/1, Google organic 52/7,
  Google Ads 19/7, **referral de la IP-ul VPS-ului 19/25 (trafic intern, de scăzut)**, ChatGPT 16/7,
  app.profitshare.ro 9/12 (probabil tot intern — verificări din panou).
- Concluzie: **clickuri umane reale spre magazine ≈ 20–40/lună** în GA4. GA4 numără doar vizitatorii cu
  acord de analiză, deci cifra reală poate fi de 2–3 ori mai mare — tot mică.
- ChatGPT aduce deja aproape la fel de mult ca Google organic → ghidurile + `/llms.txt` merită continuate.
- Desktop 276 sesiuni / mobil 179 (90 de zile); desktop face 70% din clickurile afiliate.

### 2.2 Google Search Console (`gsc_daily`)

| Lună | Clickuri | Afișări | Interogări distincte |
|---|---:|---:|---:|
| iulie | 6 | 1.509 | 561 |
| august | 6 | 1.093 | 333 |
| septembrie | **0** | 604 | 132 |
| octombrie (1–4) | 0 | 29 | 20 |

- Afișările **scad** din iulie. Pozițiile medii sunt 25–90 (pagina 3+). Interogările vizibile:
  „xiaomi 14t pro pret”, „honor magic 7 lite pret”, „samsung s26 ultra pret”, „telefoane la reducere”.
- Semnalează o problemă SEO de investigat separat (site-dev / SEO), nu de monetizare — dar fără trafic
  organic, nicio opțiune din raport nu scalează.

### 2.3 Clickuri pe `/go/` (`click_events`, `ad_clicks` cu `NOT is_internal`)

- `click_events`: sept. 35.037, oct. (1–5) 23.920 — **dominate de roboți** (15.491 pe 30 sept. și
  21.009 pe 1 oct., valul care a dus la protecția anti-roboți din 3 oct.). Din 4 oct.: 18 și 4 pe zi.
- `ad_clicks` neinterne: sept. 16.938, oct. 23.920 (Vegis 12.882 / 8.980!) — aceleași valuri de roboți;
  0 clickuri cu gclid. **Nu sunt utilizabile ca măsură a cererii.** Primele cifre curate vor fi cele de
  după 3 oct. (protecția token JS) — de urmărit 2–3 săptămâni.

### 2.4 Comisioane (`affiliate_conversions`)

| Rețea / magazin | Status | Nr. | Sumă (lei) | Perioadă |
|---|---|---:|---:|---|
| Profitshare / eMAG | aprobat | 2 | 11,37 | iul. |
| 2Performant / evomag | aprobat | 1 | 0,79 | iul. |
| Profitshare / eMAG | în așteptare | 7 | 507,69 | aug.–29 sept. |
| Profitshare / eMAG | respins | 9 | 389,32 | aug.–2 oct. |
| Profitshare / alt magazin | respins | 1 | 9,83 | aug. |

- **Total aprobat de la lansare: 12,16 lei.** În așteptare: 507,69 lei, din care **393,84 lei = o singură
  comandă** cu 13 produse (15 sept.). Fără ea, ritmul e de ~50–110 lei brut/lună.
- **Rata de respingere: 50% din comenzi, 43% din valoare.** 4 comenzi respinse au aceeași sumă (46,36 lei)
  — tipar de verificat în panou (comandă repetată/anulată de același client?).
- Toate cele 20 de comisioane au `hash` gol → **niciuna nu e legată de un click_id** de pe site, deci nu știm
  ce categorie/produs a convertit. `referrer_page` arată doar `https://www.superieftin.ro/` (browserele
  trimit doar domeniul), cu excepția primei comenzi, venită din bannerul eMAG (`/embed/banner/10`).
- Toate comenzile non-trivial sunt **eMAG** (comision până la 20% la unele categorii, cookie lung) —
  magazinul cu cel mai mare risc contractual (scanare + PPC interzis, risc asumat de proprietar).
- Google Ads: 59 lei cheltuiți (sept.–oct.), 30 de clickuri, 0 conversii.

### 2.5 Alerte și audiență proprie

- `price_alerts`: 10 pe Telegram (6 active), 4 pe email (active, confirmate); `notify_count` total = 3.
- `email_subscribers`: **1** abonat confirmat. `telegram_users`: 3.
- Căutări interne (`search_queries`): ~20/săptămână; termeni: „ryzen”, „fold7”, „lego”, „iphone 17”,
  „royal canin”, „nike/jordan/adidași” (încălțăminte — categorie pe care nu o acoperi), „polistiren”.

### 2.6 Catalog

- 76.501 produse; oferte în stoc: CITGrup 21.335 (magazin **pus pe pauză**), Petmart 13.132, Vegis 6.739
  (exclus din reclame — regula 8), evomag 5.815, ITGalaxy 2.556, eMAG 520, Rowenta 382, Vexio 59,
  Mindblower 47; ForIT 0 (pauză). Altex: rând în `retailers`, 0 oferte, inactiv.
- **1.162 de produse au acum o „reducere reală”** (preț ≤ 95% din mediana pe 30 de zile, magazin nepus pe pauză).
- 8 ghiduri publicate.
- Comisioane din `affiliate_advertisers` (valori maxime din API; reale pe categorie pot fi mai mici):
  eMAG 20%, ITGalaxy 10%, CITGrup 8%, Vegis 8%, Giftspot 7%, Alecoair 5%, Vexio 2%, ForIT 2%;
  2Performant: Kaelo 20%, Crabland 10%, Libris 8%, Noriel 7%, Petmart 5%, Casaidea 5%, Rowenta 4%,
  evomag 1,5%. Multe programe Profitshare sunt marcate `inactive` (neaplicat sau neacceptat).

### 2.7 Ce lipsește / nu e de încredere

- Clickuri umane curate (înainte de 3 oct. sunt amestecate cu roboți).
- Legătura comision ↔ click (hash gol pe toate) → nu știm ce categorii convertesc.
- Clickuri în panoul Profitshare (API-ul nu le dă) — doar proprietarul le poate vedea.
- GA4 numără doar vizitatorii cu acord → subestimează.

---

## 3. Context legal comun (se aplică la aproape toate opțiunile)

> Nu e consultanță juridică. Pentru opțiunile cu bani direct de la magazine (listări plătite,
> conținut sponsorizat, date B2B) merită o oră cu un jurist.

- **Legea 158/2008 (publicitate înșelătoare) + Legea 363/2007 (practici comerciale incorecte)**:
  orice conținut plătit trebuie marcat clar ca publicitate; amenzi ANPC de până la 30.000 lei
  ([playtech.ro](https://playtech.ro/2025/cum-sunt-reglementati-influencerii-in-romania-ce-legi-trebuie-sa-respecte-care-sunt-riscurile-pentru-vedetele-online-vlogger-bloggeri-youtuberi-si-tiktokeri/)).
- **OUG 58/2022 (transpunerea Directivei Omnibus)**: dacă ordinea produselor e influențată de plată,
  trebuie spus clar; trebuie explicați parametrii principali de clasare și justificate etichete ca
  „cel mai bun” / „recomandat” ([infocons.ro](https://infocons.ro/noi-modificari-si-norme-in-protectia-consumatorilor-din-28-mai-2022-ordonanta-58-2022/)).
  Pentru un comparator, asta înseamnă: o poziție plătită = etichetă „Sponsorizat” vizibilă + text pe
  `/metodologie` despre cum se clasează ofertele.
- **OUG 18/2026** (nouă, magazine online și marketplace-uri): transparență la clasare, interzicerea
  recenziilor false și a interfețelor manipulative, reduceri raportate la cel mai mic preț din 30 de zile
  ([capital.ro](https://www.capital.ro/noi-reguli-pentru-magazinele-online-si-marketplace-uri-ce-obligatii-introduce-oug-18-2026.html)).
  Nu e clar dacă se aplică direct comparatoarelor — dar „reducerea reală” e deja aliniată cu spiritul ei.
- **DSA**: superieftin.ro nu găzduiește conținut al utilizatorilor, deci probabil nu e „platformă online”
  în sensul DSA; microîntreprinderile sunt oricum scutite de mare parte din obligații
  ([consentmanager.net](https://www.consentmanager.net/en/legal/dsa-for-online-platforms/)).
- **GDPR**: newsletter = double opt-in (există deja); un sponsor de newsletter nu primește niciodată adrese.

---

## 4. Opțiunile analizate

### 4.1 Mai multe programe de afiliere (rețelele actuale + programe directe)

- **Ce e:** aceleași mecanisme (feed + `/go/`), alte magazine/categorii. 2Performant are categorii
  Babies Kids & Toys, Books, Fashion, Beauty, Home & Garden, Sports etc.
  ([2performant.com](https://2performant.com/affiliate-programs/)); Profitshare are ~250 de programe
  și eMAG a anunțat comisioane mai mari pentru afiliații performanți după ce vânzarea către
  2Performant a căzut în aug. 2025 ([mobilissimo.ro](https://www.mobilissimo.ro/stiri-diverse/emag-mizeaza-pe-dezvoltarea-interna-a-profitshare-si-lanseaza-initiative-dedicate-partenerilor-in-urma-neconcretizarii-tranzactiei-cu-2performant-platforma-ramane-una-in-house)).
- **Magazinele mari din brief:** n-am găsit surse actuale (2025–2026) care să confirme programe active
  pentru Altex (ultimul anunț public: 3% prin 2Parale, 2011 — [gadget.ro](https://gadget.ro/altex-intra-in-sistemul-de-afiliere-2parale/)),
  Flanco (relansat în Profitshare în 2020 — [bursa.ro](https://www.bursa.ro/flanco-relanseaza-programul-de-afiliere-in-profitshare-23009046)),
  Cel.ro, Dedeman, Fashion Days (apare `inactive` în lista ta Profitshare, 5%), Notino (are program,
  cookie 15 zile — [flexoffers](https://www.flexoffers.com/affiliate-programs/notino-ro-affiliate-program/)).
  **Statutul real se vede doar în panourile Profitshare/2Performant** → primul pas e o verificare manuală.
- **Venit realist:** proporțional cu traficul. La 200 vizitatori/lună: +10–50 lei/lună. La 5.000/lună
  (țintă după Black Friday + SEO): 300–1.500 lei/lună. Comisioanele IT/electro sunt mici (1,5–3% evomag,
  Vexio, ForIT); categoriile cu 7–10% (jucării, cărți, cadouri, pet) au coș mai mic dar marjă mai bună.
- **Efort:** mic (importerul 2Performant/Profitshare există; filtrul de categorii per feed există).
- **Riscuri:** comisioanele mici la electro nu acoperă CPC-ul Google Ads; magazine noi = mapare categorii.
- **Compatibilitate:** totală.

### 4.2 Coduri de reducere / vouchere (Profitshare `affiliate-vouchers`, 2Performant)

- **Ce e:** pagină „Coduri de reducere [magazin]” + afișare pe `/p/` când există un cod valabil pentru
  magazinul ofertei. API-ul Profitshare dă vouchere cu `tracking_link` (vezi memoria `profitshare-api-referinta`).
- **Venit realist:** interogările „cod reducere emag/altex/notino” au volum mare, dar sunt dominate de
  site-uri de cupoane vechi și puternice. Pentru un site nou: 0–200 lei/lună în primele luni.
  Valoarea reală: **crește rata de click pe ofertele existente** (un cod = motiv în plus să cumpere acum).
- **Efort:** mic–mediu (un job nou de import + o componentă).
- **Riscuri:** coduri expirate = exact opusul „reducerii reale” → afișezi DOAR coduri cu dată de expirare
  validă și le scoți automat; fără „economisești X”. Unele programe interzic site-urile de cupoane
  (de verificat per program). SEO: paginile de cupoane subțiri pot fi văzute ca „thin content”.
- **Compatibilitate:** bună, dacă e strict filtrat.

### 4.3 Listări plătite / CPC direct de la magazine („merchant listings”)

- **Cum fac alții:** Compari.ro — magazinele plătesc per click, cu licitare pentru poziții promovate;
  la serviciul Shopping prețul maxim implicit e **0,20 lei net/click**, limită zilnică 15 lei/categorie
  ([compari.ro](https://www.compari.ro/static/shopping.html), [compari.ro/bidding](https://www.compari.ro/static/bidding.html));
  ShopMania — CPC + conturi premium ([shoppingfeeder](https://insights.shoppingfeeder.com/selling-on-shopmania/));
  PriceRunner (Klarna) — CPC per categorie ([pricerunner.se](https://www.pricerunner.se/info/advertisement));
  idealo — CPC, dar fără clasament plătit („cel mai bun preț câștigă”) ([priceva](https://priceva.com/de/blog/idealo-preisvergleich)).
- **Venit realist la tine:** 30–100 clickuri umane/lună × ~0,20–0,50 lei = **6–50 lei/lună**. Magazinele
  plătesc pentru trafic dovedit; fără statistici credibile nu semnează.
- **Efort:** mare (contracte, facturare, panou pentru magazin, raportare clickuri anti-fraudă).
- **Riscuri:** poziții plătite fără etichetă = încălcare OUG 58/2022; chiar etichetate, erodează mesajul
  „noi arătăm doar reducerea reală”. Pot intra în conflict cu termenii rețelelor de afiliere (același
  magazin plătit de două ori).
- **Compatibilitate:** medie; doar ca model „listare neutră plătită per click, clasament tot după preț”
  (ca idealo) și doar la peste ~20.000 vizitatori/lună.

### 4.4 Poziții sponsorizate / „ofertă evidențiată” etichetată

- Variantă mai simplă a 4.3: un magazin plătește un fix lunar pentru un slot „Sponsorizat” pe homepage
  sau într-o categorie. Venit realist acum: 0 (nimeni nu plătește pentru 200 de vizitatori).
- Ai deja sloturi de banner (`banners`: Profitshare widget-uri active) — e aceeași infrastructură.
- **Risc credibilitate mare** dacă sponsorul apare deasupra unei oferte mai ieftine. Regula sigură:
  slot separat, etichetat, niciodată în lista de oferte a unui produs.

### 4.5 Abonament premium pentru utilizatori (alerte avansate)

- **Cum fac alții:** Keepa — 29 EUR/lună, dar clienții sunt vânzători Amazon (B2B), nu cumpărători
  ([revenuegeeks](https://revenuegeeks.com/keepa-pricing/)); camelcamelcamel rămâne gratuit și trăiește din
  afiliere + display ([revenuegeeks](https://revenuegeeks.com/software/camelcamelcamel)).
- **Venit realist:** cu 1 abonat email și 3 pe Telegram, 0. Chiar la 5.000 de abonați, conversia la
  plată pentru consumatori (1–2%) × 10 lei = 500–1.000 lei/lună — și pierzi efectul alertelor gratuite
  (fiecare alertă = un click nou spre magazin, deci comision).
- **Efort:** mediu–mare (plăți, facturare, TVA, cont utilizator — azi nu există conturi).
- **Compatibilitate:** slabă; alertele gratuite sunt motorul de afiliere.

### 4.6 Date de preț B2B (rapoarte de piață, monitorizare pentru magazine/branduri)

- **Cum fac alții:** Prisync 99 / 199 / 399 USD pe lună pentru 100 / 1.000 / 5.000 SKU
  ([softwareadvice](https://www.softwareadvice.com/pricing-optimization/prisync-profile)); în RO există
  PriceFlux (monitorizare + preț dinamic, clienți electro-IT/fashion/auto —
  [startupcafe](https://www.startupcafe.ro/marketing/serviciu-monitorizare-preturi-magazine-online-romania.htm)).
- **Avantaj:** **nu depinde de traficul site-ului.** Ai deja istoric zilnic din iunie 2026, mediana
  precalculată, 76.500 de produse, ~10 magazine.
- **Venit realist:** 1–3 clienți mici × 200–800 lei/lună = 200–2.400 lei/lună, după 1–3 luni de vânzare.
- **Efort:** mediu (export/raport din date existente) + timp de vânzare (contactare — decizia proprietarului).
- **Riscuri juridice serioase:** (a) feed-urile Profitshare/2Performant sunt date pentru promovare,
  revânzarea lor poate încălca termenii rețelelor; (b) datele eMAG vin din scanare — vânzarea lor
  comercială agravează riscul asumat; (c) drepturile sui-generis asupra bazelor de date (UE).
  Un pilot sigur ar folosi doar prețuri publice ale magazinelor clientului și ale concurenților lui,
  culese special, nu revânzarea bazei existente. **Cere verificare juridică înainte de orice ofertă.**
- **Compatibilitate:** bună tehnic; nu atinge credibilitatea site-ului dacă e separat (alt brand / pagină B2B).

### 4.7 Newsletter cu reduceri reale (și, mai târziu, sponsorizat)

- **Ce e:** digest săptămânal „top reduceri reale” cu linkuri spre `/p/` (nu direct la magazin, ca alertele).
  Infrastructura email (SMTP, double opt-in, coada `email`, dezabonare one-click) există deja.
- **Venit realist:** direct din afiliere (clickurile aduse înapoi pe site). Sponsorizarea devine
  posibilă abia de la ~2.000–5.000 de abonați activi (100–500 lei/trimitere, orientativ). Azi: 1 abonat.
- **Efort:** mic (un șablon nou de email + un job săptămânal).
- **Riscuri:** spam / GDPR — doar cu consimțământ explicit pentru newsletter (separat de alerte, dacă
  formularul de alertă nu a cerut acordul pentru newsletter). Sponsorul: etichetă „Publicitate” în email.
- **Compatibilitate:** foarte bună; e audiența ta proprie, nu depinzi de Google.

### 4.8 Conținut sponsorizat în ghiduri

- Venit realist acum: 0–300 lei/articol, rar (cerere mică pentru un site fără trafic).
- Risc mare: ghidurile sunt autoritatea site-ului (și sursa traficului din ChatGPT); un ghid plătit
  trebuie marcat „Material publicitar” (Legea 158/2008), iar Google cere `rel="sponsored"` pe linkuri.
- Compatibilitate: slabă acum; reconsiderat la >20.000 vizitatori/lună, doar ca articole separate, marcate.

### 4.9 Cashback

- Model: împarți comisionul cu cumpărătorul (ex. CashClub, >1.000 de magazine partenere —
  [romania-insider](https://www.romania-insider.com/cashclub-seedblink-crowdfunding-april-2025)).
- Venit realist: negativ la început (dai jumătate din comision, cu 43–50% respingeri → reclamații).
- Efort mare: conturi de utilizator, portofel, plăți, KYC, fiscalitate; multe programe interzic sau
  aprobă separat „trafic stimulat”.
- **Nu e compatibil** cu un site fără conturi și cu rată mare de respingere.

### 4.10 Extensie de browser

- Politica Chrome Web Store (în vigoare din 10 iunie 2025): extensia nu poate adăuga/înlocui linkuri
  afiliate fără beneficiu direct pentru utilizator, fără dezvăluire înainte de instalare și fără acțiune
  explicită a utilizatorului ([developer.chrome.com](https://developer.chrome.com/blog/cws-policy-update-affiliate-ads-2025)).
- Valoare reală: „istoricul prețului direct pe pagina magazinului” (ca Keepa). Efort mare, întreținere
  per magazin, iar pe eMAG ar însemna citirea paginilor lor în browserul utilizatorului.
- Compatibilitate: medie, dar prea devreme (niciun utilizator recurent încă).

### 4.11 Aplicație mobilă

- Efort mare (două magazine de aplicații, notificări push, review-uri), fără audiență de transferat.
  Telegram + email acoperă deja nevoia de alertă. Nu acum.

### 4.12 CSS pentru Google Shopping

- Cerințe Google: site care compară produse de la **minimum 50 de domenii distincte de magazine** pe țară,
  căutare proprie, sortare după preț + încă un criteriu, acces fără cont; CSS-ul licitează **în numele
  magazinelor-client** ([support.google.com](https://support.google.com/css-center/answer/7524491?hl=en)).
  Venitul unui CSS vine din taxa plătită de magazine (lunar sau % din buget), nu din afiliere
  ([emerce.nl](https://www.emerce.nl/achtergrond/wondere-wereld-google-css-partners)).
- La tine: ~10 magazine, niciun magazin-client. **Nu e fezabil acum.** Alternativa de colaborare (a deveni
  „furnizor de trafic” pentru un CSS existent) nu aduce nimic fără audiență.

---

## 5. Tabel comparativ

Venitul e estimat **la traficul de azi (~200 vizitatori/lună)** și, între paranteze, la ~5.000/lună.
Toate cifrele sunt aproximative, încredere scăzută.

| Opțiune | Venit estimat / lună | Efort | Timp până la primul leu | Riscuri principale | Compatibilitate cu modelul actual |
|---|---|---|---|---|---|
| Black Friday hub + listă email (bază pentru tot) | 0–200 lei în nov. (300–2.000) | Mic | 2–5 săpt. (comisioanele se aprobă în 30–60 zile) | Afirmații false dacă „reducerea” nu e reală la publicare | Foarte bună — e exact propunerea de valoare |
| Mai multe programe de afiliere | +10–50 lei (300–1.500) | Mic | 2–6 săpt. (aprobare program + import) | Comisioane mici la electro; mapare categorii | Totală |
| Coduri de reducere (vouchere) | 0–50 lei (100–500) | Mic–mediu | 3–6 săpt. | Coduri expirate → credibilitate; unele programe interzic | Bună, doar cu filtrare strictă |
| Newsletter (mai târziu sponsorizat) | 0 (sponsor: 100–500 lei/trimitere de la 2–5k abonați) | Mic | luni | GDPR (acord separat), etichetare | Foarte bună |
| Date de preț B2B (pilot) | 0 → 200–2.400 lei (nu depinde de trafic) | Mediu + vânzare | 1–3 luni | Termenii rețelelor, scanarea eMAG, drept baze de date | Bună dacă e separat de site |
| Listări plătite CPC de la magazine | 6–50 lei (100–1.000) | Mare | 3–6 luni | OUG 58/2022, conflict cu afilierea, credibilitate | Medie (doar clasament neutru) |
| Poziții sponsorizate etichetate | 0 (200–1.000) | Mic tehnic, mare comercial | 3+ luni | Credibilitate „reducere reală”, etichetare | Medie–slabă |
| Conținut sponsorizat în ghiduri | 0–300 lei ocazional | Mic | variabil | Credibilitate, `rel="sponsored"`, Legea 158/2008 | Slabă acum |
| Abonament premium | 0 (500–1.000) | Mare | 3–6 luni | Canibalizează alertele gratuite; plăți/TVA | Slabă |
| Cashback | negativ | Mare | 6+ luni | Respingeri 43–50%, trafic stimulat interzis, fiscal | Nu |
| Extensie de browser | 0 | Mare | 6+ luni | Politica Chrome 2025, eMAG | Medie, prea devreme |
| Aplicație mobilă | 0 | Mare | 6+ luni | Cost întreținere | Prea devreme |
| CSS Google Shopping | 0 | Foarte mare | n/a | Cerință 50 domenii, model B2B | Nu acum |

---

## 6. TOP 3 recomandări (prioritizate) și primii pași

### #1. Black Friday 2026 „verificat”: pagină + listă de email (acum — 6 nov.)

**De ce:** eMAG are Black Friday pe **6 noiembrie 2026** ([romania-insider](https://www.romania-insider.com/romanias-largest-online-retailer-emag-announces-date-black)),
iar alți retaileri întind „luna reducerilor” pe tot noiembrie. Exact atunci cumpărătorii se întreabă
„e reducere reală sau umflată?” — întrebarea la care site-ul răspunde deja cu date (1.162 de produse
au azi o reducere reală). E singura opțiune care poate aduce în câteva săptămâni și trafic (presă,
linkuri, ChatGPT, căutări „reduceri reale black friday”), și comisioane, și abonați pentru tot restul.

Primii pași (pentru site-dev / proprietar, nimic implementat acum):
1. O pagină `/reduceri-reale/black-friday` (hub-ul `/reduceri-reale` există) care listează live doar
   ofertele cu reducere reală față de mediana pe 30 de zile, cu filtrul pe categorie; textul nu promite
   procente — cifrele vin din marcaje (regula 9).
2. Un formular „Anunță-mă când apar reducerile reale de Black Friday” pe acea pagină = abonare la
   newsletter cu double opt-in (acord separat, explicit — fără bife noi în bannerul de cookies,
   conform deciziei proprietarului; acordul se dă în formular).
3. Un ghid publicat până la ~25 oct.: „Cum verifici dacă o reducere de Black Friday e reală” (cu
   `{{istoric-pret}}` pe 3–4 produse populare) — material bun pentru ChatGPT/AI și pentru presă.
4. După 6 nov.: un raport public „Câte reduceri de Black Friday au fost reale” (din `offer_price_stats`)
   — subiect de știre, aduce linkuri; fără nume de magazine acuzate fără dovadă.
5. Măsoară: abonați noi, clickuri umane pe `/go/` (după protecția din 3 oct.), comisioane în 30–60 zile.

### #2. Lărgește afilierea în rețelele existente + coduri de reducere (următoarele 2–6 săptămâni)

**De ce:** costă puțin (importerele, maparea, filtrul de categorii există) și ridică venitul pe fiecare
vizitator. Toate comisioanele de până acum vin dintr-un singur magazin (eMAG, cel mai riscant contractual);
diversificarea reduce și dependența.

Primii pași:
1. **Proprietarul**, în panourile Profitshare și 2Performant: verifică dacă există programe active pentru
   Altex, Flanco, Cel.ro, Elefant, Notino, Fashion Days, Decathlon, Dedeman — și condițiile lor (cookie,
   comision pe categorie, dacă acceptă comparatoare și trafic din Google Ads spre site-ul tău).
   Nu am găsit confirmări publice recente pentru niciunul.
2. Aplică la programe cu comision bun în categorii pe care oamenii le caută deja pe site sau care au
   sezon acum: **Noriel 7% (jucării, „lego” apare în căutările interne; Crăciun)**, Libris 8% (cărți,
   cadouri), Giftspot 7%, Kaelo 20% (de verificat ce vinde). Încălțăminte/fashion apar în căutări
   („nike”, „jordan”, „adidași”), dar e o categorie nouă de construit — doar dacă un program are feed bun.
3. Repornește CITGrup (21.335 de oferte în stoc, pus pe pauză) dacă motivul pauzei s-a rezolvat —
   e cel mai mare catalog din site.
4. Coduri de reducere: un job care citește `affiliate-vouchers` (Profitshare) și le arată pe `/p/` lângă
   oferta magazinului **doar dacă au dată de expirare viitoare**; o pagină per magazin abia după ce
   există coduri reale de afișat (altfel e „thin content”).
5. Verifică în panoul Profitshare cele 4 comenzi respinse de câte 46,36 lei și de ce `hash` lipsește pe
   toate comisioanele (fără el, nu vei ști niciodată ce categorie convertește).

### #3. Pilot B2B „monitorizare de preț” — doar validare, nu construcție (după verificarea juridică)

**De ce:** e singurul venit care nu așteaptă traficul. Ai deja ce vând alții la 99–399 USD/lună:
istoric zilnic, mediană, potrivire de produse între magazine.

Primii pași:
1. Întrebare la un jurist + citirea termenilor Profitshare/2Performant: ai voie să folosești datele din
   feed-uri pentru un serviciu plătit? (Probabil nu → pilotul folosește doar prețuri publice culese
   pentru client, fără eMAG.)
2. Un raport-exemplu static (PDF) pentru o categorie (ex. monitoare sau hrană uscată pentru câini):
   evoluția prețurilor, cine are cel mai mic preț câte zile, frecvența reducerilor reale.
3. Proprietarul decide dacă și pe cine contactează (1–2 magazine mici din feed-uri sau un distribuitor
   de brand) și la ce preț de test (ex. 300–500 lei/lună). Fără angajamente de dezvoltare înainte de un
   client care a spus „da”.

---

## 7. Ce NU recomand acum și de ce

- **AdSense / alte rețele de display** — exclus de proprietar (canibalizare, RPM mic, CMP TCF).
- **CSS Google Shopping** — cere ≥50 de domenii de magazine și magazine-client care plătesc; ai ~10 și niciunul.
- **Cashback** — dai jumătate din comision la o rată de respingere de 43–50%, cere conturi, plăți, fiscalitate;
  multe programe interzic traficul stimulat.
- **Abonament premium** — alertele gratuite sunt motorul de clickuri; la 4 abonați nu ai cui vinde.
- **Listări plătite / poziții sponsorizate** — magazinele nu plătesc pentru 200 de vizitatori; etichetate
  corect tot pun sub semnul întrebării „arătăm doar ce e cu adevărat ieftin”. De reluat la >20.000 vizitatori/lună,
  doar ca listare neutră (clasament tot după preț, ca idealo).
- **Conținut sponsorizat în ghiduri** — ghidurile sunt sursa de încredere (și de trafic din ChatGPT); nu le
  amesteca cu bani acum.
- **Extensie de browser / aplicație mobilă** — efort mare, politica Chrome 2025 restrictivă, nicio audiență de mutat.
- **Mai mult buget în Google Ads ca „monetizare”** — 59 lei, 30 de clickuri, 0 conversii până acum; cu
  comisioane de 1,5–3% la electro, reclamele pe telefoane pierd bani (vezi rapoartele de oportunități).

---

## 8. Presupuneri și date lipsă — ce ar crește încrederea

- Cifrele de venit din tabel sunt estimări de ordin de mărime, nu prognoze (încredere scăzută).
- Clickurile umane curate pe `/go/` abia încep (după 3 oct.); peste 2–3 săptămâni se poate calcula rata reală
  vizitator → click → comision.
- `hash` gol pe toate comisioanele → nu știm ce categorii convertesc; prioritar de lămurit în panou.
- Statutul programelor Altex/Flanco/Cel.ro/Dedeman/Notino/Fashion Days — doar din panourile rețelelor.
- Termenii rețelelor pentru: comparatoare, vouchere pe site, folosirea datelor din feed (pentru #3).
- Scăderea afișărilor în Search Console (1.509 → 604 → 29) — merită un audit SEO separat; fără trafic organic,
  nicio opțiune nu scalează.

---

## 9. Context sezonier (următoarele 6–8 săptămâni)

- **Acum – 5 nov.:** pregătire Black Friday (pagină, ghid, listă de email). Prețurile încep să urce la unii
  retaileri înainte de BF → medianele pe 30 de zile vor arăta exact ce e reducere reală.
- **6 nov. 2026: Black Friday eMAG** (o singură zi); alți retaileri — campanii pe tot noiembrie.
- **Mijlocul lui nov. – dec.:** Crăciun: jucării (Noriel), cărți (Libris), cadouri (Giftspot), electronice mici.
- **Ianuarie:** comisioanele din noiembrie se aprobă (sau se resping) — primul moment în care vezi venitul real
  al sezonului.

---

Alege 2–3 direcții din TOP 3 de mai sus; nu am ales în locul tău, iar fiecare primește un plan detaliat abia
după decizia ta.

### Surse

- [Altex intră în sistemul de afiliere 2Parale — gadget.ro](https://gadget.ro/altex-intra-in-sistemul-de-afiliere-2parale/)
- [Flanco relansează programul de afiliere în Profitshare — bursa.ro](https://www.bursa.ro/flanco-relanseaza-programul-de-afiliere-in-profitshare-23009046)
- [eMAG mizează pe dezvoltarea internă a Profitshare — mobilissimo.ro](https://www.mobilissimo.ro/stiri-diverse/emag-mizeaza-pe-dezvoltarea-interna-a-profitshare-si-lanseaza-initiative-dedicate-partenerilor-in-urma-neconcretizarii-tranzactiei-cu-2performant-platforma-ramane-una-in-house)
- [Programe de afiliere 2Performant](https://2performant.com/affiliate-programs/)
- [Notino.ro affiliate program — flexoffers](https://www.flexoffers.com/affiliate-programs/notino-ro-affiliate-program/)
- [Compari — Cum funcționează serviciul Shopping](https://www.compari.ro/static/shopping.html), [Compari — bidding](https://www.compari.ro/static/bidding.html)
- [Selling on ShopMania — shoppingfeeder](https://insights.shoppingfeeder.com/selling-on-shopmania/)
- [PriceRunner — advertisement](https://www.pricerunner.se/info/advertisement)
- [idealo — priceva](https://priceva.com/de/blog/idealo-preisvergleich)
- [Keepa pricing — revenuegeeks](https://revenuegeeks.com/keepa-pricing/), [camelcamelcamel — revenuegeeks](https://revenuegeeks.com/software/camelcamelcamel)
- [Prisync pricing — softwareadvice](https://www.softwareadvice.com/pricing-optimization/prisync-profile)
- [PriceFlux — startupcafe.ro](https://www.startupcafe.ro/marketing/serviciu-monitorizare-preturi-magazine-online-romania.htm)
- [CashClub — romania-insider](https://www.romania-insider.com/cashclub-seedblink-crowdfunding-april-2025)
- [Chrome Web Store — politica pentru afiliere în extensii (2025)](https://developer.chrome.com/blog/cws-policy-update-affiliate-ads-2025)
- [Google — CSS program requirements](https://support.google.com/css-center/answer/7524491?hl=en)
- [CSS partners — emerce.nl](https://www.emerce.nl/achtergrond/wondere-wereld-google-css-partners)
- [OUG 58/2022 — infocons.ro](https://infocons.ro/noi-modificari-si-norme-in-protectia-consumatorilor-din-28-mai-2022-ordonanta-58-2022/)
- [OUG 18/2026 — capital.ro](https://www.capital.ro/noi-reguli-pentru-magazinele-online-si-marketplace-uri-ce-obligatii-introduce-oug-18-2026.html)
- [Reglementarea publicității online (Legea 158/2008) — playtech.ro](https://playtech.ro/2025/cum-sunt-reglementati-influencerii-in-romania-ce-legi-trebuie-sa-respecte-care-sunt-riscurile-pentru-vedetele-online-vlogger-bloggeri-youtuberi-si-tiktokeri/)
- [DSA pentru platforme online — consentmanager.net](https://www.consentmanager.net/en/legal/dsa-for-online-platforms/)
- [eMAG anunță data Black Friday 2026 — romania-insider](https://www.romania-insider.com/romanias-largest-online-retailer-emag-announces-date-black)
