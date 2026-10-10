# Plan Black Friday 2026 — superieftin.ro

Data: 10 octombrie 2026 · Autor: market-research · Pentru: proprietar (apoi site-dev / ads-builder, dacă alegi)
Mod de lucru: DOAR citire. Am rulat SELECT pe DB-ul de producție (tranzacție `READ ONLY`), am citit repo-ul și am căutat pe web. N-am modificat cod, DB, Google Ads sau Search Console.

Întrebarea raportului: **unde câștigăm mai mult decât cheltuim, acum**, nu „ce se caută cel mai mult”. La Black Friday diferența contează dublu: căutările cele mai mari („black friday televizoare”) sunt și cele mai scumpe în reclame, iar organic sunt ocupate de magazine mari.

---

## 1. Rezumat (5 rânduri)

1. **Calendarul:** eMAG are Black Friday **vineri, 6 noiembrie** (confirmat). evoMAG a pornit anul trecut pe 24 octombrie (3 valuri, până pe 9 noiembrie), așa că anul acesta e probabil **~23 octombrie** (estimare). Altex și Flanco nu au anunțat data, dar au deja pagini sau campanii pe mai multe săptămâni. Black Friday „american” e pe 27 noiembrie, iar Cyber Monday pe 30 noiembrie. Prima săptămână din noiembrie e momentul de vârf.
2. **Descoperirea importantă din datele noastre: prețurile au urcat înainte de Black Friday.** Din 1 septembrie, **40% din laptopurile evoMAG** sunt cu ≥5% mai scumpe (în medie +7,6%), la fel și **42% din telefoanele ITGalaxy** (+6%). Unele laptopuri de gaming au sărit cu 30–35% într-o singură zi (ASUS TUF A17: de la 4.799,99 la 6.456,99 lei pe 9 oct.). Cauza probabilă e scumpirea memoriei RAM, nu doar „umflarea” prețului (vezi §6). Asta e exact povestea pe care o putem spune cu istoricul nostru.
3. **SEO, realist:** site-ul e pe poziția ~40–50 (Spam Update, aug.). Pe „black friday + categorie” nu avem nicio șansă în 4 săptămâni. Merită atacate **comparații și modele concrete** („galaxy a37 vs a57”, „iphone 17e vs 16e”, „lenovo loq rtx 5050 pret”) plus unghiul nostru unic, „prețul a urcat înainte de BF”. Recomand **3 ghiduri noi, publicate până pe 18 octombrie** (§5).
4. **Google Ads la Black Friday: nu recomand campanii pe telefoane, laptopuri sau televizoare.** CPC-ul real din cont a fost de **~2 lei** (Galaxy S26 Ultra: 69 de clickuri, 136 lei, 0 comisioane ITGalaxy înregistrate vreodată). La 1–2% comision, nicio direcție de BF nu trece pragul EPC ≥ 1,3 × CPC. Singura excepție e **laptopurile refurbished CITGrup (8%)**, un test mic, opțional, cu încredere scăzută (§4.3).
5. **Cele mai bune 3 acțiuni:** (a) publică cele 3 ghiduri și cere indexarea manuală; (b) pregătește hubul `/reduceri-reale` ca pagină de Black Friday și promovează alertele de preț (lista de email e singurul activ care rămâne după BF); (c) după 6 noiembrie, publică un „raport: câte reduceri de BF au fost reale”, ca să obții linkuri din presă (cea mai bună cale de ieșire din penalizare).

---

## 2. Calendarul Black Friday 2026 în România

| Magazin (din `retailers`) | Data BF 2026 | Stare | Ce știm / sursă |
|---|---|---|---|
| **eMAG** (scanat local) | **Vineri, 6 noiembrie** | **Confirmat** (eMAG Sellers' Day, 23 sept.) | O singură zi. Ora de start încă neanunțată. Cookie, grilă și recurență **dedicate BF** (clickurile de dinainte nu se numără). [Romania Insider](https://www.romania-insider.com/romanias-largest-online-retailer-emag-announces-date-black), [mobilissimo](https://www.mobilissimo.ro/articole-diverse/cand-este-black-friday-emag-in-2026-prima-editie-fara-iulian-stanciu-in-actionariat), [Știrile ProTV](https://stirileprotv.ro/stiri/black-friday/cand-incepe-black-friday-2026-la-emag-data-exacta-la-care-incep-reducerile-in-romania.html) |
| **evoMAG** (2Performant) | **~23 oct. – 30 nov.** | **Estimare**, neconfirmată | 2025: 24 oct. – 9 nov., în 3 valuri (24–30 oct., 31 oct. – 6 nov., 7–9 nov.). Comisionul nostru e **1% fix de BF**. [wall-street.ro](https://www.wall-street.ro/articol/ecommerce/black-friday-2025-la-evomag-ce-reduceri-sunt-si-in-ce-perioada-se-desfasoara.html), [startupcafe](https://startupcafe.ro/black-friday-2025-in-romania-datele-oficiale-ale-campaniei-de-reduceri-la-evomag-fashion-days-si-flanco-88542), [infinity.ro (calendar)](https://infinity.ro/blog/cand-este-black-friday-2026-perioada-infinity-si-calendarul-magazinelor/) |
| **ITGalaxy** (Profitshare) | Neanunțat | — | N-am găsit date pentru 2025. Istoric: campanii în 2 runde în săptămâna BF. Fereastra de click de 60 de zile acoperă tot sezonul. [gadget.ro (istoric)](https://gadget.ro/14-oferte-de-black-friday-de-la-it-galaxy/) |
| **CITGrup** (Profitshare, 8%) | Neanunțat | — | Istoric: 2015 a fost 6 nov. – 1 dec. N-am găsit date pentru 2025. [evz.ro](https://evz.ro/black-friday-si-la-produse-refurbished.html) |
| **Vexio** | Neanunțat | — | Retailerii IT au început de regulă înaintea primei săptămâni din noiembrie. [adevarul.ro, 8 oct. 2026](https://adevarul.ro/economie/black-friday-2026-se-schimba-in-romania-2562388.html) |
| **petmart** | Neanunțat | — | Petshop-urile au BF în prima jumătate a lui noiembrie (vezi raportul pet din 3 oct.). |
| **Altex** (pe pauză la noi) | Neanunțat | Pagină BF deja activă | Promovează categoriile, „până la 40%” la telefoane. [adevarul.ro](https://adevarul.ro/economie/black-friday-2026-se-schimba-in-romania-2562388.html) |
| **Flanco** (nu e la noi) | Neanunțat | Campanie pe mai multe săptămâni | — |
| Alții (orientativ) | Infinity 13–30 nov., Notino 27 nov. | — | [infinity.ro](https://infinity.ro/blog/cand-este-black-friday-2026-perioada-infinity-si-calendarul-magazinelor/), [adevarul.ro](https://adevarul.ro/economie/black-friday-2026-se-schimba-in-romania-2562388.html) |
| **Black Friday internațional** | **Vineri, 27 noiembrie** | Calendar | |
| **Cyber Monday** | **Luni, 30 noiembrie** | Calendar (SUA) | În România nu e un eveniment confirmat de niciun magazin din lista noastră. eMAG a avut în 2025 o campanie aniversară pe **2 decembrie**, nu „Cyber Monday”. [Euronews RO, 7 oct. 2026](https://www.euronews.ro/articole/black-friday-2026-romania-data-perioada-reduceri) |

**Pre-campanii:** presa spune că primele oferte vin „din a doua jumătate a lui octombrie” ([adevarul.ro](https://adevarul.ro/economie/black-friday-2026-se-schimba-in-romania-2562388.html)), iar raportul nostru din 27 sept. citează primele reduceri „de pe 16 octombrie” ([capital.ro](https://www.capital.ro/black-friday-2026-primele-reduceri-apar-mai-devreme-decat-se-asteptau-cumparatorii.html)).

**Atenție la eMAG:** în tabela `retailers`, eMAG are acum `source_state = program_inactive`. **Verifică în panoul Profitshare dacă afilierea eMAG e activă** înainte de 6 noiembrie. Altfel, traficul spre eMAG din ziua de vârf nu aduce nimic. Reamintire: eMAG interzice PPC, deci eMAG intră doar pe organic și pe alerte.

---

## 3. Ce arată datele noastre (DB producție, 10 oct. 2026)

### 3.1 Ce avem „bun de BF”: oferte disponibile, cu link afiliat, indexabile

Am folosit exact regulile din cod: `OFFER_AVAILABLE_SQL` (în stoc, confirmată în ultimele 3 zile, magazin fără pauză) + `affiliate_url` + `PRODUCT_INDEXABLE_SQL` (istoric ≥30 de zile, categorie vizibilă, fără Sănătate & Naturale).

| Magazin | Oferte disponibile cu link | Din ele indexabile (≥30 zile) | „Reducere reală” azi (indexabile) |
|---|---|---|---|
| ITGalaxy | 2.546 | 2.243 | 223 |
| evoMAG | 3.881 | 1.290 | 175 |
| CITGrup (fără pauză din nou) | 23.430 | 1.272 (doar produsele vechi potrivite) | 7 |
| Vexio | 62 | 56 | 11 |
| eMAG (scanat; exclus din planul ăsta) | 504 | 280 | 41 |
| petmart / rowenta | 13.092 / 261 | 0 (istoric < 30 zile) | 0 |

Pe categorii (magazine stabile, fără eMAG), produse indexabile / reduceri reale azi: încărcătoare 1.191 / 151 · **laptopuri 887 / 61** · monitoare 685 / 0 (toate CITGrup) · suport TV 581 / 68 · **telefoane 401 / 29** · folii 320 / 21 · **televizoare 266 / 46** · baterii externe 265 / 29.

### 3.2 Prețurile urcă înainte de Black Friday

Prețul de azi comparat cu cel din 1–3 septembrie, pe aceeași ofertă:

| Categorie · magazin | Oferte | ≥5% mai scump | ≥5% mai ieftin | Schimbare medie |
|---|---|---|---|---|
| Laptopuri · evoMAG | 443 | **179 (40%)** | 61 | **+7,6%** |
| Telefoane · ITGalaxy | 383 | **160 (42%)** | 37 | +6,0% |
| Televizoare · evoMAG | 266 | 88 (33%) | 47 | +5,1% |
| Suport TV · evoMAG | 581 | 139 | 68 | +4,3% |
| Baterii externe · ITGalaxy | 250 | 72 | 29 | +3,9% |
| Laptopuri / monitoare · CITGrup | 444 / 685 | 123 / 160 | 0 / 0 | +2,9% / +1,8% |

Exemple din istoric (laptopuri de gaming evoMAG):
- ASUS TUF A17 FA707NUG (RTX 4050): **4.799,99 lei** constant din 12 aug. până pe 8 oct., apoi **6.456,99 lei** pe 9 oct.
- Lenovo LOQ 15AHP10 (RTX 5050): 4.399,99 → 4.599,99 (27 sept.) → **5.737,99** (29 sept.) → 5.799,99 azi.
- MSI Thin 15 (RTX 4050): 4.340,99 → **5.961,99**.

**Ce înseamnă pentru verdictul „Reducere reală”:** mediana pe 30 de zile va „înghiți” scumpirea până la BF. De exemplu, la ASUS TUF A17, pe 6 noiembrie mediana va fi ~6.450 lei. Un preț de BF de ~6.100 lei va primi corect verdictul „Reducere reală” (−5% sub mediană), deși e cu ~27% peste prețul din august. Regula medianei rămâne neschimbată (decizia ta din 4 oct.). **Graficul de 90 de zile și termometrul min–max de pe `/p/` arată însă exact asta**, și e argumentul nostru unic față de „prețul tăiat” din magazine. Ghidurile de mai jos trebuie să explice asta (cu marcajul `{{istoric-pret:ID}}`, nu cu cifre scrise de mână).

### 3.3 Search Console și Ads: ce se vede deja

- **Organic (`gsc_daily`, din 21 aug.):** toate interogările stau pe pozițiile 25–90. Singura apropiată de pagina 1 e un nume complet de laptop („laptop asus vivobook 15 a1504va … quiet blue”, poziția 9). Tiparul care încă aduce afișări e **„model + pret”**: „samsung s26 pret” (poz. 35), „xiaomi 14t pro pret”, „xiaomi 15t pro pret” (30), „pret honor 400 pro” (26), „samsung galaxy a16 pret” (33), „iphone 17 256gb sage 5g” (48), „telefoane la reducere” (41), „oferta telefoane mobile” (41). Atenție: `gsc_daily` subraportează (vezi auditul din 5 oct.).
- **Reclame (`ads_search_terms`):** Galaxy S26 Ultra, 28 sept. – 9 oct.: 1.145 de afișări, 69 de clickuri, **136,26 lei, CPC ~1,94–2,00 lei**. Pe pragul de 0,33 lei aveam 0 afișări (pragul primei pagini e 1,29–2,52 lei). În `affiliate_conversions` **nu există niciun comision ITGalaxy, CITGrup sau Vexio**, din nicio sursă. Toate comisioanele de până acum sunt eMAG (2 aprobate, 7 în așteptare, 9 respinse) și 1 evoMAG (0,79 lei).

---

## 4. Ce căutări merită atacate

### 4.1 Organic (SEO): realist

**Ce NU merită (nu în 4 săptămâni):** „black friday televizoare / laptopuri / telefoane”, „reduceri black friday”, „black friday emag”. Pagina 1 e ocupată de magazine (eMAG, Altex, Flanco), agregatoare (blackfriday.ro, reduceriblackfriday.ro) și presă (wall-street, playtech, gadget, mobilissimo). Noi suntem pe poziția ~50, iar ghidurile și `/reduceri-reale` nu erau încă cunoscute de Google pe 5 oct.

**Ce merită, în ordine:**

| Tip de căutare | Exemple | De ce | Concurența |
|---|---|---|---|
| **Comparații între modele apropiate** | „galaxy a37 vs a57”, „iphone 17e vs 16e”, „rtx 5050 vs 5060 laptop” | Intenție de cumpărare; un ghid cu istoricul de preț al fiecărui model e conținut pe care alții nu îl au | Medie: mobilissimo, gadget, playtech, site-uri EN (techadvisor, androidcentral) |
| **Model exact + „pret”** | „lenovo loq 15ahp10 pret”, „asus tuf a17 fa707nug pret”, „iphone 17e 256gb pret”, „samsung a57 256gb pret” | Tiparul care ne aduce afișări și acum; paginile `/p/` există și sunt indexabile | Magazine + compari.ro / price.ro. Ghidul e o pagină de legătură care întărește `/p/` |
| **„merită” + model** | „merita iphone 16e”, „merita samsung a57”, „merita laptop gaming black friday” | Informațional, cu intenție de cumpărare; răspunsul nostru vine cu date | Medie |
| **„reducere reală” / „preț umflat black friday”** | „cum verifici reducerile black friday”, „preturi umflate black friday” | Avem deja ghidul. Aici contează **mențiunile în presă și citările în AI**, nu poziția | Mare (Consiliul Concurenței, presă), dar subiectul ni se potrivește |
| **„prețuri crescute laptop 2026”** | „de ce s-au scumpit laptopurile”, „preturi laptop crescute ram” | Unghi nou și foarte actual (RAM); putem arăta cifre reale | Mică–medie (știri, fără date de prețuri pe produse) |

**Volume orientative** (Keyword Planner, din raportul de pe 27.09; n-am interogat KP azi, deci sunt **aproximative**):

| Căutare | Volum lunar tipic | Vârf în noiembrie |
|---|---|---|
| televizor black friday | ~1.000 | **~12.100** |
| telefoane black friday | ~880 | **~6.600** |
| laptop black friday | ~720 | **~5.400** |
| laptop gaming | ~30.000 | — |
| iphone 17 pro max pret | 2.900 | — |
| samsung galaxy a37 | ~3.800 | — |
| laptop refurbished | 2.900 | — |

Google Trends nu se poate interoga de aici. Tendința de BF se vede din vârful de noiembrie de mai sus (×7–×12).

### 4.2 Google Ads: formula pe direcțiile de BF

Presupuneri: conversie 1% (optimist; nu avem nicio conversie proprie pe magazinele astea), valoarea pe vânzare = preț ÷ 1,21 × comision × aprobare, CPC = cel observat în cont (~2 lei), crescut la BF. Clickuri/lună = volum noiembrie × 50% cotă de afișări × 5% CTR.

| Direcție | Volum (nov.) | CPC estimat | Comision efectiv | EPC (1%) | Marjă/click | Scor | Încredere |
|---|---|---|---|---|---|---|---|
| Laptop gaming BF → evoMAG (~6.000 lei) | ~5.400 | 1,5–2,5 | ~0,6% (1% × 72% fără TVA) | 0,36 | **−1,6** | negativ | medie |
| iPhone 17 / 17e → ITGalaxy (~5.000 lei) | ~6.000 (aprox.) | ~2,0 (real în cont pe S26) | ~1,45% | 0,73 | **−1,3** | negativ | medie |
| Samsung Galaxy A37/A57 → ITGalaxy (~2.000 lei) | ~3.800 | 0,31 KP / ~1,5 real | ~1,45% | 0,29 | **−0,0 … −1,2** | negativ | medie |
| Televizoare BF → evoMAG (~2.500 lei) | ~12.100 | 0,3+ KP, mai mult la BF | ~0,6% | 0,15 | negativ | negativ | medie |
| **Laptop refurbished → CITGrup (~3.100 lei)** | 2.900 | 0,13–0,61 KP / ~0,8 estimat | **~5,6%** (8% × 85%) | **1,74** (0,87 la 0,5%) | +0,94 la 1% | 0,94 × 72 × 0,1 = **6,8** | **scăzută** |

**Concluzie:** după regula EPC ≥ 1,3 × CPC, **doar refurbished CITGrup** trece (2,2× la CPC 0,8 și conversie 1%), și doar în scenariul optimist. La 0,5% conversie pică (1,1×). Factorul de reducere e 0,1: CITGrup are 0 reduceri reale azi, deci nu avem avantaj competitiv.

### 4.3 Propunere Ads (doar dacă vrei, totul PAUSED)

- **Varianta A (recomandată): fără campanii noi de BF.** Banii merg pe conținut și pe lista de alerte. Campaniile existente rămân cum le-ai lăsat. Ai deja datele S26 ca să decizi.
- **Varianta B: un test mic „laptop refurbished” → CITGrup**, 1–30 nov., `MANUAL_CPC`, CPC max **0,80 lei**, **10 lei/zi** (sub plafonul de 50/campanie și 150 total; ~300 lei/lună, sub 4.000), doar exact/phrase. Landing: `/p/` ale laptopurilor Dell Latitude refurbished (141 disponibile, mediana prețului 3.127 lei). Atenție: doar 15 dintre ele sunt indexabile. Garda acceptă `noindex` pe `/p/` cu `InStock`, deci nu e o problemă pentru reclame. Anunțurile nu afirmă reduceri (regula „texte care nu expiră”). Cer `ads:validate` + PASS de la policy-reviewer + activare manuală de către tine.
  - Cuvinte cheie propuse: [laptop refurbished], [laptop refurbished dell], [dell latitude refurbished], [dell latitude 7420], [laptop reconditionat], [laptop business refurbished], „laptop refurbished pret”, „dell latitude 7420 pret”, „laptop recondiționat garanție”, [laptop second hand garantie], „laptop refurbished i7”, „laptop refurbished 16gb”.
  - Negative: `citgrup`, `cit grup`, `emag`, `evomag`, `altex`, `flanco`, `olx`, `piese`, `baterie`, `display`, `tastatura`, `incarcator`, `service`, `reparatie`, `macbook`, `gaming`.
  - De verificat întâi: dacă linkurile CITGrup înregistrează clickuri în panoul Profitshare (incidentul cu coduri din 28.09–04.10).
- **De evitat la BF:** cuvintele de brand ale retailerilor (eMAG, evoMAG, ITGalaxy, CITGrup, Vexio), doar ca negative. Nicio reclamă spre eMAG (PPC interzis) și nicio reclamă spre Vexio (Google Ads interzis din 2020). Nimic din Sănătate & Naturale (regula 8). Nicio afirmație „-X%” în anunțuri de BF: mediana se mișcă zilnic (regula 9, verdictul B1).

---

## 5. Cele 3 ghiduri de scris ACUM

Toate produsele de mai jos au fost **verificate azi**: ofertă disponibilă (regula `OFFER_AVAILABLE_SQL`), `affiliate_url` completat, istoric ≥30 de zile (deci `/p/` indexabil), categorie vizibilă și niciunul în alt ghid. Prețurile sunt doar pentru tine: **în ghid se folosesc marcajele `{{oferte:ID}}`, `{{pret:ID}}`, `{{istoric-pret:ID}}`, `{{comparatie:ID1,ID2}}`**, fără cifre scrise de mână.

Nu dublează ghidurile existente: încărcătoare, laptopuri pentru studenți/birou, OLED C6 vs S90F, Z Fold7, BF „cum verifici”, S26 Ultra, diagonale TV și **iPhone 17 Pro Max după iPhone 18** (publicat în DB, fișierul e în `content/ghiduri/drafts/`).

### Ghidul 1: Laptop de gaming de Black Friday

- **slug:** `laptop-gaming-black-friday-rtx-5050-5060-5070`
- **titlu:** „Laptop de gaming de Black Friday 2026: RTX 5050, 5060 sau 5070 și de ce au urcat prețurile”
- **kind:** `categorie` · **category_slug:** `laptopuri`
- **Căutări țintă:** laptop gaming black friday · laptop gaming rtx 5060 · rtx 5050 vs rtx 5060 laptop · laptop gaming ieftin 2026 · lenovo loq rtx 5050 pret · asus tuf a17 pret · hp victus rtx 5050 · gigabyte a16 rtx 5060 · de ce s-au scumpit laptopurile · merită laptop gaming de black friday
- **Unghiul unic:** placa video pe trepte (3050 → 4050 → 5050 → 5060 → 5070), cu un produs urmărit pe fiecare treaptă, plus **istoricul care arată salturile de preț din sept.–oct.** și explicația cu RAM-ul (surse: TrendForce prin club386/playtech). Partea „ce verifici”: VRAM 8 GB, 16 GB RAM, ecran 144/165 Hz, răcire. Fără „la BF scade sigur”.
- **Magazin:** toate evoMAG (2Performant, 1% de BF).

| id | slug | Model (GPU) | Preț azi | Mediana 30z | Min–max 30z |
|---|---|---|---|---|---|
| 22448 | `laptop-gaming-asus-tuf-f16-fx607vjb-procesor-intel-core-5-210h-12m-cache-up-to-4-80-ghz-16-4285215` | ASUS TUF F16 (RTX 3050) | 4.699,99 | 4.199,99 | 4.200–4.700 |
| 22105 | `laptop-gaming-asus-tuf-a17-fa707nug-procesor-amd-ryzen-7-7445hs-16m-cache-up-to-4-7-ghz-17-4244111` | ASUS TUF A17 (RTX 4050) | 6.452,99 | 4.799,99 | 4.800–6.457 |
| 22187 | `laptop-gaming-lenovo-loq-15ahp10-procesor-amd-ryzen-5-220-16m-cache-up-to-4-9-ghz-15-6inch-4255626` | Lenovo LOQ 15AHP10 (RTX 5050) | 5.799,99 | 4.399,99 | 4.400–6.800 |
| 22401 | `laptop-gaming-hp-victus-15-fa2107nn-procesor-intel-core-5-210h-12m-cache-up-to-4-80-ghz-15-4283606` | HP Victus 15 (RTX 5050) | 5.999,99 | 5.699,99 | 5.700–8.100 |
| 65052 | `laptop-gaming-lenovo-legion-5-15ahp11-procesor-amd-ryzen-7-250-16m-cache-up-to-5-1-ghz-15-4303921` | Lenovo Legion 5 15AHP11, OLED (RTX 5050) | 6.799,99 | 6.999,99 | 6.800–7.051 |
| 65050 | `laptop-gaming-lenovo-loq-essential-15arp11-procesor-amd-ryzen-7-170-16m-cache-up-to-4-75-g-4303899` | Lenovo LOQ Essential (RTX 5060) | 6.447,99 | 5.999,99 | 6.000–6.700 |
| 22084 | `laptop-gaming-gigabyte-a16-3vh-procesor-amd-ryzen-7-260-16m-cache-up-to-5-10-ghz-16inch-wu-4238643` | GIGABYTE A16 3VH (RTX 5060) | 6.754,99 | 5.899,99 | 5.600–10.900 |
| 48651 | `laptop-gaming-gigabyte-a16-3wh-procesor-amd-ryzen-7-260-16m-cache-up-to-5-10-ghz-16inch-wu-4261426` | GIGABYTE A16 3WH (RTX 5070) | 7.599,99 | 6.838,99 | 6.400–8.200 |

Rezervă: 22236 ASUS TUF F16 FX608JMR (RTX 5060), `laptop-gaming-asus-tuf-f16-fx608jmr-procesor-intel-core-i5-14450hx-20m-cache-up-to-4-80-gh-4261440`, 7.699,99 / 6.599,99. Notă: 48651 a fost confirmat ultima dată pe 8 oct. (încă disponibil, dar verifică înainte de import).

### Ghidul 2: Samsung Galaxy A17, A37 sau A57

- **slug:** `samsung-galaxy-a17-a37-a57-care-merita`
- **titlu:** „Galaxy A17, A37 sau A57: ce Samsung ieftin merită (și cum îi verifici prețul de Black Friday)”
- **kind:** `produs` · **category_slug:** `telefoane-mobile`
- **Căutări țintă:** samsung a37 vs a57 · samsung a57 pret · samsung a37 pret · samsung a17 5g pret · samsung a56 vs a57 · telefon samsung ieftin · samsung galaxy a black friday · merita samsung a57 · samsung a07 pret · telefon bun sub 2000 lei
- **Unghiul:** 4 trepte (A07 → A17 → A37 → A57, plus A56 ca „anul trecut”): IP54 vs IP68, Exynos 1480 vs 1680, 6 ani de actualizări, 128 vs 256 GB. Diferența de preț dintre trepte se arată live cu `{{comparatie:…}}`. Concurența are specificațiile (mobilissimo, gadget, androidcentral), dar nu are istoricul de preț. GSC ne arată deja „samsung galaxy a16 pret” (poz. 33).
- **Magazin:** toate ITGalaxy (Profitshare 2%, 60 de zile).

| id | slug | Model | Preț azi | Mediana 30z | Min–max 30z |
|---|---|---|---|---|---|
| 85392 | `telefon-mobil-galaxy-a07-128gb-4gb-ram-dual-sim-4g-black` | Galaxy A07 4/128 | 778,99 | 763,99 | 728–779 |
| 19438 | `telefon-mobil-galaxy-a17-128gb-4gb-ram-dual-sim-5g-black` | Galaxy A17 5G 4/128 | 1.050,99 | 1.015,99 | 968–1.065 |
| 66431 | `smartphone-samsung-galaxy-a17-17-cm-6-7-hybrid-dual-sim-4g-usb-type-c-8-gb-256-gb-5000-mah-light-blue` | Galaxy A17 8/256 (4G) | 1.366,99 | 1.306,99 | 1.199–1.367 |
| 62040 | `telefon-mobil-galaxy-a37-5g-6gb-128gb-awesome-charcoal` | Galaxy A37 6/128 | 1.624,99 | 1.538,99 | 1.422–1.625 |
| 62039 | `telefon-mobil-galaxy-a37-5g-8gb-256gb-awesome-charcoal` | Galaxy A37 8/256 | 2.046,99 | 2.125,99 | 1.858–2.184 |
| 66863 | `telefon-mobil-galaxy-a57-5g-8gb-128gb-awesome-gray` | Galaxy A57 8/128 | 2.031,99 | 2.031,99 | 1.836–2.213 |
| 66861 | `telefon-mobil-galaxy-a57-5g-8gb-256gb-awesome-gray` | Galaxy A57 8/256 | 2.222,99 | 2.205,99 | 2.169–2.306 |
| 19884 | `telefon-mobil-galaxy-a56-8gb-128gb-dual-sim-5g-graphite` | Galaxy A56 8/128 (generația trecută) | 1.760,99 | 1.699,99 | 1.700–1.761 |

Observație pentru text: A57 8/128 costă azi aproape cât A37 8/256. E o comparație bună, dar se arată doar prin marcaje, pentru că se schimbă.

### Ghidul 3: iPhone 17, 17e sau 16e

- **slug:** `iphone-17-vs-17e-vs-16e-ce-iphone-ieftin`
- **titlu:** „iPhone 17, 17e sau 16e: ce iPhone mai ieftin alegi în 2026”
- **kind:** `produs` · **category_slug:** `telefoane-mobile`
- **Căutări țintă:** iphone 17 vs 17e · iphone 17e vs 16e · cel mai ieftin iphone · iphone 17 256gb pret · iphone 17e pret · iphone 16e pret · iphone 16 pret · merita iphone 16e · iphone black friday 2026 · iphone 17 sage green
- **Unghiul:** gama „non-Pro” (17 = 120 Hz, A19; 17e și 16e = variantele de intrare; 16 = generația trecută). Pentru Pro / Pro Max / Air trimite la ghidul existent `iphone-17-pro-max-256gb-dupa-iphone-18`, ca să nu dubleze. Ce merită spus, cu marcaje live: iPhone 16 128 GB costă azi **mai mult** decât iPhone 17e 256 GB. Avem afișări pe „iphone 17 256gb sage 5g” și „iphone 17 mist blue”.
- **Magazin:** toate ITGalaxy. **Necunoscut:** comisionul Profitshare pe Apple la ITGalaxy poate fi mai mic decât 2%. Verifică în panou.

| id | slug | Model | Preț azi | Mediana 30z | Min–max 30z |
|---|---|---|---|---|---|
| 19297 | `telefon-mobil-iphone-17-256gb-8gb-dual-sim-5g-black` | iPhone 17 256 GB Black | 5.962,99 | 5.923,99 | 5.150–5.994 |
| 19172 | `telefon-mobil-iphone-17-8gb-256gb-dual-sim-5g-sage-green` | iPhone 17 256 GB Sage Green | 5.832,99 | 5.856,99 | 5.096–5.994 |
| 45499 | `telefon-mobil-iphone-17e-256gb-8gb-ram-dual-sim-5g-black` | iPhone 17e 256 GB Black | 4.695,99 | 4.575,99 | 3.996–4.786 |
| 86200 | `telefon-mobil-iphone-17e-512gb-8gb-ram-dual-sim-5g-black` | iPhone 17e 512 GB Black | 5.936,99 | 5.673,99 | 5.102–5.937 |
| 19912 | `telefon-mobil-iphone-16e-128gb-dual-sim-5g-black` | iPhone 16e 128 GB Black | 3.498,99 | 3.587,99 | 3.124–3.924 |
| 20161 | `telefon-mobil-iphone-16-128gb-black` | iPhone 16 128 GB Black | 4.995,99 | 4.922,99 | 4.263–4.996 |
| 20160 | `telefon-mobil-iphone-16-plus-128gb-black` | iPhone 16 Plus 128 GB Black | 4.898,99 | 4.931,99 | 4.899–4.999 |

Note: 45499 și 86200 au fost confirmate ultima dată pe 8 oct. (încă disponibile). Produsele 19912, 20161 și 20160 au și o ofertă ForIT veche, indisponibilă (magazin pe pauză), care nu apare pe pagină.

**De ce nu alte subiecte acum** (backlog, după BF): laptop refurbished (CITGrup, 8%), un subiect bun pentru bani, dar doar 15 Latitude sunt indexabile, iar restul sunt configurații aproape identice de workstation (risc „conținut în serie”); televizoare (avem deja 2 ghiduri); monitoare (fără reduceri, toate CITGrup, fără text de categorie); baterii externe („baterie externa 80000 mah” apare în GSC, dar valoare mică).

---

## 6. Calendar de acțiuni până pe 1 decembrie

Legendă: **[P]** = tu, manual · **[C]** = conținut (agent → import) · **[S]** = site-dev (cod, doar dacă aprobi) · **[A]** = ads (doar propunere, totul PAUSED).

| Săptămâna | Context extern | Ce facem |
|---|---|---|
| **10–18 oct.** | Pre-campanii (primele oferte „din a doua jumătate a lui octombrie”) | **[C]** Scrie cele 3 ghiduri (§5) → `content/ghiduri/drafts/` → verificare → publicare **până pe 18 oct.** · **[C]** Adaugă linkuri din ghidul BF existent și din ghidurile de telefoane spre cele noi · **[P]** Search Console → „Solicită indexarea” pentru cele 3 ghiduri + `/reduceri-reale` + `/reduceri-reale/laptopuri` + `/reduceri-reale/telefoane-mobile` + `/reduceri-reale/televizoare` (P0.5 din audit; nu e încă făcut, după datele de pe 5 oct.) · **[P]** Panoul Profitshare: afilierea eMAG e activă? Comisionul ITGalaxy pe Apple? Linkurile CITGrup numără clickuri? |
| **19–25 oct.** | **evoMAG pornește probabil BF (~23 oct.)** | **[S]** (decizia ta) Hubul `/reduceri-reale` cu titlu/introducere de sezon („Black Friday 2026: reduceri verificate față de mediana pe 30 de zile”) + un bloc vizibil „Anunță-mă când scade” (alertele există). Variante: A = doar text în hub (mic), B = secțiune separată pe `/reduceri-reale` cu filtru „doar magazine BF active” (mediu) · **[C]** Text de categorie pentru `/c/laptopuri`: o întrebare FAQ nouă, „De ce au urcat prețurile laptopurilor în toamna lui 2026?” (fără cifre scrise de mână) · **[P]** Verifici în GSC dacă ghidurile au fost accesate |
| **26 oct. – 1 nov.** | Valul 1–2 evoMAG; **27 oct.: pornește 410** pentru ~24.500 de produse moarte (corect, vezi auditul) | **[P]** Te uiți în GSC la creșterea „410/404” (normal) · **[C]** Actualizezi ghidurile dacă un produs dispare (marcajele se actualizează singure; un produs fără ofertă trebuie înlocuit) · **[A]** Research Ads BF pe 1–2 nov. cu reducerile din acel moment, doar dacă alegi varianta B (§4.3) |
| **2–8 nov.** | **eMAG BF vineri, 6 nov.**; valul 2–3 evoMAG | **[P]** Scanare eMAG manuală (local, Playwright) **joi 5 nov. seara și vineri 6 nov. dimineața, după 07:30** → `./emag-scrape-sync.sh`. Fără scanare, eMAG nu apare deloc în ziua de vârf · **[P]** Postări utile (nu spam) pe forum.softpedia / r/Romania: „cum verifici reducerile de BF”, cu link la ghid (P2.1) · **[A]** Dacă ai ales B: activare manuală după PASS policy-reviewer |
| **9–15 nov.** | Infinity 13–30 nov.; magazinele IT în valuri | **[C]** **Raport public „Câte reduceri de Black Friday au fost reale”** (din `offer_price_stats` + `price_history`: pe magazin/categorie, cât la sută dintre prețurile din 6 nov. au fost ≥5% sub mediană și câte au fost peste prețul din august) → ghid nou + email către gadget.ro, wall-street.ro, economedia, playtech (raportul SEO E5) |
| **16–22 nov.** | Campaniile Altex/Flanco pe săptămâni | **[A]** Primul bilanț: clickuri, comisioane în așteptare · **[P]** Răspunzi la presă dacă preia raportul |
| **23–29 nov.** | **BF internațional, 27 nov.** (Notino și alții) | **[C]** Actualizezi raportul public cu valul 2 · **[P]** Abonații la alerte: verifici că digestul pleacă (job orar) |
| **30 nov. – 1 dec.** | **Cyber Monday, 30 nov.** (fără eveniment RO confirmat); eMAG a avut aniversare pe 2 dec. în 2025 | **[A]** Oprești testul, dacă există · **[C]** Retrospectivă: ce ghiduri au adus afișări (GSC), ce comisioane au intrat (se aprobă în 30–60 de zile) |

---

## 7. De evitat (cu motiv)

| Ce | De ce |
|---|---|
| Ghid sau pagină „Black Friday eMAG” / „reduceri eMAG” | Brandul eMAG e interzis în PPC; organic, pagina 1 e a eMAG + presă; afilierea apare `program_inactive` |
| Campanii Ads pe telefoane/laptopuri/TV la BF | CPC real ~2 lei față de EPC 0,15–0,73 lei (§4.2); 0 comisioane ITGalaxy până azi |
| Afirmații „-X%” sau „cel mai mic preț” în ghiduri/anunțuri | Mediana se mișcă zilnic; regula 9 și verdictul B1; `publishErrors` respinge prețuri scrise de mână |
| Indexarea în masă a CITGrup nou pentru BF | ~20.000 de configurații aproape identice, exact ținta Spam Update (auditul, D2) |
| Sănătate & Naturale (Vegis) în orice material de BF | Regula 8 |
| Cabluri, folii, încărcătoare ca subiect principal | Valoare mică; avem deja ghidul de încărcătoare |
| Cuvinte de brand ale retailerilor | Doar ca negative |

---

## 8. Presupuneri și date lipsă

- **Conversia 1%** e presupusă. Nu avem nicio conversie proprie pe ITGalaxy / evoMAG / CITGrup (`hash` nu vine completat de la Profitshare, vezi raportul din 3 oct.).
- **Volumele** vin din Keyword Planner pe 27.09 (sezonalitate sept. 2025 – aug. 2026), nu de azi. Google Trends nu e disponibil de aici. → *Ar crește încrederea:* o rulare KP (citire) pe ~40 de cuvinte din §5 înainte de scrierea ghidurilor.
- **CPC-ul de BF** e extrapolat din contul nostru (S26 ~2 lei, pet 1,29–1,66 prag). La BF crește.
- **Datele de BF** pentru evoMAG, ITGalaxy, CITGrup și Vexio sunt estimări pe baza anului trecut.
- **Comisioane:** evoMAG 1% fix de BF (termeni 2Performant, raportul din 27.09); ITGalaxy 2% (pe Apple, de verificat); CITGrup 8% (statutul real de afiliere, de verificat în panou).
- **Cauza scumpirilor:** scumpirea RAM e confirmată global (TrendForce, Counterpoint), dar nu putem demonstra pentru fiecare produs că nu e o creștere de dinainte de BF. În texte scriem „prețul a urcat”, cu graficul, fără să acuzăm magazinul.
- **`gsc_daily` subraportează** (35–50% din afișări). Pentru măsurători, folosește interfața GSC sau P1.5 din audit.

---

## 9. Context sezonier (următoarele 6–8 săptămâni)

- **Scumpiri de componente:** TrendForce estimează creșteri de până la ~40% la laptopurile mainstream din cauza RAM-ului și a stocării. Lenovo, Dell, HP, Acer și ASUS au anunțat creșteri în a doua jumătate a lui 2026. Memoria pentru telefoane a crescut cu peste 80% față de trimestrul anterior în T2 2026 (Counterpoint). Reducerile de BF pot fi deci mai mici decât anul trecut, iar „reducerea” poate porni de la un preț deja urcat. Tocmai asta e povestea noastră. Surse: [club386](https://www.club386.com/laptop-prices-risin/), [playtech](https://playtech.ro/2026/criza-de-memorie-ram-se-pregateste-sa-loveasca-telefoanele-laptopurile-si-consolele-iar-efectele-se-vor-vedea-direct-in-preturi/), [mobilissimo](https://www.mobilissimo.ro/editoriale-telefoane/telefonul-de-250-de-euro-este-in-pericol-ram-ul-scump-loveste-inclusiv-modelele-accesibile).
- **Telefoane:** iPhone 18 Pro / Pro Max sunt în vânzare din 18 sept., iar iPhone 17 Pro / Pro Max sunt acum „generația trecută”. iPhone 18 standard e așteptat în primăvara lui 2027, deci iPhone 17 rămâne modelul de bază de anul acesta. Galaxy A37/A57 sunt lansate în România din aprilie 2026 (de la 2.199 / 2.699 lei la lansare, [Samsung Newsroom](https://news.samsung.com/ro/samsung-galaxy-a57-5g-si-galaxy-a37-5g-sunt-acum-disponibile-in-romania), [mobilissimo](https://www.mobilissimo.ro/stiri-telefoane/samsung-a-lansat-in-romania-galaxy-a37-si-a57-cu-extra-ai-ecran-super-amoled-plus-mai-luminos-nightography-impresii)).
- **Inflația** în România a fost 8,2% (iulie 2026, Eurostat), iar TVA-ul e 21%. Oamenii sunt mai sensibili la preț, deci mesajul „verifică dacă e reducere reală” prinde mai bine.
- **Site-ul:** pe 27 oct. pornește 410 pentru paginile moarte. Petmart devine indexabil după ~3 nov. (30 de zile de istoric). Recuperarea după Spam Update durează de regulă luni, adesea până la următorul update mare. BF 2026 e mai ales o investiție (conținut, linkuri, lista de email) pentru 2027, nu o lună de venit.

---

## Surse

- [Romania Insider: eMAG anunță data BF 2026](https://www.romania-insider.com/romanias-largest-online-retailer-emag-announces-date-black)
- [mobilissimo: Când este Black Friday eMAG în 2026](https://www.mobilissimo.ro/articole-diverse/cand-este-black-friday-emag-in-2026-prima-editie-fara-iulian-stanciu-in-actionariat)
- [Știrile ProTV: Când începe BF 2026 la eMAG](https://stirileprotv.ro/stiri/black-friday/cand-incepe-black-friday-2026-la-emag-data-exacta-la-care-incep-reducerile-in-romania.html)
- [adevarul.ro: BF 2026 se schimbă în România (8 oct. 2026)](https://adevarul.ro/economie/black-friday-2026-se-schimba-in-romania-2562388.html)
- [Euronews România: BF 2026, data și perioada (7 oct. 2026)](https://www.euronews.ro/articole/black-friday-2026-romania-data-perioada-reduceri)
- [infinity.ro: calendarul magazinelor BF 2026](https://infinity.ro/blog/cand-este-black-friday-2026-perioada-infinity-si-calendarul-magazinelor/)
- [trademag: BF 2026 calendar](https://trademag.ro/articole/black-friday-2026-romania-calendar-emag-6-noiembrie)
- [wall-street.ro: BF 2025 la evomag](https://www.wall-street.ro/articol/ecommerce/black-friday-2025-la-evomag-ce-reduceri-sunt-si-in-ce-perioada-se-desfasoara.html)
- [startupcafe: datele BF 2025 evomag/Flanco](https://startupcafe.ro/black-friday-2025-in-romania-datele-oficiale-ale-campaniei-de-reduceri-la-evomag-fashion-days-si-flanco-88542)
- [Romania Insider: eMAG BF 2025 pe 7 nov.](https://www.romania-insider.com/romanian-electronics-retailer-emag-black-friday-november-2025)
- [g4media: rezultate eMAG BF 2025](https://www.g4media.ro/black-friday-2025-la-emag-peste-314-milioane-de-produse-vandute-in-primele-12-ore-cu-o-valoare-record-de-896-milioane-lei.html)
- [capital.ro: primele reduceri BF 2026](https://www.capital.ro/black-friday-2026-primele-reduceri-apar-mai-devreme-decat-se-asteptau-cumparatorii.html)
- [gadget.ro: oferte ITGalaxy BF (istoric)](https://gadget.ro/14-oferte-de-black-friday-de-la-it-galaxy/)
- [evz.ro: BF la refurbished (CIT Grup)](https://evz.ro/black-friday-si-la-produse-refurbished.html)
- [club386: prețurile laptopurilor și RAM-ul](https://www.club386.com/laptop-prices-risin/)
- [playtech: criza memoriei RAM](https://playtech.ro/2026/criza-de-memorie-ram-se-pregateste-sa-loveasca-telefoanele-laptopurile-si-consolele-iar-efectele-se-vor-vedea-direct-in-preturi/)
- [mobilissimo: RAM-ul scump și telefoanele ieftine](https://www.mobilissimo.ro/editoriale-telefoane/telefonul-de-250-de-euro-este-in-pericol-ram-ul-scump-loveste-inclusiv-modelele-accesibile)
- [Samsung Newsroom RO: Galaxy A57/A37](https://news.samsung.com/ro/samsung-galaxy-a57-5g-si-galaxy-a37-5g-sunt-acum-disponibile-in-romania)
- Rapoarte interne: `docs/seo/2026-10-05-audit-scadere-gsc.md`, `docs/seo/2026-10-04-raport-seo-ai.md`, `ads/research/2026-09-27-oportunitati-v2.md`, `ads/research/2026-10-03-ferestre-click-si-recurenta.md`, `ads/research/2026-10-05-monetizare.md`, `ads/reports/2026-10-05.md`.

---

**Alege 2–3 direcții pentru ads-builder** (sau pentru conținut / site-dev, la BF). Eu nu aleg în locul tău. Opțiunile din raport: cele 3 ghiduri (§5), hubul BF pe `/reduceri-reale` (varianta A sau B), raportul public de după 6 nov. și testul Ads refurbished CITGrup (§4.3, varianta B, opțional).
