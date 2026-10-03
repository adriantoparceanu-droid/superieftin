# Ferestre de click (recurență) și comisioane respinse eMAG

Data: 3 octombrie 2026 · Autor: market-research · Pentru: proprietar, apoi ads-builder
Întrebarea: de ce se pierd comisioanele eMAG („Produs anulat din motive de recurență”) și pe ce magazine merită trafic plătit, dată fiind fereastra de click și comisionul fiecăruia.

Ce am folosit: termenii publici eMAG de pe profitshare.ro, T&C Profitshare, API Profitshare `affiliate-advertisers` (10 apeluri, doar citire), API 2Performant `programs` (doar citire), DB de producție (doar SELECT). Nu am accesat linkuri `/go/` sau de afiliere și nu am trimis nicio cerere către site-urile magazinelor.

---

## 1. Rezumat

1. **„Anulat din motive de recurență” înseamnă că comanda a venit după ce s-a închis fereastra de comisionare a categoriei.** Nu e vorba de un client recurent. Profitshare definește în T&C „perioada de recurență” ca „perioada maxima de timp stabilita de catre fiecare Advertiser, in care se poate inregistra Conversia si care incepe de la momentul ultimei accesari (click)”. La eMAG fereastra e de **2 zile pentru telefoane mobile, televizoare și laptopuri/notebook-uri** și de 15 zile pentru restul (în vigoare din 27.10.2025). Laptopul Lenovo a avut click pe 22.09 și comandă pe 02.10, adică după 10 zile, deci peste limita de 2 zile. **Proprietarul a avut dreptate.**
2. **Toate cele 511 oferte eMAG disponibile pe site sunt exact din cele trei categorii cu 2 zile** (telefoane 176, laptopuri 169, televizoare 166). Toate cele 8 comisioane eMAG anulate rapid sunt la 1,70% și au fost anulate automat la :30 fix, la 7–75 de minute după comandă. Tiparul se potrivește cu o regulă automată de fereastră, nu cu anulări făcute de clienți.
3. **Riscul mai mare nu e fereastra, ci termenii eMAG.** Secțiunea 2 a termenilor eMAG spune explicit că „Promovare prin Google AdWords, Facebook Ads sau alte campanii de tip «Pay-per-Click» nu este permisa”. Tot acolo, linkurile eMAG nu sunt acceptate pe site-uri care „preiau automat informatii de pe website-ul eMAG […] (ex site-uri comparatoare de preturi)” sau „sunt construite sub forma unor comparatoare de preturi”. Acordul general Profitshare din 27.09 nu înlocuiește neapărat termenii eMAG. **Fără acordul scris al eMAG, traficul plătit spre ofertele eMAG pune în pericol toate comisioanele eMAG**, iar termenii eMAG pot pune sub semnul întrebării chiar și listarea organică.
4. **Pentru trafic plătit, cea mai bună variantă rămâne ITGalaxy.** Are 60 de zile fereastră, permite explicit Google AdWords (cu brandul ca negativ), aprobare 88% și comision 2% (10% pe NEX). Rowenta (2Performant: 4%, 30 de zile, Search activ) e a doua opțiune, cu o condiție grea: „Rowenta” e cuvânt interzis, deși e brandul tuturor produselor. **De evitat pentru trafic plătit:** eMAG (PPC interzis, 2 zile pe categoriile noastre), evoMAG (Google Ads Search scos din program, 10 zile, 1,5%), Vexio (Google Ads interzis, 5 zile), Mindblower și Vegis.
5. **Problemă de măsurare descoperită pe parcurs:** niciunul din cele 19 comisioane Profitshare nu are câmpul `hash` (click_id) completat. Asta include și comenzile de după 26.09, când `ad_clicks` funcționa deja. Deci nu putem lega comisioanele de clickuri și nu putem calcula singuri timpul de la click la comandă. Merită un task pentru agentul tracking și o întrebare către Profitshare (inclusă în mesajul din secțiunea 7).

---

## 2. Ce înseamnă „anulat din motive de recurență”

### 2.1 Confirmat din surse

| Afirmație | Sursă |
|---|---|
| „Perioada de recurenta desemneaza perioada maxima de timp stabilita de catre fiecare Advertiser, in care se poate inregistra Conversia si care incepe de la momentul ultimei accesari (click) de catre Vizitator” | [T&C Profitshare](https://profitshare.ro/terms), definiții |
| Atribuirea e pe ultimul click: comisionul revine afiliatului care a generat „ultima accesare a Vizitatorului (ultimul click)” | [T&C Profitshare](https://profitshare.ro/terms), 7.1.2 |
| Advertiserul poate respinge comisioane „conform regulamentului propriu” (definiția „Comision anulat”) | [T&C Profitshare](https://profitshare.ro/terms) |
| „Incepand cu 27 octombrie 2025, perioada de comisionare pentru comenzile eMAG variaza intre 2 zile si 15 zile […] Categoriile de produse cu 2 zile perioada de comisionare sunt: telefoane mobile, televizoare, laptop / notebook.” | [Termenii eMAG pe Profitshare](https://profitshare.ro/affiliate-programs/retail/emag), secțiunea 1 |
| De la 27.10.2025, recurența a crescut de la 1 zi la 15 zile pentru toate produsele, cu excepția televizoarelor, telefoanelor și laptopurilor, unde e de 2 zile | [Blog Profitshare, 27.10.2025](https://blog.profitshare.ro/emag-anunta-actualizari-importante-pentru-programul-de-afiliere-perioada-extinsa-de-recurenta-comisioane-mai-mari-si-bonusuri-de-black-friday/) |
| Istoric: eMAG a scăzut recurența de la 3 la 2 zile (01.2018), apoi la 24 h (16.05.2018). În limbajul afiliaților RO, „recurență” = fereastra de la click la comandă. | [dragosbunea.ro, 2018](https://dragosbunea.ro/emag-reduce-recurenta-la-doar-24-de-ore-si-scade-majoritatea-comisioanelor/) |
| Același termen apare și în 2Performant: petmart „Perioada de recurență standard: 30 de zile”, noriel „Perioada de recurenta: 14 zile”, evoMAG „Perioada de comisioanare (recurenta)” | API 2Performant, descrierile programelor |
| De Black Friday, eMAG folosește cookie și recurență dedicate evenimentului. Cookie-urile standard plasate înainte NU mai generează conversii în timpul evenimentului. | [Termenii eMAG](https://profitshare.ro/affiliate-programs/retail/emag), secțiunea 6 + blogul de mai sus |

### 2.2 Deducție (puternică, dar nu confirmată în scris de eMAG)

- **Mecanismul:** cookie-ul Profitshare trăiește mai mult de 2 zile, așa că o comandă de laptop/telefon/TV de după 2 zile se **înregistrează** totuși. eMAG o validează apoi automat cu fereastra categoriei și o anulează cu motivul „recurență”. Asta explică de ce comisionul apare și dispare în aceeași oră.
- **Dovezi din datele noastre** (`affiliate_conversions`, prod, 19 comisioane Profitshare):
  - Toate cele **8 anulări rapide eMAG sunt produse la 1,70%** (rata laptopurilor, confirmată de screenshot). Statusul s-a schimbat mereu la `:30:03`/`:30:04`, la 7–75 de minute după comandă. Arată ca un job automat, nu ca o anulare făcută de client.
  - Cele două comisioane eMAG cu altă rată (1,40% și „0,50%”) au fost anulate după 5 zile, respectiv 32 de zile. Asta seamănă cu anulări sau retururi obișnuite.
  - **Aceeași valoare apare de mai multe ori:** 46,36 lei de 4 ori (25.09, 30.09, 02.10 ×2), adică ~2.727 lei fără TVA. Apoi 49,17 lei: o dată **în așteptare** pe 24.09 (comanda #3, cu încă un accesoriu la 9%) și o dată **anulat** pe 30.09. Explicația cea mai probabilă: același vizitator, cu un click mai vechi (cookie încă valid), a comandat sau recomandat același produs în zile diferite. Comanda din primele 2 zile după click trece, iar cele de după sunt anulate pentru „recurență”. Pentru 49,17 se potrivește perfect: 24.09 în fereastră, 30.09 în afara ei.
  - Comenzile mari pe categorii de 15 zile (#5: 13 produse la 1,4–7,4%, 393,84 lei; #4, #45, #46) sunt **în așteptare**, nu anulate.
- **Ce NU am putut verifica:** data clickului pentru celelalte comenzi. Câmpul `hash` lipsește pe toate comisioanele, iar `ad_clicks` există abia din 26.09. Singura pereche click → comandă sigură e cea din screenshot (10 zile).

### 2.3 Ipotezele cerute, una câte una

| Ipoteză | Verdict | De ce |
|---|---|---|
| Comanda e în afara ferestrei de click a categoriei (2 zile) | **Confirmată ca sens al termenului** (T&C Profitshare + termenii eMAG). Pentru comanda din screenshot e confirmată și pe date (10 zile > 2). | vezi 2.1 |
| Clientul a mai cumpărat recent același produs sau categorie | Nesusținută | Nicio sursă nu leagă „recurența” de istoricul clientului. Termenul e definit oficial ca fereastră de timp de la click. |
| Comenzi repetate de același client (mai multe încercări) | Parțial, ca **efect**, nu cauză | Valorile repetate arată că același om a comandat de mai multe ori. Comenzile sunt anulate însă pentru că vin după 2 zile de la click, nu pentru că sunt repetate. Dacă ar fi fost „comenzi duplicate”, motivul afișat ar fi fost altul. |
| Client existent eMAG (doar clienți noi plătesc) | Nesusținută | Termenii eMAG nu condiționează comisionul de client nou. Exclud doar clienții „Corporate”, donațiile și măștile medicale. |
| Regulă de deduplicare | Nesusținută ca motiv afișat | Atribuirea e pe ultimul click (7.1.2). Dacă alt afiliat sau o sursă eMAG ar fi luat clickul, comanda nu ar mai fi apărut deloc la noi. |

### 2.4 Se poate preveni?

- **Nu, pentru comenzile la mai mult de 2 zile de la click pe telefoane, TV și laptopuri.** E o regulă a programului. Nu putem obliga cumpărătorul să comande în 48 de ore și nici nu avem voie să-l împingem artificial (termenii interzic stimulentele).
- **Ce putem face:**
  1. Să cerem eMAG o fereastră mai lungă sau o excepție (mesajul din secțiunea 7). Șanse mici: eMAG a ținut cu bună știință aceste trei categorii la 2 zile.
  2. Pe paginile de telefoane, laptopuri și TV, să punem în față magazinele cu fereastră lungă (ITGalaxy 60 de zile, evoMAG 10 zile) când prețul e egal sau foarte apropiat. Asta e o decizie de produs pentru proprietar și site-dev. Nu trebuie ascunsă oferta mai ieftină, pentru că ar contrazice propunerea site-ului.
  3. Să adăugăm eMAG pe categorii cu 15 zile, unde comisionul observat e și mai mare (3–9% la accesorii, față de 1,4–1,7% la telefoane și laptopuri). Atenție însă la termenii eMAG despre comparatoare (secțiunea 4).
  4. Să ținem cont de efectul real: o parte din aceste anulări sunt cumpărături pe care omul le-ar fi făcut oricum, întorcându-se direct pe eMAG zile mai târziu. Nu sunt bani „furați”, ci bani pe care regula nu ni-i atribuie.

---

## 3. Ferestre de click și comisioane pe magazin

Legendă: „Fereastră” = perioada de comisionare sau recurență din termenii publici. „Aprobare” = rata de aprobare valorică și timpul mediu de aprobare de pe pagina publică Profitshare sau din API-ul 2Performant. „Activ în API” = `affiliate_statuses` Profitshare (approved/active), din 10 apeluri azi. Răspunsurile vin de pe 3 variante de server (coduri afiliat Hpz, Bcb, j9C) și nu se potrivesc între ele.

### 3.1 Magazine cu oferte pe site

| Magazin | Rețea | Comision | Fereastră | Aprobare | Google Ads Search | Comparatoare de prețuri | Activ în API (azi) |
|---|---|---|---|---|---|---|---|
| **eMAG** | Profitshare | 1–20% pe categorii. Observat la noi: laptop **1,70%**, 1,40%, accesorii 3–9% | **2 zile** telefoane, TV, laptopuri. **15 zile** restul. Cookie special de Black Friday. | 73,58%, 31 zile | **Interzis** („AdWords, Facebook Ads sau alte campanii PPC nu este permisa”). Brandul eMAG e interzis în PPC și în texte. | **Interzise** (site-uri care preiau automat informații de la eMAG / construite ca comparatoare) | Bcb: da/da (4/6). j9C: lipsă statut (2/6). Hpz: nu/nu (4/4). |
| **ITGalaxy** | Profitshare | 2%. NEX (Gadgeturi utile): 10% | **60 zile** | 88,08%, 11 zile | **Permis explicit** („Google Adwords, Google Shopping Ads”). Brandul ITGalaxy obligatoriu ca negativ. Google CSS interzis. | Nu sunt interzise | Bcb/Hpz: da/da. j9C: da/nu. |
| CITGrup | Profitshare | 8% | 60 zile | n/a | Implicit permis (cere brandul ca negativ, nu interzice PPC) | Nu sunt interzise | Bcb: da/**nu**. Magazin pus pe pauză la noi (0 oferte disponibile). |
| ForIT | Profitshare | 2% | 30 zile | 80,2%, 31 zile | Implicit permis (brand ca negativ). Google CSS interzis. | Nu sunt interzise | da/da (Bcb). Pe pauză la noi (0 oferte). |
| Vexio | Profitshare | 2% | **5 zile** | 99,61%, 31 zile | **Interzis** („Este interzisa promovarea prin Google Ads incepand cu 16 iunie 2020”) | Nu sunt interzise | Bcb/Hpz: da/da |
| Mindblower | Profitshare | 11% | 30 zile | 100%, 17 zile | Doar cu acord prealabil. Cuvântul „cadouri” e interzis. | Nu sunt interzise | **da/nu** pe toate serverele (în DB: inactive, dar are 54 de oferte cu link) |
| Vegis | Profitshare | 8% | 30 zile | 99,65%, 21 zile | Doar după discuție prealabilă. Oricum exclus (regula 8). | Nu sunt interzise | **da/nu** pe toate serverele (în DB: active) |
| **evoMAG** | 2Performant | **1,5%** (1–31.10.2026) | **10 zile** (`cookie_life` și descriere; TOS-ul vechi spune 30) | 76,98% nr. / 71,83% val., 62 zile | **„Google Ads – search”: deleted** (nepermis la nivel de advertiser) | Activ (permis) | acceptat |
| **Rowenta** | 2Performant | 4% | **30 zile** | 96,07% / 97,09%, 30 zile | **Activ**. Brand bidding interzis: „Rowenta”, „shop.rowenta.ro” obligatorii ca negative. | Activ | acceptat |
| petmart | 2Performant | 5% (după taxe și transport) | 30 zile | 97,9% / 97,67% | **pending_deletion** | **pending_deletion** | acceptat (vezi raportul pet din 03.10) |

### 3.2 Programe acceptate fără oferte pe site (pentru context)

| Magazin | Rețea | Comision | Fereastră | Google Ads Search |
|---|---|---|---|---|
| noriel.ro | 2P | 7% | 14 zile | Interzis („nu acceptam publicitatea prin Google Ads si Facebook Ads”) |
| libris.ro | 2P / PS | 8% | 10 zile | Interzis (PPC Google Ads) |
| casaidea.ro | 2P | 5% | 30 zile | Activ |
| automobilus.ro | 2P | 5% | 30 zile | Activ |
| pint.ro | 2P | 3% variabil | 30 zile (TOS: 20) | Activ, fără „pint” |
| f64.ro | 2P | 1% variabil | 30 zile (până la 64 la cerere) | Deleted |
| drmax.ro / springfarma | 2P | 2–2,2% variabil | 15 zile | Deleted (și sănătate, regula 8) |
| Dwyn, PCMadd, Techstar, Vonmag, Dualstore | PS | 2–5%, 6%, 15%, 3%, 5% | 30 zile (Techstar: 90 în descriere) | PPC permis cu brandul ca negativ (Dwyn, PCMadd, Techstar) |

### 3.3 Afirmația „2 zile”

**Corectă, dar doar pentru telefoane mobile, televizoare și laptopuri/notebook-uri.** Restul catalogului eMAG are 15 zile. Exact aceste trei categorii sunt singurele eMAG pe care le avem pe site. Grila de comisioane pe categorii e doar în contul Profitshare ([app.profitshare.ro/…/different-categories/id/35](https://app.profitshare.ro/affiliate/advertiser-catalog/different-categories/id/35), cere login). Proprietarul o poate exporta ca să completăm tabelul pe categorii.

---

## 4. Date din producție pe magazin

Fereastra: ultimele 7 zile (27.09–03.10). Clickuri = `ad_clicks` cu `NOT is_internal`. „Disponibile” = în stoc, confirmate în ultimele 3 zile, magazin nepus pe pauză, cu `affiliate_url`.

| Magazin | Oferte total | Disponibile (cu link) | Clickuri 7 zile (toate) | fără 30.09–01.10 (val de roboți) | 02–03.10 | Clickuri cu gclid | Comisioane (toate, din iulie) |
|---|---|---|---|---|---|---|---|
| eMAG | 914 | 511 | 1.698 | 224 | 141 | 0 | 2 aprobate (11,37 lei) · 7 în așteptare (507,69) · 9 anulate (389,32, din care 8 „recurență” = 363,87) |
| ITGalaxy | 4.172 | 2.381 | 6.683 | 1.070 | 673 | 0 | 0 |
| evoMAG | 7.060 | 5.884 | 8.569 | 957 | 631 | 0 | 0 |
| Vegis | 9.667 | 6.651 | 21.861 | 1.482 | 889 | 0 | 0 |
| Rowenta | 382 | 382 | 1.617 | 506 | 498 | 0 | 0 |
| Vexio | 79 | 55 | 283 | 93 | 54 | 0 | 0 |
| Mindblower | 57 | 54 | 122 | 1 | 1 | 0 | 0 |
| CITGrup | 17.994 | 0 (pauză) | 1 | 1 | 0 | 0 | 0 |
| ForIT | 1.794 | 0 (pauză) | 0 | 0 | 0 | 0 | 0 |
| petmart | 13.110 | 13.110 | 0 (4 interne) | 0 | 0 | 0 | 0 |
| Altex | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

În plus: 1 comision Profitshare anulat fără magazin legat (9,83 lei, 06.08).

**Atenție la „clickuri reale”:** `ad_clicks` NOT `is_internal` e dominat de roboți, nu doar în 30.09–01.10 (15.491 + 21.009). GA4 numără doar **0–20 `affiliate_clicks`/zi** în aceeași perioadă (1–22 utilizatori/zi, doar cu acord de analiză). Chiar și cele ~400–500 de clickuri/zi din 26–29.09 sunt de ~20–100 de ori peste GA4. Protecția `/go/` (token JS + limită pe IP) a intrat abia azi, deci cifrele de mâine vor fi primele relevante. Ca ordin de mărime, clickurile umane spre afiliați sunt de **zeci pe săptămână**, nu mii. Nu există încă niciun click din Google Ads (gclid: 7 în total, toate cu acord, niciunul în ultimele 7 zile).

Clickuri eMAG din 02–03.10 pe categorii: telefoane 69, televizoare 43, laptopuri 29. Toate sunt în categoriile cu fereastră de 2 zile.

---

## 5. Recomandare: unde merită trafic plătit

Criterii: fereastră ≥ 7 zile, Google Ads Search permis de advertiser (nu doar de rețea), comision net decent, oferte reale pe landing.

**Merită (în ordine):**
1. **ITGalaxy: telefoane (în special pliabile și flagship-uri) și NEX la 10%.** 60 de zile fereastră, PPC permis explicit, aprobare 88%, validare rapidă (11 zile). Cele trei campanii existente (Galaxy S26 Ultra, iPhone 17 Pro Max, Samsung pliabile) au landing-uri unde ITGalaxy are reducerea. Cu fereastra de 60 de zile, orice comandă ITGalaxy în 2 luni de la click se atribuie. Condiții: „itgalaxy” rămâne negativ, fără Google CSS. NEX ar trebui verificat separat (comision 10%, dar produse ieftine; doar ca grup secundar).
2. **Rowenta: aspiratoare (100 de oferte, ~1.160 lei medie) și pachete promo.** 4% × 97% aprobare, 30 de zile, Search activ. **Condiție grea:** „Rowenta” nu poate apărea în cuvintele cheie, deci doar căutări generice sau pe model fără brand (ex. „aspirator vertical fără fir”). Codul de model poate fi considerat derivat de brand, așa că trebuie confirmat cu Rowenta/2P. Generic, CPC-ul e mare și pe pagină concurăm cu toate magazinele. De validat cu Keyword Planner înainte de orice test. Încredere: scăzută.
3. **CITGrup (8%, 60 de zile)**, doar dacă se reactivează magazinul și statutul API. Azi e pe pauză, iar serverul principal dă `active=no`. Refurbished la 8% e cel mai bun comision IT pe care îl avem.

**Nu merită (trafic plătit):**
- **eMAG:** PPC interzis în termeni, comparatoarele interzise, iar toate ofertele noastre sunt în categoriile de 2 zile, la 1,4–1,7% × 73,6% aprobare. Chiar și cu acordul eMAG, matematica pe 2 zile e slabă la produse de 2.000–6.000 lei, unde decizia durează de obicei mai mult (deducție, fără date proprii). **Pe landing-urile campaniilor active, ofertele eMAG pot rămâne pentru comparație, dar e bine ca anunțurile și argumentul să se bazeze pe oferta ITGalaxy.** Altfel, orice comision eMAG venit din reclamă e expus la anulare pentru „promovare neregulamentară”.
- **evoMAG:** „Google Ads – search” e `deleted` în 2Performant, 1,5% în octombrie, 10 zile, aprobare ~72% valoric.
- **Vexio:** Google Ads interzis din 2020, 5 zile, produse de 27–49 lei.
- **Mindblower:** AdWords doar cu acord, „cadouri” interzis, statut API `active=no`.
- **Vegis:** regula 8, plus `active=no` în API (de verificat dacă cele 6.651 de oferte mai aduc vreun comision).
- **petmart:** Search în `pending_deletion` (vezi raportul pet).
- Accesorii ITGalaxy (cabluri, folii, baterii externe; ~1.900 de oferte la 65–193 lei): fereastra e bună, dar valoarea e prea mică (regula „produse cu valoare mică”).

**Ce înseamnă pentru campaniile existente:** cele 3 YAML-uri (telefoane) au landing-uri cu oferte eMAG, evoMAG și ITGalaxy. Banii vin realist doar din ITGalaxy. EPC-ul din raportul v2 (27.09) a presupus comisioane eMAG/evoMAG utilizabile pe acele pagini. Ar trebui recalculat doar pe ITGalaxy, cu aprobarea de 88% și fereastra de 60 de zile, care e un avantaj.

---

## 6. Presupuneri și date lipsă

- **Confirmarea scrisă a sensului „recurenței” pentru comenzile noastre** vine doar de la eMAG/Profitshare (mesajul din secțiunea 7). Definiția e oficială, aplicarea pe fiecare comandă e deducție.
- **`hash`/click_id lipsește pe toate comisioanele Profitshare.** Conform `web/src/lib/subid.ts`, deep link-ul `lps/…?redirect=…&hash=ID` ar trebui să fie mutat de Profitshare în formatul `/l/{id}/ID/`. În realitate, comisioanele vin cu `hash` gol, chiar și cele din 29.09–02.10. Fără el nu avem timpul click → comandă, nu putem urca conversii în Google Ads și nu putem separa clickurile reale. **Task pentru agentul tracking.**
- Grila eMAG pe categorii (doar în cont). Am dedus 1,70% = laptopuri (din screenshot). 1,40% e probabil telefoane sau TV, dar e neconfirmat.
- Statutul real de afiliere la eMAG, Mindblower, Vegis și CITGrup. API-ul răspunde diferit de pe 3 servere, iar interfața Profitshare e sursa de adevăr.
- Clickurile umane reale pe magazin: după protecția `/go/` de azi, recitire peste 7 zile.
- Ce înseamnă „acordul Profitshare din 27.09” (raportul v2). Dacă acoperă explicit eMAG și evoMAG, sau doar rețeaua. Termenii advertiserului sunt mai specifici și mai recenți (eMAG: 27.10.2025).
- Keyword Planner nu a fost folosit în acest raport (nu era necesar pentru ferestre). Pentru Rowenta trebuie rulat înainte de orice test.

---

## 7. Mesaj pentru managerul de cont Profitshare / eMAG

> Notă pentru proprietar: mesajul spune deschis că superieftin.ro e un comparator care preia automat prețurile eMAG și că folosim Google Ads Search. Termenii eMAG interzic ambele fără acord. Termenii permit în același timp cererea unui acord „prin intermediul mesageriei Profitshare”. A întreba deschis e calea care protejează comisioanele pe termen lung. Dacă preferi să nu menționezi preluarea automată, scoate paragraful marcat [opțional], dar riscul rămâne. Decizia e a ta.

**Subiect:** superieftin.ro: comisioane eMAG anulate „din motive de recurență” + acord pentru promovare

Bună ziua,

Vă scriu în numele superieftin.ro (cont de afiliat Profitshare, sursa „superieftin.ro”). Aș avea câteva întrebări despre programul eMAG și aș vrea să ne asigurăm că promovăm corect.

**1. Comisioane anulate „din motive de recurență”.** În ultimele zile am avut 8 comisioane eMAG anulate automat, la 7–75 de minute după comandă, toate la 1,70%. Exemplu: comanda CX1PM-1537860904 (Laptop Lenovo ThinkBook 14 G8 IAL, 3.305,78 lei fără TVA, comision 56,20 lei): click pe 22.09.2026 11:48, comandă pe 02.10.2026 08:15, anulată la validare pe 02.10 09:30 cu mențiunea „Produs anulat din motive de recurență”. Celelalte au fost pe 24.09, 25.09, 30.09 (×4) și 02.10.
- Ne puteți confirma că „recurență” înseamnă aici că între ultimul click și comandă au trecut mai mult de 2 zile (perioada de comisionare pentru telefoane, televizoare și laptopuri), și nu alt motiv (client existent, comandă duplicat etc.)?
- Valori identice se repetă (de ex. 46,36 lei de 4 ori). Dacă e vorba de același client care a recomandat, ne ajută să știm dacă există și altă regulă de validare de care trebuie să ținem cont.

**2. Perioadele de comisionare pe categorii.** Ne puteți trimite lista completă a perioadelor de comisionare (recurență) pe categorii eMAG, împreună cu grila de comisioane actuală? Vrem să ne asigurăm că o interpretăm corect pentru telefoane, televizoare, laptopuri și accesorii. Ne interesează și regulile pentru Black Friday (6 noiembrie 2026): durata cookie-ului dedicat și de când se aplică.

**3. Promovare prin Google Ads Search, cerere de acord.** Trimitem trafic din campanii Google Ads Search **către site-ul nostru**, nu direct pe eMAG. Pe paginile noastre, vizitatorul compară prețul aceluiași produs la mai multe magazine, iar istoricul de preț arată dacă reducerea e reală. Abia apoi alege magazinul. Nu licităm pe „eMAG” sau variații. Toate mărcile eMAG/Dante International sunt cuvinte cheie negative, iar anunțurile nu conțin numele eMAG și nici prețuri sau promoții eMAG. Am văzut că termenii programului (secțiunea 2) nu permit campanii PPC. Vă rugăm să ne spuneți dacă acest model (reclamă către comparator, fără brand eMAG) poate primi acordul eMAG și în ce condiții. Fără acord, nu vom folosi ofertele eMAG în nicio campanie plătită.

**4. Fereastră mai lungă pentru trafic dedicat.** Dacă modelul de la punctul 3 e acceptat, se poate discuta o perioadă de comisionare mai lungă (de ex. 7–15 zile) pentru telefoane, televizoare și laptopuri pe traficul nostru? La aceste produse, vizitatorii compară de obicei câteva zile înainte să cumpere.

**[opțional] 5. Sursa prețurilor.** Prețurile eMAG de pe superieftin.ro sunt preluate automat din paginile publice de produs, la intervale rare. Am înțeles că Profitshare nu oferă feed de produse pentru eMAG. Dacă preferați un feed oficial sau alt mod de preluare, îl folosim cu plăcere. Vă rugăm să ne spuneți dacă există o cale acceptată pentru un site de comparare a prețurilor.

**6. Întrebare tehnică (Profitshare).** Adăugăm parametrul `hash` pe deep link-urile `l.profitshare.ro/lps/…?redirect=…&hash=<id>`, dar în API (`affiliate-commissions`) câmpul `hash` vine gol pe toate comisioanele. Este suportat parametrul pe linkurile `lps`, sau trebuie folosit alt format pentru subID?

Vă mulțumesc pentru timp! Așteptăm răspunsul dumneavoastră înainte să facem orice schimbare în campanii.

Cu stimă,
[Nume] · superieftin.ro · [e-mail / telefon]

---

## 8. Context sezonier (următoarele 6–8 săptămâni)

- **eMAG Black Friday 2026: vineri, 6 noiembrie** ([Romania Insider](https://www.romania-insider.com/romanias-largest-online-retailer-emag-announces-date-black)). eMAG aplică atunci **cookie, grilă și recurență dedicate**. Clickurile de dinainte (cookie-uri standard) NU generează conversii în timpul evenimentului. Traficul din octombrie spre eMAG nu „încarcă” nimic pentru Black Friday.
- **evoMAG** a scăzut comisionul la 1,5% pentru 1–31.10.2026 (variație −11%). De urmărit ce anunță pentru noiembrie.
- **ITGalaxy și ceilalți** (Black Friday în săptămânile din jurul datei de 6–27 noiembrie): de verificat în noiembrie dacă anunță condiții speciale, cum face Dwyn („cookie-uri dedicate” la evenimente).
- Prețurile la telefoane fluctuează mult în octombrie–noiembrie (lansări toamnă + pre-Black Friday). Fereastra de 60 de zile de la ITGalaxy acoperă tot sezonul pentru un click din octombrie.

---

Alege 2–3 direcții pentru ads-builder.
