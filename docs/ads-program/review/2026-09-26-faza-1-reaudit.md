# Review policy — Poarta 1 (Faza 1), RE-AUDIT pe site-ul live

- Data: 2026-09-26 (seara, ~23:10 ora României) · Auditor: policy-reviewer
- Țintă: **https://www.superieftin.ro** (producție, în spate Cloudflare). Cod local `main` @ `e5fd1c5`.
- Audit anterior: `2026-09-26-faza-1.md` (FAIL, B1–B4 + R1–R9).
- Checklist-uri aplicate: **Landing page** + **GDPR / tracking**. Anunțuri și Conversii nu se aplică (nu există campanii).

## Verdict: **FAIL**

Cele 4 blocante vechi sunt rezolvate. Au apărut însă **2 probleme blocante noi**. Ambele țin de
consimțământ și de politica de confidențialitate și se repară doar din text, în mai puțin de o oră.

1. **N1.** Bannerul de cookies nu spune că „Publicitate” încarcă bannere Profitshare care setează cookie-uri. Consimțământul nu e informat.
2. **N2.** Cloudflare primește tot traficul, dar nu apare printre destinatarii datelor.

---

## Metodă

- `curl` pe paginile cerute (HTML brut, headere, coduri de răspuns).
- Playwright (Chromium headless, script temporar în `worker/`, șters după rulare). Am folosit 4 contexte separate:
  1. desktop fără consimțământ;
  2. desktop după „Refuz toate” + reîncărcare;
  3. desktop, context de test, „Accept toate”;
  4. mobil 360 px.

  Toate cererile `/go/**` au fost blocate în browser, deci nu s-a făcut niciun click spre Profitshare.
- `/go`: o singură cerere `curl`, fără urmarea redirectului.
- Cod: fișierele din tabelul de mai jos, plus `grep` în `web/src` după scripturi și trackere.

### Fișiere verificate (sha256, primele 12 caractere)

| Fișier | Hash |
|---|---|
| web/src/lib/consent.ts | fe3432ec4969 |
| web/src/lib/company.ts | eb4680be6774 |
| web/src/lib/pii.ts | dc4dee91004a |
| web/src/lib/availability.ts | f49d9d9f0352 |
| web/src/lib/discount.ts | 6dabca72e1fa |
| web/src/proxy.ts | aecaed314a29 |
| web/src/components/consent/AdConsentGate.tsx | 25549001d5f1 |
| web/src/components/consent/CookieBanner.tsx | cb53ee0c4a75 |
| web/src/components/analytics/GoogleAnalytics.tsx | bfa9a9810d9e |
| web/src/app/confidentialitate/page.tsx | 7230d7eea88f |
| web/src/app/cookies/page.tsx | 9684f6dcaeb8 |
| web/src/app/p/[slug]/page.tsx | 6bdd74bca87f |
| web/src/app/go/[offerId]/route.ts | df7184653721 |
| web/src/app/layout.tsx | fbe54f152150 |

### URL-uri testate (live)

| URL | Cod | Observații |
|---|---|---|
| `/` | 200 | footer complet, afiliere declarată, fără `[DE COMPLETAT]` |
| `/despre` | 200 | metodologie; „operat de Digital Pro Shop SRL” |
| `/contact` | 200 | email, firmă, CUI 50523367, J2024020841007, sediu București, Mihai Bravu 85-93. Emailul e ascuns de Cloudflare (vezi N2) |
| `/confidentialitate` | 200 | operator identificat; vezi N1, N2, R-noi |
| `/termeni` | 200 | operator identificat; nota „jurist” scoasă |
| `/cookies` | 200 | rând Profitshare adăugat; vezi R10 |
| `/reduceri-reale/telefoane-mobile` | 200 | 46 reduceri reale, „Ultima verificare a prețurilor: 26 septembrie la 22:31” |
| `/reduceri-reale/televizoare` | 200 | **nu e goală**: 48 reduceri reale (majoritatea evomag, până la −52,2 %) |
| `/reduceri-reale/laptopuri` | 200 | 48 reduceri; brandul „Vivo” încă greșit (R5) |
| `/reduceri-reale/sanatate-naturale` | **404** | corect (regula 8) |
| `/p/telefon-mobil-xiaomi-14t-pro-…-titan-blue` (luat de pe landing) | 200 | „Verificat acum mai puțin de o oră”, buton complet pe 360 px |
| `/p/televizor-mini-led-tcl-248-cm-…` | 200 | −52,2 %, date coerente cu istoricul |
| `/p/cablu-date-usb-c-usb-c-60w-480mps-1-2m-negru` (hero homepage) | 200 | −82,1 %, vezi R13 |
| `/p/raft-din-sticla-securizata` (produs fără ofertă, ForIT) | 200 | „Momentan indisponibil…”, `noindex, follow`, **0 linkuri /go**, titlu fără preț |
| `/p/pectina-de-mere-80g` (fără ofertă) | 200 | la fel, `noindex` |
| `/go/20674` | 302 | → `l.profitshare.ro/…&hash=mghluan5mzni`, `Cache-Control: no-store`, fără `Set-Cookie` |

Produs CITGrup: nu am găsit un slug CITGrup public. Paginile fără ofertă sunt scoase din căutare,
sitemap și categorii, deci nu pot fi descoperite, iar accesul la DB nu a fost disponibil pentru
auditor. Comportamentul „indisponibil + noindex + fără buton” e verificat live pe două produse
fără ofertă (ForIT, Vegis) și în cod (`app/p/[slug]/page.tsx` l. 43–45 și 196–209,
`lib/availability.ts`). Logica e aceeași pentru toți retailerii.
410: `proxy.ts` nu interoghează DB până la `PRODUCT_GONE_FROM` = 27 oct 2026. Comportamentul e
conform cu decizia documentată.

---

## Consent Mode — dovezi live

- **HTML brut** (`/`): `<link rel="preload" href="…gtag/js?id=G-74GYJN8XLB" as="script">` apare în
  `<head>`. E doar o indicație de descărcare, nu execută nimic, deci nu e o problemă. Primul script
  executat în `<body>` este `consent-default` (`self.__next_s`, beforeInteractive): 4 semnale
  `denied`, `wait_for_update: 500`, `ads_data_redaction: true` și reaplicarea alegerii salvate.
  `gtag('config', …)` apare după el (offset 86163 față de 84916).
- **`window.dataLayer`** (fără consimțământ): `consent default` (toate denied) → `set ads_data_redaction` → `js` → `config G-74GYJN8XLB`. Ordinea e corectă.
- **Fără consimțământ** (desktop 1280):
  - cookie-uri: **niciunul** (nici `_ga`, nici `PROFITSHARESESSID`);
  - `/embed/banner`: **0** cereri;
  - GA: un singur ping `page_view gcs=G100` (fără cookie, conform Consent Mode avansat și declarat în politică);
  - bannerul de cookies e vizibil, cu „Accept toate” și „Refuz toate” în același stil.
- **După „Refuz toate” + reîncărcare**: doar `se_consent`, 0 bannere, GA doar `gcs=G100`, bannerul nu mai apare.
- **Context de test, „Accept toate”** (desktop):
  - cookie-uri: `_ga`, `_ga_74GYJN8XLB`, `se_consent`;
  - `/embed/banner`: 3 cereri, iar `static.profitshare.ro` se încarcă abia acum;
  - GA trece pe `gcs=G111`;
  - apar și cereri spre `stats.g.doubleclick.net` și `www.google.be` (Google Signals / funcții de publicitate GA4, vezi R12).
- **Mobil 360 px, „Accept toate”**: `/embed/banner` **0** cereri. Poarta pe desktop (`AdConsentGate`, `min-width: 1024px`) funcționează.
- Resurse terțe încărcate fără consimțământ: doar imagini (`app.profitshare.ro/files_shared/advertiser-logos/*`, `cdni.itgalaxy.ro`, `static2.evomag.ro`, `cdn.vegis.ro`), fără cookie-uri. Politica le declară acum.
- `grep` în `web/src`: singurele scripturi externe sunt gtag.js (GA4) și HTML-ul bannerelor din admin, randat prin `AdConsentGate`. Nu există Meta Pixel, Hotjar, Clarity, TikTok sau alte trackere. Pe live, Cloudflare injectează `/cdn-cgi/scripts/…/email-decode.min.js` pe `/contact` (vezi N2).

---

## Stare blocante vechi

| # | Problemă | Stare | Dovadă |
|---|---|---|---|
| B1 | Buton „Cumpără la …” tăiat pe mobil (/p/) | **Rezolvat** | 360 px: rândul trece pe 2 niveluri. Buton 33–327 px în card 16–344 px, `scrollWidth = 360`. Text complet „Cumpără la eMAG →” |
| B2 | „Verificat azi” fals | **Rezolvat** | `formatVerified` (`lib/discount.ts` l. 58–65): „acum N ore” / „Verificat pe <zi lună>”. Hero: „Reduceri verificate”, titlul „Top reduceri reale” fără „azi”. Landing și produs sunt coerente. Rămâne o nuanță de cache (R14) |
| B3.1 | Bannere Profitshare fără consimțământ | **Rezolvat tehnic** (0 cereri fără acord, 0 pe mobil), **dar vezi N1** (consimțământul cerut nu e informat) | Playwright, testele 1–4 |
| B3.2 | Text despre click_id/gclid fără funcție în cod | **Parțial.** Click_id e live și textul e adevărat. Textul despre gclid anticipează o funcție care nu există încă (supradeclarare) → R10 | `/go/20674` → `&hash=…`. `grep gclid` în cod: doar în texte |
| B3.3 | Retenție GA4 14 luni | **Rezolvat — declarat de proprietar** (auditorul nu are acces la GA4) | — |
| B4 | Date firmă placeholder | **Rezolvat** | `company.ts` fără `null`. 0 apariții „DE COMPLETAT” pe cele 11 pagini |

## Stare recomandări vechi

| # | Recomandare | Stare | Dovadă |
|---|---|---|---|
| R1 | Meta description cu „Altex” | **Rezolvat** | `layout.tsx` l. 34–35: „…mai multe magazine online din România” |
| R2 | Filtru de prospețime 48 h pe landing | **Rezolvat** | `lib/queries.ts` l. 109, 149. Vezi însă R15 (pagina de produs arată insigna până la 72 h) |
| R3 | Nota „jurist” publică | **Rezolvat** | 0 apariții pe `/confidentialitate` și `/termeni` (rămâne doar în comentariul din cod) |
| R4 | Resurse terțe (IP) | **Rezolvat prin declarare** | Paragraf nou în `/confidentialitate`. Verificat: fără cookie-uri |
| R5 | Brand „Vivo” pentru ASUS Vivobook | **Nerezolvat** | `/reduceri-reale/laptopuri`, primul card: „Laptop ASUS Vivobook Go 15…” → brand „Vivo” |
| R6 | PII în `search_term` | **Parțial** | `maskPII` aplicat în `TrackSearch` și `logSearch`, dar URL-ul `/cautare?q=…` ajunge brut în GA4 ca `page_location` → R11 |
| R7 | Nume eveniment GA4 | **Rezolvat** | REGULI.md și `AffiliateLink.tsx` folosesc ambele `click_affiliate_link` |
| R8 | „Sănătate & Naturale” în meniul landing-urilor | **Nerezolvat** | meniul de pe `/reduceri-reale/*` include categoria. Homepage „Top reduceri reale” conține „Silimarina Forte 30cps” |
| R9 | Bannere sub `lg` / performanță | **Rezolvat** (bannerele). PageSpeed nemăsurat în acest audit | 0 cereri `/embed/banner` pe 360 px, chiar cu acord |

---

## Probleme BLOCANTE noi

### N1. Consimțământul pentru „Publicitate” nu e informat: bannerul nu menționează Profitshare
- **Unde:** `web/src/components/consent/CookieBanner.tsx` l. ~55–57 (text principal: „de
  **publicitate** (Google Ads), ca să știm … ce reclame funcționează”) și detaliul „Publicitate —
  Google Ads: măsurăm dacă o reclamă a adus o vizită…”.
- **Ce se întâmplă de fapt:** „Accept toate” / bifarea „Publicitate” încarcă pe desktop 3 bannere
  HTML Profitshare (`/embed/banner` → `static.profitshare.ro`, scripturi terțe care trimit URL-ul
  paginii, referrerul și rezoluția și își setează propriile cookie-uri, conform propriei noastre
  pagini `/cookies`). Tot sub acest semnal, GA4 pornește funcțiile de publicitate
  (`stats.g.doubleclick.net`).
- **De ce e blocant:** GDPR (art. 4 pct. 11, art. 7) și Directiva ePrivacy cer consimțământ
  specific și informat în momentul în care e cerut. Vizitatorul acceptă „Google Ads” și primește
  și cookie-uri Profitshare, despre care bannerul nu spune nimic. Fix-ul pentru B3.1 se bazează
  pe acest consimțământ. Dacă textul nu e informat, consimțământul nu e valid și B3.1 nu e închis
  de fapt. Informația apare doar în `/cookies`, la un click distanță, iar bannerul nu o rezumă.
- **Reparare:** text principal, de exemplu: „…de **publicitate** (Google Ads și bannere ale
  partenerilor de afiliere, ex. Profitshare)…”. Detaliu „Publicitate”: „Google Ads (măsurarea
  reclamelor) și bannerele partenerilor Profitshare, care își setează propriile cookie-uri.” Se
  crește `CONSENT_VERSION` / versiunea politicii dacă există, ca vizitatorii care au acceptat deja
  să fie întrebați din nou.
- **Cine:** **site-dev** (text + versiune). Tracking verifică după.

### N2. Cloudflare procesează tot traficul, dar nu apare printre destinatari
- **Unde:** live, header `server: cloudflare`, `cf-ray`, `report-to` / `nel` spre
  `a.nel.cloudflare.com`, script injectat `/cdn-cgi/scripts/5c5dd728/cloudflare-static/email-decode.min.js`
  și email-ul de pe `/contact` rescris ca `/cdn-cgi/l/email-protection#…`.
  `web/src/app/confidentialitate/page.tsx`, secțiunea „Cui transmitem date”, numește ca
  infrastructură doar „Contabo GmbH, server în Franța (UE)”.
- **De ce e blocant:** checklist-ul cere ca politica să descrie real datele colectate. Art. 13
  alin. (1) lit. (e)–(f) GDPR cere destinatarii (sau categoriile lor) și transferurile în afara UE.
  Cloudflare (proxy / CDN, companie din SUA) primește IP-ul, URL-ul și user-agentul fiecărei
  cereri, inclusiv căutările `?q=`. Lista din politică pare completă, deci omisiunea e o
  informație falsă, nu doar o lipsă.
- **Reparare:** în „Cui transmitem date” se adaugă, de exemplu, „Cloudflare, Inc. (rețea de
  livrare și protecție a site-ului: prin serverele lor trec toate cererile către site — adresă
  IP, pagina cerută, browser); transfer în SUA în baza Cadrului UE–SUA privind protecția
  datelor”. Se actualizează data politicii. Opțional (recomandat): se dezactivează în Cloudflare
  „Email Address Obfuscation” (fără JS, emailul de contact nu e vizibil) și NEL, dacă nu sunt
  folosite.
- **Cine:** **site-dev** (text politică). **Proprietar** (setări Cloudflare, confirmă că e contul lui și ce funcții sunt active: Bot Fight, Analytics etc., pentru formulare exactă).

---

## Recomandări noi (neblocante)

- **R10. `/cookies` și `/confidentialitate` descriu gclid ca „cookie” și ca funcție activă.**
  Pe site nu există tag Google Ads (doar GA4 `G-74GYJN8XLB`) și nicio linie de cod nu citește
  sau salvează `gclid`/`gbraid`/`wbraid` (coloanele din `ad_clicks` sunt NULL). Tabelul de cookies
  are un rând numit după parametri de URL, nu după cookie-uri reale (`_gcl_au`/`_gcl_aw` apar abia
  cu un tag Ads sau cu linkerul de conversii). Supradeclararea nu e periculoasă, dar se corectează
  când se implementează Faza 2 (numele reale ale cookie-urilor, verificate în browser). Tot atunci
  trebuie ca review-ul de tracking să confirme regula 7. — **tracking**
- **R11. PII în GA4 prin `page_location`.** `maskPII` curăță `search_term`, dar pagina de rezultate
  e `/cautare?q=<text>`, iar GA4 trimite URL-ul complet (`dl`) la fiecare `page_view`. Un email
  tastat în căutare ajunge în GA4. Reparare: în GA4, Admin → Fluxuri de date → Redactare date,
  se activează redactarea emailului **și** a parametrului `q`. Alternativ, în cod, `page_location`
  se trimite cu `q` mascat (`gtag('config', id, { page_location: … })`). — **proprietar**
  (setare GA4) sau **tracking** (cod)
- **R12. Google Signals / funcții de publicitate GA4 nemenționate.** După acceptare apar cereri
  spre `stats.g.doubleclick.net`. Politica descrie GA4 drept „statistici agregate”, iar bannerul
  spune „anonim și agregat”, deși `_ga` e un identificator pseudonim. Se menționează în
  politică („cu acordul pentru Publicitate, Google poate folosi datele pentru funcții de
  publicitate / Google Signals”) sau se dezactivează Signals în GA4. „Anonim” se înlocuiește cu
  „fără nume sau email, agregat”. — **proprietar** (GA4) + **site-dev** (text)
- **R13. Reduceri extreme generate de prețuri instabile în feed.** Cablul USB-C din hero-ul
  homepage (−82,1 %): istoricul ITGalaxy oscilează 26,99 → 161,99 → 27,99 → 161,99 → 28,99 RON.
  Mediana (161,99) e reală conform metodologiei, dar un utilizator o percepe ca preț umflat. Nu
  e o încălcare acum (pagina arată istoricul, deci afirmația are suport). Pentru Faza 3
  (regula 9, anunțuri cu procent): se exclud din anunțuri reducerile peste un prag (ex. > 50 %)
  sau produsele cu salturi de preț > 3× în 30 de zile, până la o verificare manuală. — **site-dev** / copy
- **R14. „Verificat acum mai puțin de o oră” e calculat la randare, iar pagina e în cache ISR**
  (`revalidate = 3600`, header `x-nextjs-cache: STALE`). Afișarea poate rămâne în urmă cu ore.
  Se afișează ora exactă („Verificat azi la 22:31”) sau se calculează textul relativ în browser. — **site-dev**
- **R15. Pragul de prospețime diferă între pagini.** Landing-ul marchează „Reducere reală” doar
  pentru prețuri de ≤ 48 h (`FRESH_HOURS`). Pagina de produs arată insigna și procentul pentru
  orice ofertă „disponibilă” (≤ 3 zile, `OFFER_STALE_DAYS`). Între 48 și 72 h, produsul nu mai
  apare pe landing, dar pagina lui încă spune „Reducere reală”. Se aplică `FRESH_HOURS` și pe
  insigna din `/p/`. — **site-dev**
- **R16. Istoricul nu conține prețul curent (eMAG).** Xiaomi 14T Pro: preț curent 3.252,92 RON
  (−34,4 %), dar „Min 90 zile: 4.926,48 RON”, iar graficul se oprește la ~4.955. Prețul de azi
  nu apare în `price_history` sau nu e inclus în min/grafic. Pentru un vizitator, reducerea nu
  are suport vizual. Se verifică scrierea snapshotului eMAG la scanare (legat de fix-ul
  `ac4a194`) și se include prețul curent în grafic și în min. Merită verificat și dacă
  3.252,92 e un preț real eMAG sau de marketplace sau resigilat. — **site-dev**
- **R17. Superlativ în `<title>`-ul paginilor de produs:** „— cel mai mic preț: X RON”
  (`app/p/[slug]/page.tsx` l. 36) apare și când există un singur magazin și prețul e cu 27,8 %
  peste mediană (`/p/cablu-micro-b-usb-100cm-negru`). Formulare neutră: „— de la X RON” sau
  „preț azi: X RON”. Devine blocant dacă titlul e folosit în anunțuri sau în Shopping. — **site-dev**
- **R18. „Magazine monitorizate” pe homepage include CITGrup** (logo), deși feed-ul CITGrup lipsește
  din iunie și produsele lui sunt „indisponibile”. Se afișează doar magazinele cu oferte
  disponibile. Similar, „Acces direct la magazin — fără intermediari” e o formulare discutabilă
  când linkul trece printr-o rețea de afiliere. Mai corect: „Cumperi direct de la magazin”. — **site-dev**
- **R19. JSON-LD `Product` cu `"offers":[]`** pe paginile „indisponibil”: Google raportează eroare de
  date structurate. Se omite `offers` sau se pune `availability: OutOfStock`. Breadcrumb-ul
  paginilor vechi trimite la `/c/telefoane-si-accesorii` (308), deci se folosește slug-ul curent. — **site-dev**

---

## Ce e în regulă (fără acțiune)
- Consent Mode v2: default denied înaintea oricărui tag Google. Ordinea din `dataLayer` e
  corectă. Fără acord nu apare niciun cookie. Refuzul e la fel de ușor ca acceptul și se
  păstrează la reîncărcare.
- Bannere Profitshare: 0 încărcări fără acord și 0 pe mobil, chiar cu acord.
- `/go`: click_id live (`&hash=` Profitshare), `no-store`, fără cookie. Ofertele indisponibile
  întorc pe `/p/`. Evenimentul GA `click_affiliate_link` nu conține click_id și nici date personale.
- Date firmă complete pe Contact, Despre, Termeni și Confidențialitate. Declarația de afiliere
  apare pe toate paginile și pe `/p/`, iar linkurile au `rel="sponsored"`.
- Landing-urile `/reduceri-reale/*`: conținut propriu, metodologie, data verificării, prospețime
  48 h, OK pe 360 px fără scroll orizontal. Sănătate & Naturale dă 404.
- Produse fără ofertă: „indisponibil”, `noindex`, fără buton spre magazin.

## Re-verificare
După N1 și N2 (doar text + deploy), se rulează din nou policy-reviewer, limitat la bannerul de
cookies și la `/confidentialitate` pe live. Restul punctelor sunt verificate în acest audit și nu
trebuie refăcute, dacă nu se schimbă alt cod.
