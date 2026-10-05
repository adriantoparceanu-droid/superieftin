# Audit: de ce au scăzut afișările în Google (Search Console)

**Data:** 2026-10-05 · **Tip:** audit DOAR CITIRE (nimic modificat în cod, DB, Search Console sau Cloudflare)
**Surse:** Search Console API (contul de serviciu, `webmasters.readonly`: searchAnalytics pe dată/pagină/interogare 11.06–05.10, Sitemaps `list`, URL Inspection pe 41 de URL-uri), DB producție (doar SELECT), `curl` pe site-ul live cu UA Googlebot, cod pe `main` @ `778951c`.
**Scripturi temporare:** în scratchpad-ul sesiunii (nu în proiect).

---

## 1. Rezumat executiv

**Pe scurt:** Google **nu ne-a scos din index**. Paginile sunt în continuare indexate, dar din **21 august** apar mult mai jos în rezultate (poziția medie a coborât de la ~28 la ~39), deci nu mai sunt văzute. Scăderea a pornit **în ziua în care s-a terminat „August 2026 Spam Update”** al Google (18–21 aug.). Acest update a lovit tocmai tipul nostru de site: mii de pagini de produs de afiliere, generate din feed-uri, cu puțin text propriu. Din 26 sept. se adaugă o a doua cauză, de data asta din partea noastră: aproape jumătate din paginile pe care Google le afișa au devenit „indisponibil” (`noindex`), pentru că ofertele lor au dispărut din feed-uri.

### Cifrele reale (Search Console API, cu interogările anonimizate incluse)

| Perioada | Zile | Afișări | Afișări/zi | Clickuri | Poziția medie |
|---|---|---|---|---|---|
| 6 iul. – 20 aug. | 46 | 4.606 | **100** | 75 | 28,1 |
| 21 aug. – 25 sept. | 36 | 1.189 | **33** | 50 | 38,8 |
| 26 sept. – 5 oct. | 10 | 214 | **21** | 10 | 38,2 |

Pe luni: iulie 2.311 afișări / 31 clickuri · august 2.683 / 52 · septembrie 983 / 51 · 1–5 oct. 98 / 4.

> **Atenție la cifrele din Admin → Statistici.** Cifrele „1.509 → 604 → 29 afișări, clickuri 6 → 6 → 0” vin din tabela `gsc_daily`. Ea păstrează doar rândurile care au o interogare cunoscută (Google ascunde căutările rare, „anonimizate”), plus top 500 pe zi. Din cauza asta lipsesc ~35–50% din afișări și aproape toate clickurile. Clickurile organice reale **nu au scăzut la zero**: 52 în august, 51 în septembrie. Cele din septembrie vin însă aproape toate pe homepage (37 din 51, probabil căutări după nume), nu pe produse (14, față de 48 în august).

### Cauze, în ordinea importanței

1. **Cauza principală: penalizare algoritmică de calitate (Spam Update, 18–21 aug. 2026).** Ruptura e într-o singură zi: 20 aug. = 106 afișări pe poziția 15, 21 aug. = 37 afișări pe poziția 49. Nu s-a schimbat nimic la noi atunci (zero commit-uri între 27 iul. și 16 sept.). Update-ul a vizat explicit „scaled content abuse” (multe pagini cu valoare mică, făcute în serie) și paginile subțiri de afiliere care doar adună date de produs. Paginile au rămas indexate: 13 din 15 produse vechi alese aleator apar „Trimisă și indexată”. Au pierdut însă poziții, inclusiv cele care au și azi ofertă: 789 de pagini încă disponibile au scăzut de la 1.672 la 319 afișări.
2. **Cauza secundară: produse care au devenit `noindex`.** Din cele 1.760 de pagini `/p/` cu afișări în iul.–oct., **971 (55%) sunt azi „indisponibil” → `noindex`**. Motivul: regula „ofertă neconfirmată 3 zile = fără stoc”, activă din 26 sept., plus feed-uri căzute (ForIT gol din 3 aug., CITGrup vechi oprit din 11 iun., oferte Vegis/evomag/eMAG dispărute). Din aceste 971, **752 vor răspunde 410 de la 27 oct.**
3. **Cauza a treia: catalogul s-a schimbat aproape complet în ultimele zile.** 18.657 din cele 29.243 de produse indexabile azi (64%) au fost create după 26 sept. (Petmart 13.132 pe 3 oct., feed nou Vegis, Rowenta). Google nu le cunoaște încă (4 din 8 produse noi testate: „Google nu cunoaște adresa URL”). Mai mult, adăugarea a încă ~13.000 de pagini subțiri imediat după un update anti-„conținut în serie” merge în direcția greșită.
4. **Redesignul (5 oct.) NU a stricat nimic SEO.** Toate paginile cheie răspund 200, cu canonical corect, fără `noindex` greșit și cu JSON-LD valid. Sitemap-ul e curat, iar Googlebot nu e blocat. Singurul minus: HTML-ul paginilor `/c/` și `/reduceri-reale/` s-a dublat (≈705 KB).

### Data de 27 octombrie (410)

- În total vor primi 410 **~24.560 de produse**: fără ofertă disponibilă, ultima confirmare înainte de 27 sept. Dintre ele: ~16.600 CITGrup vechi (stoc din iunie), 1.489 ForIT, 1.369 produse fără nicio ofertă, restul Vegis/evomag/eMAG/ITGalaxy.
- **NU scoate trafic real din index.** Toate sunt **deja** `noindex` (pagina „indisponibil”), iar cele 752 care mai aveau afișări au adus împreună 452 de afișări în 46 de zile (~10/zi) și aproape zero clickuri.
- **Nu atinge CITGrup-ul nou.** Ofertele CITGrup confirmate azi au `last_checked` = 5 oct., deci nu intră sub 410 chiar dacă magazinul e pe pauză. Regula din `src/proxy.ts` se uită la `max(last_checked)`, nu la pauză.
- **Concluzie:** 410-ul e corect și chiar **util pentru recuperare**: elimină din index pagini moarte și subțiri. Îl lăsăm să pornească. În Search Console se va vedea o creștere mare la „Negăsită (404)/410” și o scădere la paginile indexate. E normal, nu e o problemă nouă.

---

## 2. Dovezi

### 2.1 Cronologia zilnică (afișări, poziție)

```
2026-08-17  157 afișări  poz. 16,2
2026-08-18  157          19,3     ← începe Spam Update (18 aug.)
2026-08-19  147          15,2
2026-08-20  106          15,2
2026-08-21   37          48,9     ← Google anunță finalizarea (21 aug., 04:51 ET)
2026-08-22   28          57,4
2026-08-23   22          46,2
... septembrie: 15–57/zi, poziția 22–50
2026-10-01   32  40,3 · 10-02 15 · 10-03 34 · 10-04 15
```
Pe săptămâni: 439–946 afișări/săpt. în iul.–mijlocul lui aug., apoi 161–302 din 24 aug.

### 2.2 Ce pagini au pierdut (A = 6 iul.–20 aug., B = 21 aug.–5 oct., câte 46 de zile)

| Tip URL | Pagini | Afișări A | Afișări B | Clickuri A → B |
|---|---|---|---|---|
| `www…/p/` (produse) | 1.705 | 3.830 | 970 | 68 → 19 |
| `/` (homepage) | 1 | 684 | 424 | 5 → **41** |
| `superieftin.ro/p/` (fără www, istoric) | 64 | 86 | 20 | 3 → 0 |
| `/c/` | 3 | 84 | 72 | 0 → 0 |
| `/produs/` (WooCommerce vechi) | 8 | 15 | 1 | 0 → 0 |
| `/reduceri-reale/` | 3 | 0 | 32 | – |

⇒ Aproape toată pierderea e pe paginile de produs. **URL-urile WooCommerce vechi nu contează** (15 afișări în total). Site-ul nou e live din iunie (sitemap trimis pe 27 iun.), deci scăderea **nu** are legătură cu o migrare.

Pagini distincte cu afișări pe lună: iulie 884 · august 895 · **septembrie 241** · 1–5 oct. 36.

**Starea de azi a paginilor `/p/` care aveau afișări** (DB prod, după slug):

| Stare azi | Pagini | Afișări A | Afișări B |
|---|---|---|---|
| disponibil (indexabil) | 789 | 1.672 | 319 |
| `noindex` și **410 de la 27 oct.** | 752 | 1.734 | 452 |
| `noindex`, sub 30 de zile | 219 | 510 | 219 |

Pe magazine, cele mai mari pierderi: **Vegis** (Sănătate & Naturale; 497 de pagini disponibile, 1.068 → 127 afișări, plus ~220 indisponibile), produse rămase fără nicio ofertă (357 de pagini, 977 → 476), eMAG, ForIT (233 → 9), evomag (156 → 5 la cele indisponibile).

### 2.3 Interogări

- Pozițiile au fost **mereu slabe**: interogările de top stăteau pe pozițiile 30–90 (ex. „magazin ieftin” 259 afișări, poziția 48 → 55; „samsung s26 pret” poziția 35; „salira reuma gel” poziția 9 a fost o excepție). Pe pozițiile 30–90 orice retrogradare face afișările să dispară.
- Interogări care au dispărut după 21 aug.: modele de telefoane („samsung s26 ultra”, „galaxy s26 ultra”, „oferta google pixel 10”) și multe produse Vegis („miere tei ulei cimbrisor”, „propolis brut pret”, „polen albine pret”, „antifumat”).
- Interogări de marcă („superieftin”): practic zero cu nume (sunt anonimizate). Clickurile pe homepage din septembrie (37) sugerează însă căutări după nume, probabil datorită reclamelor.

### 2.4 Search Console: sitemap și inspecție URL

**Sitemaps API:** `https://www.superieftin.ro/sitemap.xml` e recunoscut ca **index de sitemap**, trimis pe 2026-06-27, descărcat ultima dată pe **2026-10-04 15:46**, 0 erori, 0 avertismente, **20.078 de URL-uri trimise**. La acel moment exista probabil doar `pagini` + `produse-1` + `produse-2`; azi sunt 29.341. Câmpul „indexed” întors de API e mereu 0 (Google nu-l mai completează), deci numărul real de pagini indexate se vede **doar în interfață** (Pagini).

**URL Inspection (18 URL-uri reprezentative):**

| URL | Stare Google | Ultima accesare | Canonical Google = al nostru |
|---|---|---|---|
| `/` | Trimisă și indexată | 05.10 12:26 | da |
| `/c/telefoane-mobile` | indexată | 30.09 | da |
| `/c/baterii-externe` | indexată | 01.10 | da |
| **`/c/laptopuri`** | **Google nu cunoaște adresa URL** | – | – |
| `/p/televizor-led-philips-…50pus8010…` (reducere reală −34%) | indexată | 30.09 | da |
| `/p/laptop-asus-vivobook-15-a1504va-…` (disponibil) | indexată | **13.08** | da |
| `/p/miere-de-tei-…` (Vegis, azi noindex) | indexată | **09.07** | da |
| `/p/smartphone-…galaxy-s26-ultra…white` | indexată | 16.08 | da |
| `/p/telefon-mobil-seniori-verity-…` (azi noindex) | indexată (noindex încă nevăzut) | 17.09 | da |
| `/p/calculator-all-in-one-dell-optiplex-7060…4728192` (CITGrup vechi) | indexată | 02.09 | da |
| `/p/calculator-hp-z1-g6-…5161308` (CITGrup nou, pe pauză) | nu cunoaște | – | – |
| `/p/acumulator-extern-anker-…` (ForIT) | indexată | 20.09 | da |
| `/ghiduri/reduceri-reale-black-friday-cum-verifici` | **nu cunoaște** | – | – |
| `/ghiduri/laptopuri-pentru-studenti-si-birou` | **nu cunoaște** | – | – |
| `/reduceri-reale` | **nu cunoaște** | – | – |
| `/reduceri-reale/laptopuri` | **Descoperită – neindexată** | – | – |
| `/produs/monitor-led-tcl-…` (WooCommerce) | 404 la accesarea din 09.08 (azi 308 → 410) | 09.08 | – |

Plus un eșantion aleator de 23 de produse disponibile: **vechi (create înainte de aug.) 13/15 indexate**, 2 necunoscute; **noi (după 26 sept.) 4/8 indexate**, 4 necunoscute. Accesările din 05.10 arată că Google vizitează activ site-ul.

Concluzii:
- Robots, fetch și canonical sunt **toate OK**. Nicio pagină testată nu are „Pagină cu redirecționare”, „canonical alternativ” sau „blocată de robots.txt”.
- Paginile sunt indexate, dar **reaccesate rar** (produse văzute ultima dată în iulie/august). Așa arată un site cu „buget de accesare” mic, cu încredere scăzută.
- Exact paginile noastre cu conținut real (ghidurile, hubul `/reduceri-reale`, `/c/laptopuri`) **nu sunt încă cunoscute** de Google. Ele au intrat în sitemap abia la deploy-ul din 4 oct. (pachetul A).

### 2.5 Tehnic pe producție (curl, UA Googlebot, 5 oct. seara)

- **robots.txt:** grupul `*` permite tot în afară de `/go/` și `/api/`. Grupul pentru roboții AI (inclusiv Google-Extended, Bingbot) repetă aceleași reguli. Googlebot nu e blocat. Nu există `x-robots-tag` pe paginile indexabile.
- **Cloudflare:** Googlebot primește **200** (în inspecție: „Preluarea paginii: reușită” pe 05.10). Blocajul E1 pentru GPTBot/ClaudeBot nu afectează Google. Nu am găsit challenge, 403 sau limitare pentru UA-ul Googlebot. Nu am putut vedea „Crawl stats” (nu există în API) → verificare manuală, vezi P0.
- **Redirecturi:** `http://`, apex → `https://www` = 301; slash final → 308. `/produs/…` → 308 → **410**; `/product-category/laptopuri/` → `/c/laptopuri` (200); `/shop/` → `/` (redirect spre homepage, în contradicție cu regula „fără redirect în masă spre homepage”, impact zero); `/store/admin/section/…` → 404. OK.
- **Sitemap:** index cu 4 fișiere, toate 200. `pagini.xml` are 98 de URL-uri: 45 `/c/`, 37 `/reduceri-reale`, 10 ghiduri, statice. Le-am verificat pe toate: **200, fără `noindex`**. `produse-1..3` au 29.243 URL-uri; un eșantion de 30 a ieșit 200, indexabil, cu canonical = el însuși. `lastmod` doar unde e real. TTFB: index 3,9 s, `produse-N` 2,6–3,5 s (acceptabil pentru Google, dar lent).
- **Pagini cheie după redesign:** `/`, `/c/telefoane-mobile`, `/c/laptopuri`, `/c/telefoane-mobile?page=2` (canonical propriu), `/reduceri-reale`, `/reduceri-reale/laptopuri`, `/ghiduri`, ghid: toate 200, canonical propriu, un singur H1. `/c/monitoare` (gol) = `noindex, follow` (corect). Produs indisponibil = `noindex, follow` (corect). `/nu-exista` = 404 + `noindex` (corect).
- **TTFB:** produse 0,12–0,4 s (cache rece după redesign; 1 din 30 a avut 1,5 s), categorii 0,25–0,4 s. Bine.
- **Dimensiunea HTML:** `/c/telefoane-mobile` **705 KB**, `/reduceri-reale/laptopuri` **707 KB** (pe 4 oct. erau 327 KB și 165 KB), produs 110–150 KB, homepage 203 KB. Nu blochează indexarea, dar încetinește accesarea și LCP-ul pe mobil.

### 2.6 Conținut și calitate (de ce ne-a „văzut” update-ul)

- **29.243 de pagini indexabile.** Pe magazine: Petmart 13.132 (istoric de la 3 oct.), Vegis 6.739 (suplimente/sănătate, adică subiect YMYL; în plus categoria e exclusă din reclame), evomag 5.815, ITGalaxy 2.549, eMAG 520, Rowenta 382, Vexio 52, Mindblower 47.
- **Doar 7 produse au ≥2 magazine disponibile.** 99,98% din paginile de „comparator” arată de fapt un singur preț de la un singur magazin. Din perspectiva Google, sunt pagini de afiliere care repetă feed-ul, adică exact ținta „thin affiliate”.
- **Textul propriu pe `/p/`** (după redesign) e mai bun decât pe 4 oct.: verdict, mediana/minim/maxim pe 30 de zile, „Pe scurt despre preț”, produse similare. Rămâne însă **același șablon, cu alte cifre** (~370 de cuvinte în `main` pe un produs disponibil, ~90–145 pe unul indisponibil). Nu există descriere, specificații sau ceva scris de om.
- **Duplicate:** 45 de grupuri / 93 de produse cu nume identic (disponibile), plus variantele de culoare (168 de grupuri, raportul din 4 oct.). Situația cea mai gravă e la CITGrup-ul nou: **19.943 de produse noi pe 5 oct.**, în mare parte configurații aproape identice de desktop/server recondiționat (ex. „calculator-dell-alienware-aurora-r12-…-16-g-…-5199576” față de „…-8-gb-…-5199228”). Sunt ascunse acum doar pentru că magazinul e pe pauză.
- **2.295 de produse indexabile fără categorie** (nu apar în nicio listă `/c/`; se găsesc doar din sitemap).
- **JSON-LD după redesign: valid.** `Organization` + `WebSite` pe toate paginile. Pe `/p/` disponibil: `Product` cu `AggregateOffer` (lowPrice, offerCount, availability InStock, `Offer.url` = pagina, nu `/go/`), brand, sku, image, `BreadcrumbList` cu numele reale (Acasă › TV & Audio › Televizoare › produs). Pe `/p/` indisponibil: fără `Product` (corect). `/c/`: `ItemList` + `BreadcrumbList` + `FAQPage`. Ghid: `BlogPosting` + `FAQPage` + `Product`. Lipsește doar `description` la Product (opțional).

### 2.7 Alte constatări

- **CITGrup a revenit în feed pe 5 oct. 04:05** (feed Profitshare „IT, Mobile, Laptop, Tablete, Desktop, Monitoare”, 25.581 de produse, 21.335 de oferte în stoc, toate cu `affiliate_url`). Magazinul e însă **tot pe pauză** (din 26 sept.), deci totul e ascuns, `noindex` și scos din sitemap. Doar 1.392 dintre ele s-au potrivit cu produse vechi; restul de 19.943 au sluguri noi. Așadar paginile CITGrup vechi pe care Google le știa nu revin, iar 410-ul pentru ele e corect.
- **Tabela `gsc_daily` subraportează** (vezi rezumatul). Iulie: 1.509 în tabelă față de 2.311 real; clickuri 6 față de 31.
- Afișări pe țări: România 5.465 din ~5.700. Dispozitive: mobil 97 clickuri / 3.297 afișări, desktop 52 / 3.111.

---

## 3. Normal / așteptat vs. problemă reală

| Fenomen | Verdict |
|---|---|
| URL-urile WooCommerce vechi pe 410/404 | **Normal**, impact neglijabil (15 afișări). |
| Paginile produselor dispărute devin `noindex`, apoi 410 (27 oct.) | **Normal și sănătos.** Pierderea de afișări (~1/3 din ce mai rămăsese) e reală, dar paginile nu mai aveau ce oferi. 410-ul curăță indexul. |
| Scădere în Search Console la „Pagini indexate” după 27 oct. | **Așteptat**, nu e semnal de alarmă. |
| Paginile noi (Petmart, Vegis nou) încă neindexate | **Normal** pentru 2–3 zile de la apariție. |
| Redesignul din 5 oct. | **Fără efect negativ** (verificat). |
| **Retrogradarea din 21 aug. (poziția 15–28 → 40–50) pe pagini încă disponibile** | **Problemă reală.** E o judecată de calitate la nivel de site, nu o eroare tehnică. Nu se repară cu un buton. |
| **Ghidurile, `/reduceri-reale`, `/c/laptopuri` necunoscute de Google** | **Problemă reală, ușor de rezolvat.** Sunt exact paginile care ne pot scoate din zona de „conținut subțire”. |
| **Feed-uri care cad și duc la pagini care apar și dispar** (ForIT, CITGrup vechi, Vegis, eMAG) | **Problemă reală** de stabilitate. Google vede un site care își schimbă mereu catalogul. |
| **Creștere bruscă cu ~13.000 (Petmart) și, potențial, cu încă ~20.000 (CITGrup nou) de pagini subțiri** | **Risc real**: întărește semnalul de „conținut în serie”. |

**Ce înseamnă pentru recuperare:** după un update de spam sau de calitate, Google nu „iartă” imediat. Schimbările de calitate se văd de regulă în **câteva luni**, adesea abia la următorul update mare. Nu promitem o dată.

---

## 4. Plan de acțiuni prioritizat

### P0 (săptămâna asta)

| # | Acțiune | Cine | Efort |
|---|---|---|---|
| P0.1 | **Search Console → Securitate și acțiuni manuale → Acțiuni manuale.** Verifică dacă există o acțiune manuală („Conținut subțire, cu valoare adăugată mică sau deloc” / „scaled content abuse”). API-ul nu o arată. Dacă există, se cere reconsiderare **după** ce se fac P0.3–P1.1. | Proprietar | 5 min |
| P0.2 | **Search Console → Pagini și Setări → Statistici de accesare.** Notează: indexate / neindexate, „Accesată – neindexată acum”, „Descoperită – neindexată”, „Exclusă de eticheta noindex”; în Statistici de accesare: „Starea gazdei” (fără probleme de robots.txt/DNS/conexiune), răspunsuri 403/5xx. Ne trebuie ca bază de comparație. | Proprietar | 15 min |
| P0.3 | **Decizie: câte pagini lăsăm în index** (pârghia principală față de update). Varianta mea recomandată e **B**. Variantele sunt în §5, D1. | Proprietar decide, apoi cod | decizie + 0,5–1 zi |
| P0.4 | **Nu scoate CITGrup de pe pauză „ca atare”** (ar adăuga ~20.000 de pagini aproape identice în sitemap). Variantele sunt în §5, D2. | Proprietar decide | decizie |
| P0.5 | **Cere indexarea manuală** (Search Console → Inspecția adresei URL → „Solicită indexarea”) pentru ~10 pagini cu conținut real: `/reduceri-reale`, `/c/laptopuri`, `/c/televizoare`, `/ghiduri`, toate ghidurile publicate, `/ghiduri/metodologie`. (Eu n-am trimis nimic, cum s-a cerut.) | Proprietar | 15 min |
| P0.6 | **Lasă 410-ul de pe 27 oct. așa cum e.** Ce se întâmplă atunci e explicat la §1. Nu e nevoie de schimbări. | – | 0 |

### P1 (următoarele 2–4 săptămâni)

| # | Acțiune | Cine | Efort |
|---|---|---|---|
| P1.1 | **Valoare unică pe `/p/`, nu doar șablon:** fraze factuale specifice (minimul istoric cu data, de câte ori a fost „reducere reală”, comparație cu varianta de culoare/memorie), specificații extrase din numele produsului (diagonală, RAM, stocare) într-un tabel, legături „Alte variante”. Fără texte generate în masă cu AI: ar fi exact „scaled content”. | Cod (site-dev) | 2–4 zile |
| P1.2 | **Consolidarea variantelor** (canonical spre varianta principală la culori/configurații aproape identice; raportul din 4 oct., D6). Paginile din reclame rămân neatinse (§0 din raportul anterior). | Proprietar decide, apoi cod | 1–2 zile |
| P1.3 | **Stabilitatea feed-urilor = stabilitatea indexului:** reparat ForIT în Profitshare (gol din 3 aug.), monitorizat Vegis/eMAG. Fiecare feed care cade face sute de pagini să treacă pe `noindex`. Bandoul din Admin → Magazine există; contează reacția rapidă. | Proprietar (Profitshare) + worker | continuu |
| P1.4 | **Conținut „hub” care nu e subțire:** texte pe categorii (pachetul B, deja în lucru), ghiduri noi (pachetul C), linkuri interne din `/p/` spre ghiduri și `/reduceri-reale/<categorie>`. Paginile acestea dau site-ului semnale de calitate. | Cod + conținut | continuu |
| P1.5 | **Repară raportarea:** în `ga4-sync`, încă o interogare GSC doar pe `date` (totaluri reale) și una pe `date,page` (cu interogările anonimizate incluse), afișate în `/admin/statistici`, ca să nu mai apară „0 clickuri” fals. Cere o migrație nouă (tabelă `gsc_daily_totals`). | Cod (worker + admin) | 0,5 zile |
| P1.6 | **HTML-ul de 705 KB pe `/c/` și `/reduceri-reale/`** (dublat de redesign): mai puține carduri pe pagină sau payload RSC mai mic (date duplicate în props), meniul randat o singură dată. | Cod (site-dev) | 0,5–1 zi |
| P1.7 | Cele 2.295 de produse indexabile **fără categorie**: fie mapare (Admin → Mapare), fie `noindex` până sunt mapate (sunt pagini orfane). | Proprietar (mapare) / cod | 1–2 h |

### P2 (lună–trimestru)

| # | Acțiune | Cine | Efort |
|---|---|---|---|
| P2.1 | **Mențiuni și linkuri externe** (raportul din 4 oct., E5): forumuri (softpedia), Reddit r/Romania pe Black Friday, presă despre „reduceri reale”. Încrederea site-ului crește mai ales din afară. | Proprietar | continuu |
| P2.2 | Bing Webmaster Tools + IndexNow (dacă nu e făcut). Bing nu a aplicat același update. | Proprietar | 30 min |
| P2.3 | `/shop/` → 410 în loc de redirect spre homepage (consecvență cu regula din CLAUDE.md). | Cod | 10 min |
| P2.4 | Monitorizare: în fiecare luni, comparat afișări/zi și poziția medie pentru `/p/` disponibile față de baza din P0.2; reevaluare după următorul update mare Google. | ads-analyst / proprietar | 15 min/săpt. |

---

## 5. De decis (proprietarul alege)

**D1. Câte pagini de produs lăsăm indexabile?** (P0.3)
- **A. Toate produsele disponibile (situația de azi, ~29.000; ~49.000 cu CITGrup).** Pro: maximum de pagini care pot apărea pe căutări foarte specifice. Contra: exact profilul lovit de update; retrogradarea la nivel de site poate continua; buget de accesare împărțit pe mii de pagini fără valoare.
- **B. (recomandat) Indexabile doar produsele cu valoare proprie:** istoric de cel puțin ~30 de zile (mediana are sens) ȘI categorie mapată, fără Sănătate & Naturale (YMYL; e deja exclusă din reclame). Restul rămân pe site (vizibile, cu alertă de preț), dar `noindex, follow` și scoase din sitemap. Calcul pe DB azi: **~4.040 de pagini** (din 29.243; Sănătate & Naturale are singură 6.738), în principal electronice evomag/ITGalaxy/eMAG mai vechi; Petmart intră automat după ~3 nov. dacă vrei. Pro: semnal clar de „mai puțin, dar util”, recuperare mai probabilă. Contra: pierdem cele ~320 de afișări/46 de zile ale paginilor Vegis încă vizibile; regula trebuie întreținută. Atenție la paginile din reclame (`ads-guard` pune pe pauză landing-urile `noindex`): toate sunt electronice cu istoric lung, deci nu sunt afectate, dar trebuie verificat cu `ads:validate`.
- **C. Doar categorii alese de mână** (telefoane, laptopuri, TV, încărcătoare, baterii externe). Pro: cel mai curat. Contra: cel mai restrictiv; pierdem coada lungă.

**D2. CITGrup (feed revenit pe 5 oct., ~21.000 de oferte):**
- **A.** Rămâne pe pauză (situația de azi): fără venit din CITGrup, fără risc SEO.
- **B. (recomandat)** Scos de pe pauză pentru site și alerte, dar produsele CITGrup rămân `noindex` și în afara sitemap-ului, cu excepția celor din categoriile cerute (refurbished laptop / second hand, 2.900–3.600 de căutări/lună), consolidate pe modele. Cere cod (regulă de indexare per magazin).
- **C.** Scos de pe pauză complet: +20.000 de pagini în sitemap. Nu recomand acum.

**D3. Petmart (13.132 de produse din 3 oct.):** cu varianta B de la D1 intră automat la index după ce strâng istoric. Altfel, trebuie decis separat.

---

## 6. Ce NU s-a putut verifica (doar din interfață, de către proprietar)

- Raportul „Pagini” (număr exact de pagini indexate/excluse, pe motive) și „Statistici de accesare” (răspunsuri 5xx/403, timp mediu de răspuns pentru Googlebot): API-ul nu le oferă.
- „Acțiuni manuale” și „Probleme de securitate”.
- Jurnalele Cloudflare pentru Googlebot verificat (roboții reali vin de pe IP-uri Google; testul meu a folosit doar UA-ul). Inspecția URL arată însă preluare reușită pe 05.10, deci nu există blocaj.

## 7. Surse externe (Spam Update august 2026)

- [Google’s August 2026 Spam Update: Impact and Recovery Guidance (Seoteric)](https://www.seoteric.com/googles-august-2026-spam-update-impact-and-recovery-guidance/)
- [August 2026 Google spam update case studies (GSQi)](https://gsqi.com/marketing-blog/august-2026-google-spam-update-case-studies/)
- [Google August 2026 Spam Update (Coalition Technologies)](https://coalitiontechnologies.com/blog/google-august-2026-spam-update)
- [Google August 2026 spam update (PinMeTo)](https://www.pinmeto.com/news/google-august-2026-spam-update/)
- [Istoric update-uri Google (Rank Math)](https://rankmath.com/fr/google-updates/)

Notă: legătura dintre update și scăderea noastră se bazează pe **coincidența exactă de dată** (21 aug.), pe tiparul observat (pagini rămase indexate, dar retrogradate) și pe ținta declarată a update-ului. Google nu confirmă individual ce site-uri au fost afectate.
