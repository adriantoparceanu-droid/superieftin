# Oportunități Google Ads Search: Animale de companie (pet)

Data: 3 octombrie 2026 · Autor: market-research · Pentru: proprietar, apoi ads-builder
Context: campaniile pe telefoane se opresc. Întrebarea este dacă merită campanii Search noi pe pet și pe ce anume.

Raportul răspunde la **„unde câștigăm mai mult decât cheltuim, acum”**, nu la „ce se caută cel mai mult”.

---

## 1. Rezumat

1. **Acum nu trece nicio direcție pet de pragul EPC ≥ 1,3 × CPC, nici măcar în scenariul optimist.** Click-urile pe hrană pentru animale costă în România de ~5–15 ori mai mult decât pe telefoane: **1–1,7 lei** la limita de jos a intervalului top-of-page și **2,6–6,5 lei** la limita de sus (Keyword Planner, date reale). La petmart.ro rămân net ~**4%** din prețul afișat, adică ~**12–21 lei** pe un sac mare de 12–17 kg. Ca să iasă matematica ar trebui ca **7–10%** dintre vizitatorii veniți din reclamă să cumpere. Realist sunt 0,5–2%.
2. **Toate cele 4.773 de produse pet de pe site vin dintr-un singur magazin, petmart.ro (2Performant, nu Profitshare)**: 5% comision, cookie 30 de zile, 97,9% aprobare. Fiecare pagină `/p/` are o singură ofertă. **Azi nu există nicio reducere reală**: istoricul de preț abia a început („Date insuficiente”), iar toate cele 4 pagini `/reduceri-reale/` pet afișează „Acum nu avem reduceri reale”.
3. **Blocaj de verificat înainte de orice cheltuială:** în API-ul 2Performant, petmart.ro are sursele de trafic **„Google Ads – search”** și **„Price Comparison Services”** în stare **`pending_deletion`**, adică în curs de retragere. Dacă se confirmă, reclamele Search, ba chiar listarea noastră ca site de comparare, pot ajunge să încalce termenii programului, iar comisioanele pot fi anulate.
4. **Pe pet, conversiile nu se văd în Google Ads.** `tracking:sync` urcă doar comisioane Profitshare (`ac.network = 'profitshare'`), iar petmart e pe 2Performant. Campania ar merge „pe orb”, fără conversia „SE | Comision Profitshare”.
5. **Cea mai apropiată de prag e o direcție pe care încă nu o avem în catalog: litierele automate** (~1.400–1.900 lei/buc, 4.400 de căutări/lună, CPC 0,42–2,16 lei). Ar trece pragul doar la CPC-ul de jos și cu 1% conversie (1,44×). Dintre produsele existente, cele mai „puțin rele” sunt sacii mari premium (Acana/Orijen 11,4–17 kg, Hill's Science Plan 14–18 kg, Royal Canin 15 kg). **Recomandarea mea: nicio campanie pet acum.** Cel mult un test de date mic și plafonat, după ce se rezolvă punctele 3 și 4 (vezi 3.0).

---

## 2. Tabel: direcții ordonate după potențial

**Formule** (din rolul market-research):
- *Comision efectiv petmart* = 5% × (1 ÷ 1,21, comisionul e „după scăderea taxelor, transportului”) × 97,7% aprobare (din valoare) = **4,04% din prețul afișat**. Dacă cei 5% se aplică pe prețul cu TVA, ar fi 4,9%, dar nu schimbă concluzia.
- *Valoare pe vânzare* = preț mediu × 1,1 (presupun ~10% alte produse în coș, transport gratuit peste 199 lei) × 4,04%.
- *EPC* = rata de conversie × valoarea pe vânzare. **Rata de conversie e o presupunere: 1%** pentru căutări pe un produs sau o gamă anume, cu landing pe pagina de produs, și 0,5% pentru căutări generice. Raportul pe tech a pornit de la 0,5%. Am pus mai mult aici pentru că hrana e un consumabil cumpărat cu intenție clară, dar **nu avem nicio dată proprie**.
- *CPC* = intervalul top-of-page din Keyword Planner (RON, sept. 2025 – aug. 2026, date reale). Marja și scorul folosesc limita de sus, ca în raportul din 27.09. Limita de jos e scenariul optimist.
- *Clickuri/lună* = volum × 50% cotă de afișări × 5% CTR.
- *Factor reducere* = **0,1** pentru tot pet-ul. Azi nu există nicio reducere reală și niciun istoric, deci site-ul nu are încă avantaj competitiv aici.
- *Scor* = marjă × clickuri × factor reducere. *Rezultat/lună* = marjă × clickuri, adică cât am pierde sau câștiga dacă am lansa la CPC-ul de sus.

| # | Direcție → landing | Volum/lună (KP) | CPC estimat (jos–sus) | Comision efectiv | Valoare/vânzare | EPC (1%) | EPC/CPC sus (jos) | Marjă/click | Clickuri/lună | Scor | Rezultat/lună | Conversie necesară (CPC jos / sus) | Încredere |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | **Litiere automate** → *nu există în catalog* | 4.400 | 0,42–2,16 | ~4,0% | ~61 lei (la ~1.500 lei/buc) | 0,61 | 0,28 (**1,44**) | −1,55 | ~110 | −17 | −171 lei | **0,9%** / 4,6% | scăzută (fără produse, preț estimat) |
| 2 | **Acana / Orijen 11,4–17 kg** → `/p/` | ~2.300 | 1,1–4,5 | 4,04% | 21,3 lei | 0,21 | 0,05 (0,19) | −4,29 | ~58 | −25 | −249 lei | 6,7% / 27% | medie |
| 3 | **Hill's Science Plan 14–18 kg** (fără Prescription Diet) → `/p/` | ~2.700 | 1,6–4,4 | 4,04% | 20,7 lei | 0,21 | 0,05 (0,13) | −4,19 | ~68 | −28 | −285 lei | 10% / 28% | medie |
| 4 | **Royal Canin câini 15 kg** (Maxi/Medium/Giant, Adult/Puppy) → `/p/` | ~3.000 | 1,2–3,4 | 4,04% | 15,5 lei | 0,16 | 0,05 (0,13) | −3,24 | ~75 | −24 | −243 lei | 10% / 28% | medie |
| 5 | **Purina Pro Plan 10–14 kg** → `/p/` | ~3.200 | 1,0–2,6 | 4,04% | 13,5 lei | 0,13 | 0,05 (0,13) | −2,47 | ~80 | −20 | −197 lei | 9,7% / 25% | medie |
| 6 | **Pisici sterilizate, saci 10–15 kg** (RC Sterilised, Advance Cat, Pro Plan) → `/p/` | ~2.400 | 1,1–3,3 | 4,04% | 14,7 lei | 0,15 | 0,04 (0,13) | −3,15 | ~60 | −19 | −189 lei | 9,8% / 29% | medie |
| 7 | **Josera / Brit Care / Carnilove / Monge 12–15 kg** → `/p/` | ~4.800 | 0,85–3,2 | 4,04% | 12,4 lei | 0,12 | 0,04 (0,15) | −3,08 | ~120 | −37 | −369 lei | 8,9% / 34% | medie |
| 8 | Fântâni de apă pentru pisici → *nu există în catalog* | 2.400 | 0,49–1,97 | ~4,0% | ~7 lei | 0,07 | 0,04 (0,15) | −1,90 | ~60 | −11 | −114 lei | 8,8% / 35% | scăzută |
| 9 | Generic „hrană uscată câini/pisici” → `/c/hrana-uscata` | ~5.000 | 1,25–4,3 | 4,04% | ~8 lei | 0,04 (0,5%) | 0,01 (0,03) | −3,96 | ~125 | −50 | −495 lei | 20% / 64% | medie |
| 10 | Nisip pentru pisici → *nu există în catalog* | 4.400 | 1,19–5+ | ~4,0% | ~3 lei | 0,03 | 0,01 (0,02) | −4,97 | ~110 | −55 | −547 lei | >50% | ridicată |
| 11 | Hrană umedă / jucării / recompense → `/p/`, `/c/` | ~6.000 | 0,5–4,0 | 4,04% | ~2 lei | 0,02 | 0,01 (0,04) | −3,98 | ~150 | −60 | −597 lei | >30% | ridicată |

**Despre volume:** sunt sume ale variantelor de produs, nu ale termenilor de brand. De exemplu, la #4: „royal canin mini adult” 880, „maxi adult” 390, „medium adult” 210, „maxi puppy” 320, „giant puppy” 320, „puppy” 1.000 etc. Nu toți cei care caută cer sacul mare. Termenii de brand singuri („royal canin” 6.600, „hills” 2.400, „purina pro plan” 2.400) sunt prea largi pentru o pagină de produs.

**Concluzia tabelului:** nicio direcție nu atinge 1,3× la CPC-ul de sus, nici la cel de jos cu produsele pe care le avem. Singura excepție teoretică e #1, unde produsele lipsesc. Chiar dacă rata de conversie ar fi 3% (de trei ori presupunerea), sacii de 15 kg ar ajunge abia la 0,4–0,6× CPC-ul de jos.

### 2.1 Economia pe magazin (pet)

| Magazin | Rețea | Comision | Bază | Aprobare | Cookie | Google Ads Search (în 2P) | Comparatoare de prețuri (în 2P) | La noi |
|---|---|---|---|---|---|---|---|---|
| **petmart.ro** | 2Performant (acceptat) | 5% (fără condiții speciale) | fără taxe/transport | 97,9% număr / 97,67% valoare | 30 de zile | **da, dar `pending_deletion`** | **da, dar `pending_deletion`** | 4.773 produse, singurul magazin pet |
| petmax.ro | 2Performant (neafiliat încă) | 5% | — | 93% | 30 de zile | da, activ | da, activ | — |
| pentruanimale.ro | 2Performant (neafiliat încă) | 5% | — | 100% | 31 de zile | da, activ | da, activ | — |
| fera.ro | 2Performant | 5% | — | 66% | 30 de zile | **nu** (deleted) | da | — |
| eMAG (categorii pet) | Profitshare | necunoscut la pet (grila e doar în cont) | fără TVA | ~70% | 15 zile (presupus, ca la „rest”) | — | — | categoriile pet există în catalogul de scanare (`hrana-pentru-caini`, `hrana-pentru-pisici`, `litiere`, `accesorii-litiere` …), dar **nu sunt scanate** |

- **Profitshare nu are niciun magazin pet** printre cei 82 de advertiseri din `affiliate_advertisers`. Pet-ul înseamnă azi doar 2Performant.
- Media categoriei „Pet supplies” în 2Performant: 14 programe, comision mediu 6%, aprobare medie 94–95%.
- Termenii petmart (descrierea programului): „Comisionul afiliaților 2Performant este: 5% (după scăderea taxelor, transportului etc.). Perioada de recurență standard: 30 de zile.” Comenzile se aprobă în ~30 de zile, iar plata medie vine în 34 de zile.
- **Recurența:** cookie-ul de 30 de zile prinde și a doua comandă doar dacă vine în acea fereastră. Un sac de 15 kg ține de obicei 4–8 săptămâni, deci recomanda de obicei pică în afara ferestrei, dacă omul nu revine prin noi. Recurența nu salvează matematica pe un singur click plătit.
- **Coșul mediu petmart:** lipsește. În 2Performant nu avem nicio comandă petmart (API: 0 comisioane). Am estimat ~10% în plus peste produsul principal.

### 2.2 Factorul de reducere

- **Azi: 0 reduceri reale** în toate cele 4 categorii pet (`/reduceri-reale/animale-de-companie`, `hrana-uscata`, `hrana-umeda`, `jucarii-pet`, toate verificate public azi). La `hrana-uscata` și `jucarii-pet` nu există nici măcar „cele mai apropiate de o reducere”, pentru că nicio ofertă nu are încă ≥2 puncte de preț în 30 de zile. Pagina de produs (ex. Royal Canin Maxi Adult 3 kg) afișează „Preț în intervalul obișnuit (egal cu mediana)” și „Istoricul prețului: Date insuficiente”.
- Concluzie: feed-ul petmart a intrat în producție de foarte puțin timp. Primele reduceri reale vor putea apărea abia după ce se adună istoric, realist în **2–4 săptămâni**. Nu avem date despre cât de des face petmart reduceri reale pe hrană. Prețurile la hrana de brand sunt de obicei stabile, iar promoțiile vin pe gamă sau brand (luna brandului, Black Friday).

---

## 3. Direcțiile principale: detalii (condiționate, NU de lansat acum)

### 3.0 Condiții înainte de orice test pet (în ordinea importanței)

1. **Confirmare scrisă de la petmart / 2Performant** (manager afiliat pe program: Cristina Drăghici, din partea petmart; AM 2Performant: Alexandru Foaie) că Google Ads Search spre un comparator și listarea ca „Price Comparison Service” sunt permise după schimbarea `pending_deletion`. Acordul general cu 2Performant din 27.09 nu acoperă neapărat termenii acestui advertiser.
2. **Măsurarea conversiilor 2Performant**: fie extinderea `tracking:sync` la 2Performant (subid-ul `st=` există deja în `ad_clicks`, task pentru agentul tracking), fie acceptarea unei potriviri manuale. Fără asta, testul nu produce date folosibile.
3. **Al doilea magazin pet pe aceleași pagini** (petmax.ro sau pentruanimale.ro). Ambele permit activ Google Search și comparatoare. Atenție: **toate produsele pet au `brand = null`**, deci unificarea după `part_no` + brand și filtrul de brand de pe `/c/` nu funcționează (task pentru site-dev).
4. **Primele reduceri reale vizibile** pe landing. Până atunci, anunțurile nu au argumentul site-ului, iar `/reduceri-reale/*` pet ar pica la `ads:validate`, care cere „Reducere reală” și %.

Dacă proprietarul vrea totuși date reale de CPC și conversie, varianta minimă ar fi: **o singură direcție (#2 sau #4), exact match, 15 lei/zi, CPC maxim 1,20 lei, 14 zile**. Plafonul de cheltuială e ~210 lei. Pierderea așteptată e aproape tot bugetul: e cost de învățare, nu investiție. Se încadrează în guardrails (≤50 lei/zi/campanie, CPC ≤3,00).

### 3.1 Litiere automate (#1): extindere de catalog, nu campanie

- **Intenții:** cumpărare cu comparare („litieră automată preț”, „cea mai bună litieră automată”), modele (Petkit, Catlink).
- **Ce lipsește:** produsele. Nu știm dacă feed-ul petmart le are: din 13.109 produse petmart avem 4.773 (hrană uscată, umedă, jucării, recompense). Primul pas e Admin → Surse feed → „Alege categoriile” pe feed-ul petmart, de verificat dacă există o categorie de litiere sau accesorii. Altfel, scanarea eMAG `litiere` (Profitshare, comision pet necunoscut).
- **Cuvinte cheie propuse** (după ce există produse): `[litiera automata]`, `"litiera automata"`, `[litiera automata pisici]`, `"litiera automata pisici"`, `[litiera autocuratare]`, `"litiera autocuratare"`, `[litiera inteligenta pisici]`, `[litiera automata pret]`, `"litiera automata pret"`, `[cea mai buna litiera automata]`, `[petkit pura max]`, `"petkit pura"`, `[catlink litiera]`, `"catlink scooper"`.
- **Negative evidente:** `second hand`, `olx`, `folosita`, `piese`, `reparatie`, `service`, `filtru`, `saci`, `nisip`, `diy`, `cum`, `emag`, `altex`, `animax`, `petmart`, `petmax`, `zooplus`, `dedeman`.
- **Landing:** `/c/<categorie-noua-litiere>` sau `/p/` pe model. Nu există încă.
- **Buget de test:** 0 până când există produse. După aceea, 20 lei/zi, CPC maxim 1,00 lei.

### 3.2 Acana / Orijen saci 11,4–17 kg (#2)

- **Produse verificate pe site** (petmart, câte o ofertă fiecare): Acana Dog Miel & Mere 17 kg (649,87 lei), Ranchlands 11,4 kg (506,62), Junior Talie Mare 17 kg (503,65), Free Run Duck 11,4 kg (490,27), Adult Talie Mare 17 kg (487,40), Pacifica 11,4 kg (422,73); Orijen Regional Red 11,4 kg (599,21), 6 Fish (494,57), Original (454,42), Junior Talie Mare (468,48).
- **Intenții:** reaprovizionare cu brandul deja ales, plus gramaj („17 kg”, „11.4 kg”).
- **Cuvinte cheie:** `[acana miel si mar 17 kg]`, `"acana miel si mar"`, `[acana 17 kg]`, `"acana 17 kg"`, `[acana 11.4 kg]`, `[acana puppy large breed]`, `[acana junior talie mare]`, `[acana ranchlands]`, `[acana pacifica]`, `[acana free run duck]`, `[acana grasslands]`, `[orijen original]`, `[orijen regional red]`, `[orijen 6 fish]`, `"orijen caini"`, `[orijen 11.4 kg]`.
- **Negative:** `pisici`/`pisica` (gama Acana pisici e mică la noi), `umeda`, `conserva`, `plic`, `340 g`, `2 kg`, `mostra`, `recenzii`, `compozitie`, `cantitate`, `tabel`, `petmart`, `animax`, `zooplus`, `petmax`, `emag`, `olx`.
- **Landing:** `/p/<produs>` exact (ex. `/p/hrana-uscata-caini-acana-dog-miel-mere-17-kg`). Nu folosi `/c/hrana-uscata`: e sortată crescător după preț, deci primele produse sunt plicuri de 400 g, iar filtrul de brand nu merge.
- **Buget de test:** 15 lei/zi, CPC maxim 1,20 lei, doar exact match.

### 3.3 Hill's Science Plan 14–18 kg (#3)

- **Produse:** Science Plan Canine Adult Medium Lamb & Rice 18 kg (561,39), Senior Vitality Medium/Large 14 kg (520,26), Adult Large Light 18 kg (514,21), Mature Adult Large 18 kg (509,37), Puppy Medium 18 kg (505,74); Feline Adult Sterilised Salmon/Chicken 15 kg (671,49).
- **Cuvinte cheie:** `[hills science plan]`, `"hills science plan"`, `[hills science plan 18 kg]`, `[hills adult large breed]`, `[hills puppy medium]`, `[hills senior vitality]`, `[hills sterilised cat 15 kg]`, `"hills sterilised pisici"`, `[hills mancare caini]`, `"hills mancare caini"`, `[hills pisici]`.
- **Negative (importante):** `prescription`, `pd`, `zd`, `id`, `kd`, `cd`, `renal`, `urinary`, `gastro`, `metabolic`, `vet`, `veterinar`, `dieta`, `boala`. Sunt diete veterinare, iar un anunț pe ele împinge spre afirmații de sănătate (spiritul regulii 8). Plus brandurile retailerilor (petmart, animax, zooplus, petmax, emag).
- **Landing:** `/p/` pe produs.
- **Buget de test:** 15 lei/zi, CPC maxim 1,50 lei.

### 3.4 Royal Canin câini 15 kg (#4)

- **Produse:** Maxi Adult 15 kg (361,12), Medium Adult 15 kg (361,13), Maxi Adult 5+ (379,19), Maxi/Medium Puppy 15 kg (424,13), Giant Puppy / Giant Junior 15 kg (402,91), Maxi/Medium Starter 15 kg (462,69).
- **Cuvinte cheie:** `[royal canin maxi adult]`, `"royal canin maxi adult"`, `[royal canin maxi adult 15 kg]`, `[royal canin medium adult]`, `[royal canin medium adult 15 kg]`, `[royal canin maxi puppy]`, `[royal canin maxi puppy 15 kg]`, `[royal canin giant puppy]`, `[royal canin giant junior]`, `[royal canin maxi starter]`, `[royal canin medium puppy]`, `[royal canin maxi adult 5+]`, `"royal canin 15 kg"`.
- **Negative:** `pisici`, `kitten`, `mini`, `x-small`, `umeda`, `plic`, `conserva`, `gastro`, `hypoallergenic`, `anallergenic`, `urinary`, `renal`, `recovery`, `veterinary`, `4 kg`, `3 kg`, `1 kg`, plus brandurile retailerilor.
- **Landing:** `/p/` pe produs.
- **Buget de test:** 15 lei/zi, CPC maxim 1,20 lei.

### 3.5 Purina Pro Plan 10–14 kg (#5)

- **Produse:** Adult Sensitive Digestion Talie Medie/Mare Miel 14 kg (341,01), Adult Light Sterilised 14 kg (341,01), Adult Performance 14 kg (341,01), Kitten Healthy Start 10 kg (334,21), Adult Vital Functions 10 kg (310,42).
- **Cuvinte cheie:** `[purina pro plan 14 kg]`, `"pro plan 14 kg"`, `[pro plan sensitive digestion]`, `"pro plan sensitive digestion"`, `[pro plan large robust]`, `[pro plan large athletic]`, `[pro plan medium adult]`, `[purina pro plan medium adult]`, `[pro plan light sterilised]`, `[pro plan kitten 10 kg]`, `[purina pro plan caini]`, `[proplan]`.
- **Negative:** `renal`, `veterinary diets`, `ha`, `en`, `ur`, `om`, `plic`, `umeda`, `400 g`, `1.5 kg`, `3 kg`, plus brandurile retailerilor. Ofertele „Renal Plus” și „Delicate Digestion” rămân pe site, dar nu intră în anunțuri.
- **Landing:** `/p/`.
- **Buget de test:** 15 lei/zi, CPC maxim 1,00 lei.

**Text de anunț (pentru toate):** fără „redus”, „sub mediană” sau procente spre `/p/` (verdict B1). Pe pet nu există azi nicio reducere care să poată fi afirmată (regula 9). Argumentul ar rămâne „compară prețul, istoric de preț, alertă de preț”, iar azi nici istoricul nu e disponibil.

---

## 4. De evitat (cu motiv)

| Direcție | Motiv |
|---|---|
| **Orice campanie pet înainte de confirmarea petmart** | Sursele „Google Ads – search” și „Price Comparison Services” sunt `pending_deletion` în programul petmart. Riscăm comisioane anulate sau excluderea din program. |
| Generic „hrană uscată câini/pisici”, „hrana caini”, „hrana animale” | CPC 1,25–7 lei, landing-ul `/c/` e sortat crescător după preț (primele sunt plicuri mici), conversie mică. EPC de ~0,04 lei, adică <3% din CPC. |
| Hrană umedă, plicuri, conserve, jucării, recompense (~3.000 de produse) | Valoare medie 10–30 lei, deci ~0,5–1 leu comision pe vânzare. Nu acoperă nici un click. Cel mult extensii de anunț, niciodată grupuri principale. |
| Nisip pentru pisici | Nu e în catalog. Valoare de ~30–80 lei pe sac, iar CPC-ul de sus ajunge la 19 lei (concurență pe Shopping). |
| Fântâni de apă | Nu sunt în catalog. Produs de 100–250 lei, 8,8% conversie necesară la CPC-ul minim. |
| **Diete veterinare** (gastro intestinal, renal, urinary, hypoallergenic/anallergenic, recovery, Prescription Diet, Vet Life) și **Forti Flora** (supliment) | Cerere mare (Royal Canin Gastro 1.300, Hypo/Anallergenic 1.300, Forti Flora 720), dar vin cu afirmații de sănătate (spiritul regulii 8) și cu riscul politicilor Google pe produse veterinare. În plus, cumpărătorul are de obicei rețetă sau recomandare de la veterinar. |
| Termeni de brand ai retailerilor: „petmart” (4.400), „zooplus” (40.500), „animax” (33.100), „petmax” (8.100), „pentruanimale” (880), „pet shop” (12.100, navigațional) | Brandurile retailerilor sunt de regulă interzise în programele de afiliere. „pet shop” e căutare navigațională spre magazine fizice. **Toate intră ca negative.** |
| Termeni de brand de producător singuri („royal canin” 6.600, „hills” 2.400, „purina one”, „whiskas”, „pedigree”) | Prea largi (hrană umedă, plicuri, pisici și câini amestecate). „whiskas”, „pedigree”, „farmina”, „happy dog”, „eukanuba” nici nu există pe site. |
| `/reduceri-reale/*` pet ca landing | Arată „Acum nu avem reduceri reale”, deci pică la `ads:validate` și la regula 9. |

---

## 5. Presupuneri și date lipsă

**Date reale folosite:**
- Catalogul pet de pe site, citit **public** azi din paginile `/c/` (102 pagini, fără niciun acces la `/go/`): 4.773 de oferte unice, toate petmart.ro, toate fără reducere. Pe categorii: `hrana-uscata` 1.945 (mediana prețului 139,77 lei; 527 peste 250 lei), `hrana-umeda` 1.235 (mediana 9,83 lei), `jucarii-pet` 866 (mediana 19,61 lei), plus 782 de produse puse direct pe părintele `animale-de-companie` (recompense, hrană pentru pești sau rozătoare; mapare incompletă, mediana 16,10 lei).
- Programul petmart din API-ul 2Performant (citire): comision, cookie, aprobare, surse de trafic. Celelalte programe pet din 2P.
- Keyword Planner prin API (`generateKeywordHistoricalMetrics` + `generateKeywordIdeas`, contul 2760086909, doar citire): ~120 de cuvinte istorice plus 1.000 de idei, RO, limba română.

**Ce lipsește și ar crește încrederea:**
1. **Baza de date locală nu are pet deloc.** Copia locală e din ~26 septembrie: 0 categorii, 0 produse, 0 click-uri pet; `click_events` până pe 26.09, `search_queries` are doar 4 rânduri. Categoria a apărut doar în producție, iar baza de producție nu am accesat-o. **Nu am semnale interne de vânzare:** click-uri pe produse pet, căutări interne pe site, GA4 pe categoriile pet. Un export (doar SELECT) din producție cu `click_events` și `ad_clicks` pe ofertele petmart de la lansare ar arăta ce caută și ce apasă vizitatorii.
2. **Nicio comandă petmart prin noi** (2Performant: 0 comisioane). Rata de conversie de 1% e o presupunere.
3. **Coșul mediu petmart:** l-ar putea da AM-ul 2Performant.
4. **Prețurile petmart față de concurență** (Animax, eMAG, Zooplus): necomparate. Dacă petmart e mai scump la sacii mari, conversia reală scade sub presupunere.
5. **Comisionul eMAG pe categoriile pet** (Profitshare, grila din cont): ar decide dacă merită scanate `hrana-pentru-caini`, `hrana-pentru-pisici` și `litiere`.
6. **Sensul exact al `pending_deletion`** la petmart și al `commission_variation: -8.75` (probabil o scădere recentă a câștigului mediu pe program).
7. **CPC-ul real pentru un cont nou:** intervalul KP e top-of-page. Un test de 14 zile ar da CPC-ul efectiv. Dar `max_cpc: 3.00` din guardrails e sub limita de sus pentru majoritatea termenilor pet, deci am fi mai jos în pagină.

**Observații pentru alți agenți (în afara scopului acestui raport):**
- `brand` e `null` la toate produsele pet, așa că filtrul de brand de pe `/c/` și unificarea după `part_no` + brand nu funcționează. Există și dubluri (ex. „Brit Care Dog Grain-Free Adult Large Breed, 12 kg” apare de două ori). Task pentru site-dev.
- Pet apare în meniu sub „Mai multe ▾”. Categoria „Elecrocasnice” are o greșeală de tipar în nume și în slug.
- În 2Performant, la evomag (411), sursa „Google Ads – search” apare `no / deleted`. Merită verificat față de acordul din 27.09, pentru campaniile non-pet.

---

## 6. Context sezonier (3 octombrie – sfârșitul lui noiembrie 2026)

- **Hrana e stabilă tot anul:** suma termenilor principali a variat ±10% în ultimele 12 luni (KP: 19.700–23.800 pe lună). Octombrie–noiembrie 2025 au fost ușor peste medie (+5–10%). Sezonalitatea nu schimbă matematica.
- **Litierele și jucăriile cresc în Q4.** „Litieră pisici” a avut 12.100 de căutări în octombrie–noiembrie 2025, față de 8.100 în august. „Litieră automată” 5.400 față de 4.400. „Jucării pisici” are vârful în noiembrie–decembrie (2.900 față de 1.600–1.900). Acestea sunt cadouri și achiziții de Black Friday.
- **Black Friday:** în România cade de obicei în prima jumătate a lui noiembrie (eMAG 2025: 7 noiembrie; Animax a avut BF pe 11–13 noiembrie în 2022). Petshop-urile mari (Animax, eMAG, Zooplus) intră agresiv în licitații, așa că **CPC-urile pet cresc în noiembrie**. Dacă petmart are reduceri reale de BF, le-am putea detecta doar dacă istoricul de preț are până atunci 2–4 săptămâni (feed-ul a intrat recent, deci la limită).
- **Decembrie:** recompense și jucării de Crăciun (petmart are deja „X-Mas” Trixie), valoare mică. Nu schimbă concluzia.
- **Ce merită făcut în fereastra asta fără buget de reclame:** se adună istoricul de preț. Dacă proprietarul decide, se pot adăuga un al doilea magazin pet (petmax / pentruanimale) și categoria de litiere. Primele reduceri reale vor apărea pe paginile pet indexate organic (4.773 de pagini în sitemap). Reevaluarea are sens după ~1 noiembrie, cu 30 de zile de istoric, eventuale prime comenzi petmart și răspunsul petmart despre sursele de trafic.

---

Alege 2–3 direcții pentru ads-builder.
