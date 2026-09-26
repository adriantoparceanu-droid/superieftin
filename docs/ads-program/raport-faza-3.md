# Raport Faza 3 — primele campanii Search + comenzile ads:*

Data: 27 septembrie 2026 · Autor: ads-builder · Branch: `ads/faza-3-campanii`
Research folosit: `ads/research/2026-09-27-oportunitati-v2.md` (toate cele 3 direcții, decizia proprietarului).

## 1. Ce s-a făcut

### Campaniile (fișiere YAML, nimic creat încă în cont)

| Fișier | Campanie | Buget | Licitare | Grupuri | Cuvinte |
|---|---|---|---|---|---|
| `ads/campaigns/samsung-pliabile.yaml` | SE \| Search \| Samsung pliabile | 8 lei/zi | CPC manual, max 0,35 | Z Fold7, Z Flip7 FE | 10 + 4 (exact + phrase) |
| `ads/campaigns/iphone-17-pro-max.yaml` | SE \| Search \| iPhone 17 Pro Max | 8 lei/zi | CPC manual, max 0,35 | 256GB – preț | 5 exact + 3 phrase, toate cu „preț” sau „256” |
| `ads/campaigns/galaxy-s26-ultra.yaml` | SE \| Search \| Galaxy S26 Ultra | 10 lei/zi | CPC manual, max 0,33 | 256GB, 1TB | 10, doar exact (`exact_only: true`) |

Total: 26 lei/zi (~790 lei/lună), mult sub plafoanele din guardrails (150 lei/zi, 4.000 lei/lună).

Ce au toate campaniile:
- rețea: doar Search (fără parteneri de căutare și fără Display), România cu „prezență”, limba română;
- conversia campaniei e „Comision Profitshare” (ID 7799099014), printr-un obiectiv personalizat „SE | Comision Profitshare” care conține doar această acțiune. Contul nu are acum niciun obiectiv folosit la licitare, iar acțiunea „indicații de orientare” e marcată principală. Obiectivul personalizat garantează că aceste campanii numără doar comisioanele;
- URL-urile finale sunt pagini `/p/...` de pe www.superieftin.ro, niciodată `/go/`;
- negative: cele de bază, brandurile retailerilor și ale operatorilor, intențiile care nu cumpără (husă, service etc.) și cele specifice fiecărui model;
- anunțuri RSA cu 15 titluri și 4 descrieri, fără procente. Mesajul central: prețul e sub mediana de 30 de zile;
- extensii: 4 sitelinks (cele 2 produse, reducerile la telefoane, metodologia de pe `/despre`), 6 callouts și structured snippets („Servicii”, plus „Modele” la pliabile).

### De ce CPC manual și nu tROAS
Contul nu are încă nicio conversie. Strategiile automate (tROAS, maximizarea valorii conversiilor) învață din conversii și au nevoie de ~30 de conversii reale pe campanie ca să liciteze bine. Până atunci, noi fixăm prețul maxim pe click. După ~30 de comisioane într-o campanie, ads-analyst propune trecerea la tROAS.

### Comenzile (în `worker/`)
- `npm run ads:validate`: verifică fișierele fără să atingă contul Google Ads.
  - Verificări statice (fără rețea):
    - limite de caractere (30 / 90 / 15; 25 / 35 la extensii);
    - minim 8 titluri și 3 descrieri;
    - bugetele și CPC-ul față de `guardrails.yaml`, inclusiv suma pe toate campaniile;
    - status PAUSED, doar Search, locația RO cu „prezență”, limba ro;
    - cuvintele cheie: fără broad, fără brandurile retailerilor, fără duplicate între grupuri și neblocate de propriile negative;
    - negativele obligatorii sunt prezente;
    - fără „!” în titluri, fără majuscule excesive, simboluri sau emoji.
  - Verificări live pe site:
    - fiecare URL răspunde direct cu 200, fără redirect;
    - pagina nu e noindex și produsul e în stoc;
    - categoria nu e Sănătate & Naturale (inclusiv subcategoriile, verificate prin breadcrumb);
    - regula 9: orice procent din text trebuie să corespundă procentului afișat pe pagină;
    - orice text despre reducere sau „sub mediană” cere ca pagina de produs să afișeze acum „Reducere reală”;
    - mărcile din text (Samsung, iPhone etc.) apar pe pagină.
  - Afișează „hash review” pentru fiecare fișier.
- `npm run ads:plan`: citește contul (9 cereri GAQL, doar citire) și arată ce s-ar crea, modifica, pune pe pauză sau elimina.
- `npm run ads:apply`:
  - implicit e doar plan;
  - `-- --confirm` cu `ADS_ENV=test` trimite cu `validate_only`;
  - `-- --confirm --prod` cu `ADS_ENV=prod` scrie real.
  - Totul pleacă într-o singură cerere atomică `googleAds:mutate` (azi 314 operații, din limita Explorer de 2.880 pe zi). După scrierea reală, ID-urile se scriu în YAML, ca rularea următoare să nu dubleze nimic.
- Teste: `worker/src/ads/campaigns/campaigns.test.ts` (22 de teste, incluse în `npm test`; 74/74 trec).
- Dependență nouă: `yaml` (devDependency, fără dependențe proprii). L-am ales pentru că păstrează comentariile din YAML când `ads:apply` scrie ID-urile înapoi.

### Mecanismul `.review` (regula 10)
policy-reviewer (sau coordonatorul, după verdictul lui) scrie `ads/campaigns/.review/<nume-fișier>.pass`:

```yaml
verdict: PASS
date: 2026-09-27T14:00:00Z
reviewer: policy-reviewer
file: ads/campaigns/samsung-pliabile.yaml
sha256: <„hash review” din npm run ads:validate>
notes: ...
```

`ads:apply --confirm --prod` refuză orice campanie care are modificări dacă:
- lipsește fișierul `.pass`;
- verdictul nu e PASS;
- hash-ul nu corespunde (fișierul s-a schimbat după verificare);
- verdictul e mai vechi de 7 zile.

Hash-ul ignoră câmpurile `id` / `budget_id`, deci ID-urile scrise după creare nu invalidează verdictul. În `ADS_ENV=test` lipsa PASS-ului apare doar ca avertisment, pentru că nu se scrie nimic.

## 2. Rezultate (27.09.2026)

- `ads:validate`: 0 erori, 0 avertismente. Paginile de azi: Z Fold7 −16,8%, Z Flip7 FE −10,2%, iPhone Cosmic Orange −8,3%, Deep Blue −7,4%, S26 Ultra 256GB −12,5%, 1TB −7,7%. Toate sunt în stoc, cu status 200 și indexabile.
- `ads:plan`: 3 campanii noi, 311 creări, 3 modificări (legarea obiectivului de conversie), 0 pauze, 0 eliminări. Contul nu are nicio campanie azi.
- `ads:apply --confirm` (ADS_ENV=test): **Google a validat toate cele 314 operații cu `validate_only`, fără nicio eroare.** Nu s-a creat nimic.

**Important:** `validate_only` verifică structura, limitele și referințele, dar NU face revizuirea editorială sau de mărci. Am testat: un callout „CUMPARA ACUM!!!” a trecut de `validate_only`. Revizuirea Google are loc abia după crearea reală (și pe anunțurile PAUSED). De aceea contează verificările de stil din `ads:validate` și verdictul policy-reviewer.

## 3. Decizii luate de mine (de confirmat)

1. **Cuvintele cheie și extensiile se creează ENABLED**, iar campaniile, grupurile și anunțurile PAUSED. Regula 1 cere PAUSED pentru „campanie, grup de anunțuri sau anunț”. Un cuvânt cheie nu poate rula sub un grup PAUSED. Așa activezi doar 3 niveluri, nu fiecare cuvânt în parte.
2. **iPhone: doar cuvinte cu „preț” sau „256”** (decizia ta). Am scos din research variantele „reducere”, „orange”, „portocaliu” și „deep blue”. Deep Blue rămâne ca sitelink.
3. **iPhone: fără negativul „orange”.** Ar fi blocat căutările după culoarea Cosmic Orange. L-am înlocuit cu `"orange romania"`, `"magazin orange"`, `"oferta orange"`, `"orange ro"` și „abonament”.
4. **Negative de grup adăugate de mine:** `512gb`, `512 gb`, `1tb` la Z Fold7 (landing-ul e varianta de 256GB) și `1tb` la S26 Ultra 256GB (căutările cu 1TB merg la grupul de 1TB).
5. **S26 Ultra: am scos cuvintele phrase din research** (decizia ta: doar exact).

## 4. Ce urmează

1. **policy-reviewer** verifică cele 3 fișiere, apoi scrie `.pass` (cu hash-ul din `ads:validate`) sau `.fail`.
2. `npm run ads:plan`: verifici lista.
3. `ADS_ENV=prod` în `.env`, apoi `npm run ads:apply -- --confirm --prod`. Totul se creează PAUSED, iar ID-urile se scriu în YAML. Commit-uiește YAML-urile cu ID-urile.
4. Verifici în Google Ads:
   - statusul aprobării anunțurilor (revizuirea Google durează de obicei până la o zi lucrătoare);
   - sitelink-urile;
   - obiectivul de conversie al fiecărei campanii (Setări → Obiective → „SE | Comision Profitshare”).
5. **Activarea o faci tu în Google Ads:** campanie → grupuri → anunțuri. Pune `ADS_ENV=test` înapoi în `.env`.

**Campaniile sunt PAUSED. Activarea o faci tu în Google Ads după verificare.**

## 5. Riscuri

- **Reducerile pot dispărea.** Texte ca „sub mediană” sau „preț redus” sunt adevărate doar cât timp pagina afișează „Reducere reală”. iPhone 17 Pro Max poate pierde reducerea spre sfârșitul lui octombrie, iar Fold7 are prețul instabil. `ads:validate` prinde asta, dar trebuie rulat. Recomand să-l rulezi zilnic cât campaniile sunt active, iar în Faza 4 un job care pune automat pe pauză grupul cu reducere dispărută (pauza e permisă, regula 11).
- **Mărci în text** (Samsung, Galaxy, iPhone): apar pe paginile de landing ca produse reale. Titularul mărcii poate restricționa textul (policy-reviewer).
- **„Comparator de prețuri”** (titlu și snippet) descrie site-ul. Totuși, pe fiecare pagină de produs e azi un singur magazin. De confirmat de policy-reviewer.
- **Culoarea:** landing-ul S26 Ultra e Cobalt Violet, iar cel iPhone e Cosmic Orange. Cine caută altă culoare poate pleca fără să cumpere.
- **CPC:** un cont nou poate plăti mai mult decât estimarea din Keyword Planner. Plafoanele de 0,33–0,35 lei pot duce la afișări puține la început. Nu le crește fără date.
